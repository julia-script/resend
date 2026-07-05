"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { PartialDomainSchema } from "@/db/validationschemas";
import { StatusBadge } from "@/components/StatusBadge";

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-80"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-xs font-medium text-muted">{label}</p>
    <div className="mt-1 flex items-start gap-2">
      <code className="min-w-0 break-all rounded-md bg-background px-2 py-1 font-mono text-xs">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  </div>
);

export default function DomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, isPending } = useQuery({
    queryKey: ["domains", id],
    queryFn: () =>
      api(`/api/domains/${id}`, {
        schema: z.object({ data: PartialDomainSchema }),
      }),
  });
  const domain = data?.data;

  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: () => api(`/api/domains/${id}/verify`, { method: "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["domains", id] }),
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Domains
      </Link>

      {isPending && <p className="mt-8 text-sm text-muted">Loading domain…</p>}
      {error && (
        <p className="mt-8 text-sm text-peach-foreground">
          Domain not found, or you don’t have access to it.
        </p>
      )}

      {domain && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {domain.name}
            </h1>
            <StatusBadge status={domain.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Added {domain.createdAt.toLocaleDateString()}
            {domain.verifiedAt &&
              ` · Verified ${domain.verifiedAt.toLocaleDateString()}`}
          </p>

          <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-sm font-semibold">DNS record</h2>
            <p className="mt-1 text-sm text-muted">
              Add this TXT record to your DNS provider to verify the domain.
            </p>
            <div className="mt-4 grid gap-4">
              <Field
                label="Name"
                value={`${domain.selector}._domainkey.${domain.name}`}
              />
              <Field
                label="Value"
                value={`v=DKIM1; k=rsa; p=${domain.publicKey}`}
              />
            </div>
            {domain.status !== "verified" && (
              <div className="mt-5 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => verify.mutate()}
                  disabled={verify.isPending}
                  className="rounded-md bg-mint px-3 py-1.5 text-sm font-medium text-mint-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {verify.isPending
                    ? "Starting verification…"
                    : "I’ve added the record — verify"}
                </button>
                {verify.isError && (
                  <p className="mt-2 text-xs text-peach-foreground">
                    Couldn’t start verification. Try again.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
