// `pnpm dev:mock`: a Prism mock API from the contract, a stand-in for Telegram's
// authorization page, and `next dev` pointed at both.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => resolve(root, "node_modules/.bin", name);
const mockPort = 4010;
const telegramPort = 4011;
const siteOrigin = "http://localhost:3000";

// Stands in for Telegram's authorization endpoint: approves at once and sends
// the browser back to the site's own callback, and only to the local site.
const telegramServer = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${telegramPort}`);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";

  if (request.method !== "GET" || url.pathname !== "/auth") {
    response.writeHead(404).end();
    return;
  }
  if (!redirectUri.startsWith(`${siteOrigin}/`)) {
    response.writeHead(400, { "content-type": "text/plain" }).end("bad redirect_uri");
    return;
  }

  const back = new URL(redirectUri);
  back.searchParams.set("code", "mock-code");
  back.searchParams.set("state", url.searchParams.get("state") ?? "");
  response.writeHead(302, { location: back.toString() }).end();
});

// The server joins the children list through this small stand-in for a
// child process, so one Ctrl-C stops everything and frees every port.
const exitHandlers = [];
const telegram = {
  exitCode: null,
  signalCode: null,
  on(event, handler) {
    if (event === "exit") exitHandlers.push(handler);
  },
  kill() {
    telegramServer.close();
    telegramServer.closeAllConnections();
  },
};
function telegramExited(code) {
  if (telegram.exitCode !== null) return;
  telegram.exitCode = code;
  for (const handler of exitHandlers) handler(code, null);
}
telegramServer.on("close", () => telegramExited(0));
telegramServer.on("error", (error) => {
  console.error(`telegram mock: ${error.message}`);
  telegramExited(1);
});
telegramServer.listen(telegramPort, "127.0.0.1");

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
      // Public placeholders for mock mode, not secrets.
      SITE_URL: siteOrigin,
      TELEGRAM_CLIENT_ID: "123456",
      TELEGRAM_AUTHORIZE_URL: `http://127.0.0.1:${telegramPort}/auth`,
    },
  }),
  telegram,
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
