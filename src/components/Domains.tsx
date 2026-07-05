"use client";

import Link from "next/link";
import { useState } from "react";
import { useCreateDomain, useDomains } from "@/hooks/domains";
import { StatusBadge } from "./StatusBadge";

const CreateDomain = () => {
  const [name, setName] = useState("");
  const mutation = useCreateDomain();
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            mutation.mutate(
              { name: name.trim(), enforce: false },
              { onSuccess: () => setName("") },
            );
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
  const { data, error, isPending } = useDomains();
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
              <li key={domain.id}>
                <Link
                  href={`/domains/${domain.id}`}
                  className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {domain.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {domain.selector}._domainkey.{domain.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted sm:inline">
                      {domain.createdAt.toLocaleDateString()}
                    </span>
                    <StatusBadge status={domain.status} />
                    <span aria-hidden className="text-muted">
                      ›
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
