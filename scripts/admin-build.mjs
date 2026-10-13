import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
let sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || "";
if (!sha) {
  try {
    sha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    /* Docker build may omit Git metadata. */
  }
}
await mkdir("dist/admin", { recursive: true });
await writeFile(
  "dist/admin/build.json",
  JSON.stringify({ sha, builtAt: new Date().toISOString() })
);
