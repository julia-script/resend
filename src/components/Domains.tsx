"use client";

import Link from "next/link";
import { useState } from "react";
import { isNameTakenError, useCreateDomain, useDomains } from "@/hooks/domains";
import { strings } from "@/lib/strings";
import { dkimRecordName } from "@/shared/domain";
import { StatusBadge } from "./StatusBadge";

const CreateDomain = () => {
  const [name, setName] = useState("");
  const mutation = useCreateDomain();
  // The exact name the 409 was for, so confirming claims what was submitted.
  const takenName = isNameTakenError(mutation.error)
    ? mutation.variables?.name
    : undefined;
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
          placeholder={strings.domainList.placeholder}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent-foreground/40"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !name.trim()}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {mutation.isPending
            ? strings.domainList.adding
            : strings.domainList.add}
        </button>
      </form>
      {takenName ? (
        <div className="mt-2 rounded-md bg-peach px-3 py-2 text-xs text-peach-foreground">
          <p>
            <strong>{takenName}</strong> {strings.domainList.claimWarning}
          </p>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { name: takenName, enforce: true },
                { onSuccess: () => setName("") },
              )
            }
            className="mt-2 rounded-md bg-peach-foreground px-2 py-1 font-medium text-peach transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {mutation.isPending
              ? strings.domainList.claiming
              : strings.domainList.claim}
          </button>
        </div>
      ) : (
        mutation.isError && (
          <p className="mt-2 text-xs text-peach-foreground">
            {mutation.error instanceof Error
              ? mutation.error.message
              : strings.domainList.genericError}
          </p>
        )
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
        <h2 className="text-sm font-semibold">{strings.domainList.title}</h2>
        {domains && (
          <span className="text-xs text-muted">
            {strings.domainList.count(domains.length)}
          </span>
        )}
      </div>
      <div className="mt-4">
        <CreateDomain />
      </div>
      <div className="mt-4">
        {isPending && (
          <p className="text-sm text-muted">{strings.domainList.loading}</p>
        )}
        {error && (
          <p className="text-sm text-peach-foreground">
            {strings.domainList.loadError}
          </p>
        )}
        {domains?.length === 0 && (
          <p className="text-sm text-muted">{strings.domainList.empty}</p>
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
                      {dkimRecordName(domain)}
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
