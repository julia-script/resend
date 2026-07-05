"use client";
import { CopyButton } from "./CopyButton";

export const Field = ({ label, value }: { label: string; value: string }) => (
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
