"use client";

import { useSession } from "@/hooks/session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { up } from "up-fetch";
import { z } from "zod";
import { type PartialDomain, PartialDomainSchema } from "@/db/validationschemas";

const api = up(fetch, () => ({
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
}));

const statusStyles: Record<
  PartialDomain["status"],
  { label: string; className: string }
> = {
  not_started: { label: "Not started", className: "bg-border text-muted" },
  pending: { label: "Pending", className: "bg-accent text-accent-foreground" },
  verified: { label: "Verified", className: "bg-mint text-mint-foreground" },
  failed: { label: "Failed", className: "bg-peach text-peach-foreground" },
  temporary_failure: {
    label: "Temporary failure",
    className: "bg-peach text-peach-foreground",
  },
};

const StatusBadge = ({ status }: { status: PartialDomain["status"] }) => {
  const { label, className } = statusStyles[status];
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
};

const CreateDomain = () => {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: { name: string; enforce: boolean }) =>
      api("/api/domains", { method: "POST", body: data }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
  });
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            mutation.mutate({ name: name.trim(), enforce: false });
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent-foreground/40"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !name.trim()}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {mutation.isPending ? "Adding…" : "Add domain"}
        </button>
      </form>
      {mutation.isError && (
        <p className="mt-2 text-xs text-peach-foreground">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Something went wrong."}
        </p>
      )}
    </div>
  );
};

export const Domains = () => {
  const { data: session } = useSession();

  const { data, error, isPending } = useQuery({
    queryKey: ["domains"],
    queryFn: () =>
      api("/api/domains", {
        schema: z.object({ data: z.array(PartialDomainSchema) }),
      }),
    enabled: !!session,
  });
  const domains = data?.data;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-soft sm:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your domains</h2>
        {domains && (
          <span className="text-xs text-muted">
            {domains.length} {domains.length === 1 ? "domain" : "domains"}
          </span>
        )}
      </div>
      <div className="mt-4">
        <CreateDomain />
      </div>
      <div className="mt-4">
        {isPending && <p className="text-sm text-muted">Loading domains…</p>}
        {error && (
          <p className="text-sm text-peach-foreground">
            Couldn’t load domains. Try refreshing.
          </p>
        )}
        {domains?.length === 0 && (
          <p className="text-sm text-muted">
            No domains yet. Add one above to start sending.
          </p>
        )}
        {domains && domains.length > 0 && (
          <ul className="divide-y divide-border">
            {domains.map((domain) => (
              <li
                key={domain.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{domain.name}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted">
                    {domain.selector}._domainkey.{domain.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-muted sm:inline">
                    {domain.createdAt.toLocaleDateString()}
                  </span>
                  <StatusBadge status={domain.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
