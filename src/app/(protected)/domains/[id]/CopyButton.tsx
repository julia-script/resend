"use client";
import { useState } from "react";
import { strings } from "@/lib/strings";

export const CopyButton = ({ value }: { value: string }) => {
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
      {copied ? strings.copy.copied : strings.copy.idle}
    </button>
  );
};
