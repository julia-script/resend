import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDomainById } from "@/db/domains";
import { detectDnsProvider } from "@/domain/detectprovider";
import { auth } from "@/lib/auth/handlers";
import { strings } from "@/lib/strings";
import { dkimRecordName, dkimRecordValue } from "@/shared/domain";
import { DnsGuide, ProviderHint } from "./DnsGuide";
import { Field } from "./Field";
import { RemoveButton } from "./RemoveButton";
import { SetupSteps } from "./SetupSteps";
import { StatusHeader } from "./StatusHeader";
import { VerifyControls } from "./VerifyControls";

export default async function DomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/signin");
  const domain = await getDomainById(id);
  // Foreign and unknown ids look identical: no domain enumeration.
  if (!domain || domain.userId !== session.user.id) notFound();

  const detected = await detectDnsProvider(domain.name);
  const provider =
    detected.confidence === "low" ? undefined : detected.provider;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        {strings.domainPage.back}
      </Link>

      <StatusHeader id={domain.id} initialData={domain} />

      <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {strings.domainPage.dnsCardTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {strings.domainPage.dnsCardIntro}
            </p>
          </div>
          <VerifyControls id={domain.id} initialData={domain} />
        </div>
        <div className="mt-4 grid gap-4">
          <Field
            label={strings.domainPage.nameLabel}
            value={dkimRecordName(domain)}
          />
          <Field
            label={strings.domainPage.valueLabel}
            value={dkimRecordValue(domain)}
          />
        </div>
        <ProviderHint provider={provider} />
        <SetupSteps id={domain.id} initialData={domain} />
        <DnsGuide provider={provider} />
      </div>

      <div className="mt-8">
        <RemoveButton id={domain.id} name={domain.name} />
      </div>
    </main>
  );
}
