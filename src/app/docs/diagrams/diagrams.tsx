"use client";
import mermaid from "mermaid";
import elkLayouts from "@mermaid-js/layout-elk";

import { useEffect, useId, useState } from "react";

mermaid.registerLayoutLoaders(elkLayouts);
mermaid.initialize({ startOnLoad: false, theme: "neutral" }); // global defaults

export function Diagrams({ children, name }: { children: string, name?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    mermaid
      .render(`mermaid-${id}`, children.trim())
      .then((result) => setSvg(result.svg))
      .catch(console.error);
  }, [children, id]);
  if (!svg) return null;
  return <div id={name} className="diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
