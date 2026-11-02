// The stdio bridge: what an MCP client config runs (`npx -y datahacks-mcp`).
//
// It hands everything to mcp-remote, the maintained stdio <-> Streamable HTTP
// proxy that also does the OAuth sign-in (it opens the browser and keeps the
// tokens in ~/.mcp-auth), with DataHacks' server address filled in. stdout
// belongs to the MCP protocol, so anything this file says goes to stderr.

import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** The path of mcp-remote's proxy script, from its installed package.json. */
export function mcpRemoteBin() {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve("mcp-remote/package.json");
  const { bin } = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const relative = typeof bin === "string" ? bin : bin["mcp-remote"];
  return path.join(path.dirname(manifest), relative);
}

/** mcp-remote's arguments: our server, Streamable HTTP only (the server has no SSE endpoint). */
export function bridgeArgs(url, { debug = false } = {}) {
  return [url, "--transport", "http-only", ...(debug ? ["--debug"] : [])];
}

/** Runs mcp-remote in this process's stdio and resolves with its exit code. */
export function runBridge(url, { debug = false, spawnFn = spawn, bin = mcpRemoteBin() } = {}) {
  const child = spawnFn(process.execPath, [bin, ...bridgeArgs(url, { debug })], { stdio: "inherit" });
  const forward = signal => () => child.kill(signal);
  const handlers = ["SIGINT", "SIGTERM", "SIGHUP"].map(signal => [signal, forward(signal)]);
  for (const [signal, handler] of handlers) process.on(signal, handler);
  return new Promise(resolve => {
    child.on("error", error => {
      process.stderr.write(`datahacks-mcp: couldn't start mcp-remote: ${error.message}\n`);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      for (const [sig, handler] of handlers) process.off(sig, handler);
      resolve(code ?? (signal ? 128 + (signalNumber[signal] ?? 1) : 1));
    });
  });
}

const signalNumber = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
