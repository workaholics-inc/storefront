// `pnpm dev:mock`: a Prism mock API from the contract plus `next dev` pointed at it.
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => resolve(root, "node_modules/.bin", name);
const mockPort = 4010;

const children = [
  spawn(
    bin("prism"),
    ["mock", "contract/openapi.json", "--host", "127.0.0.1", "--port", String(mockPort)],
    { cwd: root, stdio: "inherit" },
  ),
  spawn(bin("next"), ["dev"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PLATFORM_URL: `http://127.0.0.1:${mockPort}`,
      // A public placeholder for mock mode, not a secret.
      STOREFRONT_API_KEY: "mock-storefront-key-not-a-secret-000000",
    },
  }),
];

let exitCode;
function stopAll(signal = "SIGTERM") {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    exitCode ??= code ?? (signal ? 1 : 0);
    stopAll();
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) {
      process.exit(exitCode);
    }
  });
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
