"use client";
import Image from "next/image";
import { useDomain } from "@/hooks/domains";
import { strings } from "@/lib/strings";
import type { PartialDomain } from "@/shared/domain";

// Illustrated 3-step setup story, shown only before verification starts.
// Shares the polled domain query with the other islands so it disappears
// the moment the user kicks off verification.
export const SetupSteps = ({
  id,
  initialData,
}: {
  id: string;
  initialData: PartialDomain;
}) => {
  const { data } = useDomain(id, initialData);
  const domain = data?.data ?? initialData;
  if (domain.status !== "not_started") return null;

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {strings.setupSteps.map((step, i) => (
        <div
          key={step.title}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft"
        >
          {/* relative lifts the text above the image pulled up behind it */}
          <div className="relative p-4 text-center sm:text-left">
            <p className="flex items-start justify-center gap-2 text-sm font-medium sm:justify-start">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                {i + 1}
              </span>
              {step.title}
            </p>
            {step.subtitle && (
              <p className="mt-1.5 text-xs text-muted">{step.subtitle}</p>
            )}
          </div>
          {/* mt-auto keeps the image bottom-flush; the negative margin
              tucks its (transparent) top under the text block above. */}
          <div className="mt-auto">
            <Image
              src={`/panel-${i + 1}.png`}
              alt=""
              width={1014}
              height={1312}
              className="w-full sm:-mt-10"
            />
          </div>
        </div>
      ))}
    </div>
  );
};
