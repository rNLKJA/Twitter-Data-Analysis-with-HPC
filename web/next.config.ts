import { execSync } from "node:child_process";

import type { NextConfig } from "next";

/**
 * The commit the "Source" links on /methods point at. Docs only exist on
 * GitHub from this branch's commits on, so linking to a fixed commit keeps
 * the links working whether or not the branch has been merged into main.
 * Order: SOURCE_REF (set with `vercel deploy --build-env`), Vercel's own
 * commit SHA (Git deployments), the local checkout, then "main".
 */
function sourceRef(): string {
  const fromEnv = process.env.SOURCE_REF || process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "main";
  }
}

const nextConfig: NextConfig = {
  // No need to advertise the framework in response headers.
  poweredByHeader: false,
  env: { NEXT_PUBLIC_SOURCE_REF: sourceRef() },
};

export default nextConfig;
