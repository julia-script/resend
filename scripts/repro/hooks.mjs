// Module resolution shim so the reproduction script can import the real
// application modules unchanged, outside of Next's bundler:
//   - "@/x"        -> <repo>/src/x   (the tsconfig path alias)
//   - "server-only"-> an empty module (its default export throws in plain Node)
//   - "resend"     -> a no-op stub    (the race is in the DB, not in email I/O;
//                     this only prevents an outbound HTTPS call to Resend)
// Everything else (DKIM check, DB writes, the cron handler, verifyDomain,
// supersedeOthers) is the real, unmodified code.
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = pathResolve(here, "..", "..");
const srcRoot = pathResolve(repoRoot, "src");

const resolveWithExt = (base) => {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    pathResolve(base, "index.ts"),
    pathResolve(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return `${base}.ts`;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: pathToFileURL(
          pathResolve(repoRoot, "node_modules/server-only/empty.js"),
        ).href,
        shortCircuit: true,
      };
    }
    if (specifier === "resend") {
      return {
        url: pathToFileURL(pathResolve(here, "resend-stub.mjs")).href,
        shortCircuit: true,
      };
    }
    if (specifier.startsWith("@/")) {
      const target = resolveWithExt(pathResolve(srcRoot, specifier.slice(2)));
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
