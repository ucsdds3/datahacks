import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { bridgeArgs, mcpRemoteBin, runBridge } from "../src/bridge.js";
import { PRODUCTION_URL } from "../src/constants.js";

const BIN = fileURLToPath(new URL("../bin/datahacks-mcp.js", import.meta.url));

test("finds mcp-remote's proxy script", () => {
  const bin = mcpRemoteBin();
  assert.match(bin, /mcp-remote[\\/]dist[\\/]proxy\.js$/);
  assert.ok(fs.existsSync(bin));
});

test("hands mcp-remote the server URL, Streamable HTTP only", () => {
  assert.deepEqual(bridgeArgs(PRODUCTION_URL), [PRODUCTION_URL, "--transport", "http-only"]);
  assert.deepEqual(bridgeArgs(PRODUCTION_URL, { debug: true }), [PRODUCTION_URL, "--transport", "http-only", "--debug"]);
});

test("runs it with this Node, on this process's stdio, and passes its exit code back", async () => {
  const calls = [];
  const spawnFn = (file, args, opts) => {
    calls.push({ file, args, opts });
    const child = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => child.emit("exit", 3, null));
    return child;
  };
  const code = await runBridge(PRODUCTION_URL, { spawnFn, bin: "/x/proxy.js" });
  assert.equal(code, 3);
  assert.deepEqual(calls, [{ file: process.execPath, args: ["/x/proxy.js", PRODUCTION_URL, "--transport", "http-only"], opts: { stdio: "inherit" } }]);
});

test("the CLI: --help, --version, a bad flag, and install refusing to guess without a terminal", () => {
  const run = args => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", input: "" });
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /npx -y datahacks-mcp install/);
  assert.doesNotMatch(help.stdout, /--staging|--url/, "testing flags stay out of --help");
  const version = run(["--version"]);
  assert.equal(version.stdout.trim(), JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
  assert.equal(run(["--bogus"]).status, 2);
  const install = run(["install"]);
  assert.equal(install.status, 2);
  assert.match(install.stderr, /--yes/);
});
