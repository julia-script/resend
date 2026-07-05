"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  type DnsMockResponse,
  DnsMockResponseErrorSchema,
  dkimRecordValue,
} from "@/shared/domain";
import { timeAgo } from "../domains/[id]/StatusHeader";
import { getMockDomains, type MockDomain, updateMockDomain } from "./actions";

const errorCodes = DnsMockResponseErrorSchema.options.map((o) => o.value);
type Mode = "success" | (typeof errorCodes)[number];

const inputClass =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-foreground";

export const MocksClient = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ["mock-domains"],
    queryFn: getMockDomains,
    refetchInterval: 3000,
  });

  if (isPending) return <p className="mt-8 text-sm text-muted">Loading…</p>;
  if (error)
    return (
      <p className="mt-8 text-sm text-peach-foreground">
        Failed to load mock domains: {error.message}
      </p>
    );
  if (data.length === 0)
    return (
      <p className="mt-8 text-sm text-muted">
        No mock domains yet. Add a domain with{" "}
        <code className="font-mono text-xs">mock</code> as one of its labels
        (e.g. <code className="font-mono text-xs">foo.mock.test</code>) and it
        will show up here.
      </p>
    );

  return (
    <div className="mt-8 flex flex-col gap-4">
      {data.map((domain) => (
        <MockCard key={domain.id} domain={domain} />
      ))}
    </div>
  );
};

/** Lifecycle fields, raw and only when set — this is a dev console. */
const Facts = ({ domain }: { domain: MockDomain }) => {
  const inGrace =
    domain.status === "verified" && domain.gracePeriodStartedAt !== null;
  const facts = [
    domain.statusReason && {
      label: "Status reason",
      value: domain.statusReason,
      alert: true,
    },
    domain.verifiedAt && {
      label: "Verified",
      value: domain.verifiedAt.toLocaleString(),
    },
    domain.deadlineAt && {
      label: "Deadline",
      value: domain.deadlineAt.toLocaleString(),
    },
    domain.gracePeriodStartedAt && {
      label: "Grace period since",
      value: domain.gracePeriodStartedAt.toLocaleString(),
      alert: inGrace,
    },
    domain.gracePeriodWarningSentAt && {
      label: "Grace warning sent",
      value: domain.gracePeriodWarningSentAt.toLocaleString(),
      alert: inGrace,
    },
  ].filter((f) => !!f);

  if (facts.length === 0) return null;
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline gap-1.5">
          <dt className="text-muted">{fact.label}</dt>
          <dd
            className={`font-mono ${fact.alert ? "text-peach-foreground" : ""}`}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const MockCard = ({ domain }: { domain: MockDomain }) => {
  const queryClient = useQueryClient();
  const mock = domain.dnsMockRecord;
  const [mode, setMode] = useState<Mode>(
    mock?.type === "success" ? "success" : (mock?.error ?? "ENODATA"),
  );
  const [value, setValue] = useState(
    mock?.type === "success" ? mock.value.join("\n") : "",
  );
  const update = useMutation({
    mutationFn: (record: DnsMockResponse) =>
      updateMockDomain(domain.id, record),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["mock-domains"] }),
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <h2 className="font-semibold tracking-tight">{domain.name}</h2>
        <StatusBadge
          status={domain.status}
          pulse={domain.status === "in_progress"}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        Selector <code className="font-mono">{domain.selector}</code>
        {domain.nextCheckAt && (
          <span title={domain.nextCheckAt.toLocaleString()}>
            {` · Next check ${timeAgo(domain.nextCheckAt.getTime())}`}
          </span>
        )}
      </p>
      <Facts domain={domain} />

      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            mode === "success"
              ? {
                  type: "success",
                  value: value
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }
              : { type: "failure", error: mode },
          );
        }}
      >
        <label
          className="text-xs font-medium text-muted"
          htmlFor={`mock-mode-${domain.id}`}
        >
          DNS answer
        </label>
        <select
          id={`mock-mode-${domain.id}`}
          className={inputClass}
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          <option value="success">Success (TXT records)</option>
          {errorCodes.map((code) => (
            <option key={code} value={code}>
              Failure: {code}
            </option>
          ))}
        </select>

        {mode === "success" && (
          <>
            <textarea
              className={`${inputClass} min-h-20 font-mono text-xs`}
              placeholder="One TXT record per line"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button
              type="button"
              className="self-start text-xs text-muted hover:text-foreground hover:underline"
              onClick={() => setValue(dkimRecordValue(domain))}
            >
              Fill with this domain&apos;s valid DKIM record
            </button>
          </>
        )}

        <div className="mt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-mint px-3 py-1.5 text-sm font-medium text-mint-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            Apply &amp; recheck
          </button>
          {update.isError && (
            <span className="text-xs text-peach-foreground">
              {update.error.message}
            </span>
          )}
        </div>
      </form>

      {domain.checkLog.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-medium text-muted">Recent checks</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {domain.checkLog
              .slice(-5)
              .reverse()
              .map((entry) => (
                <li
                  key={entry.checkedAt}
                  className="flex items-baseline gap-2 text-xs"
                >
                  <span
                    className={
                      entry.status === "ok"
                        ? "text-mint-foreground"
                        : entry.status === "failed"
                          ? "text-peach-foreground"
                          : "text-muted"
                    }
                  >
                    {entry.status}
                    {"reason" in entry ? `: ${entry.reason}` : ""}
                  </span>
                  <span className="text-muted">{timeAgo(entry.checkedAt)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
