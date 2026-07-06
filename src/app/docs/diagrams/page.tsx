import dedent from "ts-dedent";
import { Diagrams } from "./diagrams";

const sharedClassDefs = `
classDef errEvent fill:#f8d9d2,color:#a04434,stroke:#a04434,stroke-width:1.5px
classDef goodEvent fill:#dfe9d2,color:#4f6b3c,stroke:#4f6b3c,stroke-width:1.5px
classDef link fill:#dbe6ee,color:#2f4d66,stroke:#5f83a3,stroke-width:1.5px,font-weight:bold
classDef notification fill:#f8ddba,color:#96591f,stroke:#96591f,stroke-width:1.5px
classDef update fill:#fffdf8,color:#3b3227,stroke:#857662,stroke-width:1.5px,stroke-dasharray:4 3,font-family:monospace,text-align:left,text-wrap:nowrap,font-size:12px
classDef code fill:#fffdf8,color:#3b3227,stroke:#857662,stroke-width:1.5px,stroke-dasharray:4 3,font-family:monospace,text-align:left,text-wrap:nowrap,font-size:12px

`;
const ml = (multiline: string) =>
  dedent(multiline)
    .replace(/[#"<>{};]/g, (c) => `#${c.charCodeAt(0)};`)
    .replace(/\n/g, "<br/>");

const sections = [
  {
    id: "entry",
    title: "Entry Points",
    intro:
      "The two user actions that start everything: claiming a new domain, or asking for it to be verified. Blue nodes are links; click one to jump to that flow.",
    graph: `
---
config:
    theme: neo
    layout: elk
---
stateDiagram-v2
    ${sharedClassDefs}
    [*] --> idle
    createDomain: Create Domain
    startVerification: Start Verification
    click createDomain href "#create_domain"
    click startVerification href "#start_verification"
    state action <<choice>>
    idle --> action
    action --> createDomain:::link
    action --> startVerification:::link
      `,
  },
  {
    id: "create_domain",
    title: "Create Domain",
    intro:
      "How a new domain gets claimed: existence and ownership checks decide whether we mint fresh DKIM keys, return the existing claim, or reject the name as taken.",
    graph: `
---
config:
    theme: neo
    layout: elk
---
stateDiagram-v2
    ${sharedClassDefs}
    [*] --> normalize
    normalize --> exists
    exists: Does domain exist?
    state existsCheck <<choice>>
    exists --> existsCheck
    existsCheck --> verified : [yes]
    existsCheck --> generateDkimKeys : [no]

    verified: Is domain status 'verified'?
    state verifiedCheck <<choice>>
    verified --> verifiedCheck
    verifiedCheck --> mine : [no]
    verifiedCheck --> generateDkimKeys : [yes]

    mine: Is existing claim from this user?
    state mineCheck <<choice>>
    mine --> mineCheck
    mineCheck --> returnDomain : [yes]
    mineCheck --> enforced : [no]

    enforced: Is enforce flag set?
    state enforcedCheck <<choice>>
    enforced --> enforcedCheck
    enforcedCheck --> generateDkimKeys : [yes]
    enforcedCheck --> nameTakenErr:::errEvent : [no]

    generateDkimKeys --> createUnverified
    createUnverified: Create new domain
    returnDomain: Return domain
    createUnverified --> returnDomain:::goodEvent

    nameTakenErr: Error: Name taken
    nameTakenErr --> [*]
    returnDomain --> [*]


      `,
  },
  {
    id: "cron_verify",
    title: "Cron Sweep",
    intro:
      "The automatic entry point. A periodic tick picks up every domain due for a check and verifies each one; a single domain failing never aborts the sweep.",
    graph: `
---
config:
    theme: neo
    layout: elk
---
stateDiagram-v2
    ${sharedClassDefs}

    [*] --> auth
    auth: Is the cron secret valid?
    state authCheck <<choice>>
    auth --> authCheck
    authCheck --> err401:::errEvent : [no]
    authCheck --> getDue : [yes]

    err401: Return 401: cron/unauthorized
    err401 --> [*]

    getDue: ${ml(`
      Get domains due for check
      status = "inProgress" | "verified"
      nextCheckAt <= now
      oldest first, max 50
    `)}
    class getDue code

    getDue --> verifyEach:::link
    verifyEach: Verify each domain in parallel
    click verifyEach href "#verify_domain"

    verifyEach --> collect
    collect: ${ml(`
      Collect results
      one domain failing never aborts the sweep,
      rejections are only logged
    `)}

    collect --> return200

    return200: ${ml(`
      Return 200
      { ok: true, checked, failed }
    `)}
    return200 --> [*]
    class return200 goodEvent
        `,
  },
  {
    id: "start_verification",
    title: "Start Verification",
    intro:
      "What a manual verify request does, based on where the domain currently is: start fresh, restart with existing keys, rotate keys after a takeover, or just run a check now.",
    graph: `
---
config:
    theme: neo
    layout: elk
---
stateDiagram-v2
    ${sharedClassDefs}
    [*] --> status
    status: domain.status is

    state statusCheck <<choice>>
    status --> statusCheck
    statusCheck --> startVerification : [notStarted]
    statusCheck --> statusReason : [failed]
    statusCheck --> check : [inProgress]
    statusCheck --> check : [verified]

    statusReason: domain.statusReason is
    state statusReasonCheck <<choice>>
    statusReason --> statusReasonCheck
    statusReasonCheck --> rotateDomain : [superseded]
    statusReasonCheck --> restartVerification : [expired]
    statusReasonCheck --> restartVerification : [canceled]
    statusReasonCheck --> restartVerification : [gracePeriodExpired]



    rotateDomain: Rotate Domain Keys
    rotateDomain --> generateDkimKeys
    generateDkimKeys --> updateDomainWithNewKeys:::update
    updateDomainWithNewKeys --> returnDomain

    updateDomainWithNewKeys: ${ml(`
      Update
      domain.status = "inProgress"
      domain.publicKey = newPublicKey
      domain.privateKey = newPrivateKey
    `)}


    returnDomain : Return domain
    returnDomain --> [*]



    check --> isCheckThrottled

    state isCheckThrottledCheck <<choice>>
    isCheckThrottled --> isCheckThrottledCheck
    isCheckThrottledCheck --> verifyDomain:::link : [false]
    isCheckThrottledCheck --> returnDomain: [true]

    click startVerification href "#start_verification"

    restartVerification: Restart Verification
    restartVerification --> updateDomainInProgress:::update
    updateDomainInProgress: ${ml(`
      Update
      domain.status = "inProgress"
    `)}
    updateDomainInProgress --> returnDomain

    verifyDomain --> returnDomain
      `,
  },
  {
    id: "verify_domain",
    title: "Verify Domain",
    intro:
      "One DKIM check: resolve the TXT record for the domain and compare the published key against ours. Every outcome (match, mismatch, or DNS error) feeds the state transition.",
    graph: `
---
config:
    theme: neo
    layout: elk
---
stateDiagram-v2
    ${sharedClassDefs}

    [*] --> verifyDomain
    verifyDomain --> DkimCheck

    state DkimCheck {
      [*] --> isDomainValid
      isDomainValid: Is domain valid?
      state isDomainValidCheck <<choice>>
      isDomainValid --> isDomainValidCheck
      isDomainValidCheck --> resolveTxtRecord : [true]
      isDomainValidCheck --> returnDomain: [false]



      resolveTxtRecord: Resolve TXT DNS record
      resolveTxtRecord --> txtRecordResult

      txtRecordResult: ${ml(`
        {
          type: "success",
          value: "v=DKIM1; k=rsa; p=MIIBI..."
        } | {
         type: "error",
         kind: ENOTFOUND | ENODATA | ...other DNS error codes
        }
      `)}

      state typeCheck <<choice>>
      txtRecordResult --> typeCheck
      typeCheck --> keysMatch: [success]
      typeCheck --> errorCode : [error]


      state errorCodeCheck <<choice>>
      errorCode --> errorCodeCheck
      errorCodeCheck --> errDomainNotFound:::errEvent : [ENOTFOUND]
      errorCodeCheck --> errRecordNotFound:::errEvent : [ENODATA]
      errorCodeCheck --> errDnsError:::errEvent : [...other DNS error codes]

      keysMatch: keys match?

      state keysMatchCheck <<choice>>
      keysMatch --> keysMatchCheck
      keysMatchCheck --> errKeysMismatch:::errEvent: [no]
      keysMatchCheck --> return: [yes]

      return: Return result
      return --> [*]

      errKeysMismatch: Return Error: keysMismatch
      errDomainNotFound: Return Error: domainNotFound
      errRecordNotFound: Return Error: recordNotFound
      errDnsError: Return Error: dnsError

      errKeysMismatch --> return
      errDomainNotFound --> return
      errRecordNotFound --> return
      errDnsError --> return
      return --> [*]
    }
    class txtRecordResult code
    class returnRecord goodEvent
    class errDomainNotFound errEvent
    class errRecordNotFound errEvent
    class errKeysMismatch errEvent
    class errDnsError errEvent


    DkimCheck --> transition:::link
    transition: State transition
    click transition href "#transition"


    `,
  },
  {
    id: "transition",
    title: "State Transition",
    intro:
      "The pure state machine at the core: a check result plus the current status decides the update to apply and which notifications the user gets. Updates are shown as if applied immediately, with only the fields that carry meaning.",
    graph: `
---
config:
    theme: neo
    layout: elk
---
stateDiagram-v2
    ${sharedClassDefs}

    [*] --> status
    status: domain.status is
    state statusCheck <<choice>>
    status --> statusCheck
    statusCheck --> dkimResult : [inProgress]
    statusCheck --> dkimResultVerified : [verified]
    statusCheck --> noop : [notStarted]
    statusCheck --> noop : [failed]

    noop: No-op, checks don't apply
    noop --> [*]

    dkimResult: dkim check result is
    state dkimResultCheck <<choice>>
    dkimResult --> dkimResultCheck
    dkimResultCheck --> updateDomainVerified:::update : [success]
    dkimResultCheck --> deadline : [error]

    updateDomainVerified: ${ml(`
      Update
      domain.status = "verified"
      domain.statusReason = null
      domain.verifiedAt = now
      domain.nextCheckAt = now + 24h
    `)}
    updateDomainVerified --> notifyVerificationSucceeded:::notification
    notifyVerificationSucceeded: Notify user: Verification Succeeded
    notifyVerificationSucceeded --> [*]

    deadline: Is the verification deadline past?
    state deadlineCheck <<choice>>
    deadline --> deadlineCheck
    deadlineCheck --> updateExpired:::update : [yes]
    deadlineCheck --> updateRetry:::update : [no]

    updateExpired: ${ml(`
      Update
      domain.status = "failed"
      domain.statusReason = "expired"
      domain.nextCheckAt = null
    `)}
    updateExpired --> notifyVerificationFailed:::notification
    notifyVerificationFailed: Notify user: Verification Failed
    notifyVerificationFailed --> [*]

    updateRetry: ${ml(`
      Update
      domain.status = "inProgress"
      domain.nextCheckAt = now + 1m
      log failed check
    `)}
    updateRetry --> [*]

    dkimResultVerified: dkim check result is
    state dkimResultVerifiedCheck <<choice>>
    dkimResultVerified --> dkimResultVerifiedCheck
    dkimResultVerifiedCheck --> updateStillVerified:::update : [success]
    dkimResultVerifiedCheck --> gracePeriod : [error]

    updateStillVerified: ${ml(`
      Update
      domain.status = "verified"
      domain.nextCheckAt = now + 24h
      clear grace period
    `)}
    updateStillVerified --> [*]

    gracePeriod: Is a grace period already running?
    state gracePeriodCheck <<choice>>
    gracePeriod --> gracePeriodCheck
    gracePeriodCheck --> updateGraceStarted:::update : [no]
    gracePeriodCheck --> graceExpired : [yes]

    updateGraceStarted: ${ml(`
      Update
      domain.status = "verified" (kept)
      domain.gracePeriodStartedAt = now
      domain.nextCheckAt = now + 1m
      log failed check
    `)}
    updateGraceStarted --> [*]

    graceExpired: Did the grace period (24h) run out?
    state graceExpiredCheck <<choice>>
    graceExpired --> graceExpiredCheck
    graceExpiredCheck --> updateRevoked:::update : [yes]
    graceExpiredCheck --> warnDue : [no]

    updateRevoked: ${ml(`
      Update
      domain.status = "failed"
      domain.statusReason = "gracePeriodExpired"
      domain.verifiedAt = null
      domain.nextCheckAt = null
    `)}
    updateRevoked --> notifyGracePeriodExpired:::notification
    notifyGracePeriodExpired: Notify user: Grace Period Expired
    notifyGracePeriodExpired --> [*]

    warnDue: 1h into grace period and no warning sent yet?
    state warnDueCheck <<choice>>
    warnDue --> warnDueCheck
    warnDueCheck --> updateWarned:::update : [yes]
    warnDueCheck --> updateGraceRetry:::update : [no]

    updateWarned: ${ml(`
      Update
      domain.gracePeriodWarningSentAt = now
      domain.nextCheckAt = now + 1m
      log failed check
    `)}
    updateWarned --> notifyGracePeriodWarning:::notification
    notifyGracePeriodWarning: Notify user: Grace Period Warning
    notifyGracePeriodWarning --> [*]

    updateGraceRetry: ${ml(`
      Update
      domain.status = "verified" (kept)
      domain.nextCheckAt = now + 1m
      log failed check
    `)}
    updateGraceRetry --> [*]

        `,
  },
];

function H2({ id, title }: { id: string; title: string }) {
  return (
    <h2 className="text-xl font-semibold text-foreground">
      {title}{" "}
      <a
        href={`#${id}`}
        className="ml-1 font-mono text-sm font-normal text-muted transition-colors hover:text-foreground"
      >
        #{id}
      </a>
    </h2>
  );
}

const toc: {
  id: string;
  title: string;
  children?: { id: string; title: string }[];
}[] = [
  { id: "intro", title: "Introduction" },
  { id: "process", title: "How it went" },
  { id: "product", title: "Product decisions" },
  { id: "stack", title: "The stack" },
  { id: "effect", title: "The Effect detour" },
  { id: "openspec", title: "Spec-driven, with AI" },
  {
    id: "how-it-works",
    title: "How it works",
    children: sections.map((s) => ({ id: s.id, title: s.title })),
  },
  { id: "hindsight", title: "Hindsight" },
];

export default function DiagramsPage() {
  return (
    <article className="post">
      <h1 className="text-3xl font-bold text-foreground">Building Inkwell</h1>
      <p className="mt-3 text-muted">
        Documentation and post-mortem of a domain-verification take-home for
        Resend.
      </p>

      <nav className="mt-8 rounded-lg border border-border bg-surface p-5">
        <div className="text-sm font-semibold text-foreground">Contents</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {toc.map((t) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                className="text-muted transition-colors hover:text-foreground hover:underline"
              >
                {t.title}
              </a>
              {t.children && (
                <ol className="mt-1 list-[lower-alpha] space-y-1 pl-5">
                  {t.children.map((c) => (
                    <li key={c.id}>
                      <a
                        href={`#${c.id}`}
                        className="text-muted transition-colors hover:text-foreground hover:underline"
                      >
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <section id="intro" className="copy mt-14 scroll-mt-20">
        <H2 id="intro" title="Introduction" />
        <p>
          This page is the documentation and the post-mortem of Inkwell, my
          submission for Resend&apos;s Product Engineer take-home. The brief,
          condensed: build a product experience that helps a user prove
          ownership of a domain, understand the verification process, see when
          it fails, and recover from mistakes.
        </p>
        <p>
          Inkwell is a domain ownership checker wearing the clothes of a small
          email product. On its own it&apos;s too little to pretend it&apos;s a
          real product, but in my head it lives inside something Resend-shaped
          (mailing, newsletters), which is where the ink-and-letter name comes
          from. What it does have is the hard part of every real product in
          this space: the moment you ask a user to go edit DNS records and
          trust you with their domain.
        </p>
        <p>You&apos;re reading this inside the deployed app, which felt appropriate.</p>
      </section>

      <section id="process" className="copy mt-14 scroll-mt-20">
        <H2 id="process" title="How it went" />
        <p>
          A good chunk of the time went into planning and research before any
          code. I hadn&apos;t worked with DKIM before, so I
          studied how domain verification is actually done in the wild instead
          of inventing my own scheme. And since the challenge read as
          product-oriented as it is technical, I spent real time just thinking
          about what a nice experience would look like.
        </p>
        <p>
          Development itself was mostly about getting the flows right and
          taking scale problems seriously: race conditions between the cron
          sweep and direct user actions, someone spamming domain creation, and
          the tricky cases like a domain changing owners. User notifications
          are sent with the Resend SDK, of course. Auth was the quick part:
          Next.js, Auth.js, magic links delivered through Resend.
        </p>
        <p>
          The UI came last. I&apos;m not a designer, and AI helped me a lot
          here, but the direction was mine: friendly and not intimidating.
          That&apos;s why the palette is soft and the copy reassures. The
          message I wanted the whole product to send: DNS changes are a pain
          for everyone, you&apos;re not alone, it&apos;s clunky and it takes a
          while. But don&apos;t worry, I&apos;ve got you.
        </p>
      </section>

      <section id="product" className="copy mt-14 scroll-mt-20">
        <H2 id="product" title="Product decisions" />
        <p>
          <strong>Why DKIM.</strong> I didn&apos;t know the standard before
          starting, which I treated as a reason to research harder, not a
          license to improvise. DKIM records are how products in this space
          actually verify domains, so that&apos;s what Inkwell verifies: it
          generates a real key pair and checks DNS for the real record.
        </p>
        <p>
          <strong>Domain takeovers.</strong> The hardest state transitions are
          the ownership edge cases. What happens when you buy a domain that a
          previous owner had registered here? Or when you own so many domains
          you forgot you&apos;d already added this one? The claim flow handles
          both with a two-step confirmation: the first attempt is sent without
          an <code>enforce</code> flag and fails with &ldquo;this domain is
          already registered&rdquo;, which catches the honest mistake. If
          taking it over really is the goal, the user confirms, the claim is
          re-sent with <code>enforce</code> set, and the previous owner is
          notified.
        </p>
        <p>
          <strong>Key rotation on takeover.</strong> Rotation exists to
          prevent a loop. If a domain&apos;s DNS ended up containing both
          parties&apos; keys, verification would ping-pong (&ldquo;I own
          it&rdquo;, &ldquo;no, I own it&rdquo;) with both sides technically
          correct. Rotating the keys guarantees that reclaiming a domain,
          whether by the previous owner, a teammate, or me, is always
          intentional: it requires actually updating DNS.
        </p>
        <p>
          <strong>Failing gracefully.</strong> Verified domains keep being
          monitored, and a record that stops resolving doesn&apos;t get
          instantly revoked: it starts a 24-hour grace period with a warning
          email partway through. The full ruleset is in the{" "}
          <a href="#transition" className="underline hover:text-foreground">
            state transition diagram
          </a>{" "}
          below.
        </p>
      </section>

      <section id="stack" className="copy mt-14 scroll-mt-20">
        <H2 id="stack" title="The stack" />
        <p>
          <strong>Next.js + React</strong> were comfort picks: I&apos;m
          familiar with them and they&apos;re easy to deploy.
        </p>
        <p>
          <strong>Hono + zod-openapi</strong> was not. On internal projects
          that live entirely in TypeScript, I prefer APIs that are natively
          typed end-to-end (tRPC, GraphQL, or plain server actions) and would
          normally skip REST unless I need it. I built a REST API here because
          a real product in this space
          would almost certainly offer a public API, and this stack keeps the
          types flowing through Zod schemas while producing an OpenAPI spec
          (and a Scalar reference page at <code>/api/reference</code>) for
          free.
        </p>
        <p>
          <strong>TanStack Query</strong> was the obvious choice for a page
          that polls verification state: caching, refetching, and sharing
          server state across components with almost no ceremony.{" "}
          <strong>Tailwind</strong> is just convenient, and AI handles it
          well.
        </p>
      </section>

      <section id="effect" className="copy mt-14 scroll-mt-20">
        <H2 id="effect" title="The Effect detour" />
        <p>
          If you dig through the commit history you&apos;ll notice the first
          version of the API was built with Effect, and then ported to Hono +
          Zod midway.
        </p>
        <p>
          The truth is I love Effect. I think it&apos;s amazing for building
          robust applications that behave exactly as you expect. To me,
          throwing and catching unpredictable errors is the biggest trap in
          any language that has them. But Effect creates friction for anyone
          not familiar with it, especially when the code is going to be
          reviewed. It shines in a team setting
          where everyone is on board, and a take-home is the opposite of that:
          the reviewers never opted in. Being understood was the biggest
          priority, so I stayed in a lane that&apos;s familiar for everyone.
          It&apos;s the same reason this document and the diagrams below
          exist, and why I made them as detailed as I could: to reduce that
          friction as much as possible.
        </p>
      </section>

      <section id="openspec" className="copy mt-14 scroll-mt-20">
        <H2 id="openspec" title="Spec-driven, with AI" />
        <p>
          OpenSpec is my favorite AI skill, and this project was built with
          it: plan and visualize an entire feature before writing the code, or
          before asking AI to write it. It&apos;s a game changer for me. I
          like Kiro too, but Kiro is an entire IDE, and OpenSpec sets up in
          your existing workflow no matter what you use.
        </p>
        <p>
          Just as valuable: the spec history lives in the repo (see{" "}
          <code>openspec/</code>), where every archived change documents what
          was built and why, useful to humans and AI alike.
        </p>
      </section>

      <section id="how-it-works" className="copy mt-14 scroll-mt-20">
        <H2 id="how-it-works" title="How it works" />
        <p>
          The rest is the system itself: how a domain goes from created to
          verified, every state, check, and notification, drawn as state
          diagrams. Blue nodes are links between graphs.
        </p>
      </section>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-14 scroll-mt-20">
          <H2 id={s.id} title={s.title} />
          <p className="mt-2 text-muted">{s.intro}</p>
          <div className="mt-6 overflow-x-auto">
            <Diagrams>{s.graph}</Diagrams>
          </div>
        </section>
      ))}

      <section id="hindsight" className="copy mt-14 scroll-mt-20">
        <H2 id="hindsight" title="Hindsight" />
        <h3 className="mt-8 font-semibold text-foreground">
          If I started over
        </h3>
        <p>
          The main thing I&apos;d call naive: I built everything to solve the
          stated goal, proving domain ownership. In real life the question is
          &ldquo;proving domain ownership <em>for what</em>?&rdquo; For email
          setup, the natural next step is more DNS checks beyond DKIM, and the
          project isn&apos;t really structured for a growing family of checks.
          It wouldn&apos;t be a huge change to get there, but I wish I&apos;d
          considered it from the beginning.
        </p>
        <h3 className="mt-8 font-semibold text-foreground">
          If this were a real project
        </h3>
        <p>
          I&apos;d replace the cron with real background-job infrastructure:
          something like Temporal, or even a simple queue like BullMQ. The
          cron is okay, but there are better ways to manage background work.
          Temporal in particular would make it much easier to avoid race
          conditions, queue the work that isn&apos;t user-facing, and throttle
          things. I think a more mature project would go in that direction
          instead of a cron job.
        </p>
        <h3 className="mt-8 font-semibold text-foreground">
          What I&apos;m proud of
        </h3>
        <p>
          Honestly, no single thing. What I like is the whole: it isn&apos;t a
          real product, but to the extent that&apos;s possible, it feels like
          one. There&apos;s a story the user follows.
        </p>
      </section>
    </article>
  );
}
