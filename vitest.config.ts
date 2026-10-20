import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Maintainers' rule: vitest uses at most 2 cores on the shared machine, however
// many runs are going. `maxWorkers` bounds one run; on Linux every run also
// pins itself to cores 0 and 1 here, so runs started at the same time share
// those two cores instead of adding up. The workers start after this file
// loads, so they inherit the pin.
if (process.platform === "linux") {
  try {
    execFileSync(
      "taskset",
      ["--all-tasks", "--cpu-list", "--pid", "0,1", String(process.pid)],
      { stdio: "ignore" },
    );
  } catch {
    console.warn(
      "vitest: taskset is unavailable, so this run is not pinned to 2 cores",
    );
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    maxWorkers: 2,
    server: { deps: { inline: ["next-intl"] } },
  },
});
