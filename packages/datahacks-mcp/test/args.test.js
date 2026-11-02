import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageError, parseArgs, serverArgs, serverUrl } from "../src/args.js";
import { PRODUCTION_URL, STAGING_URL } from "../src/constants.js";

test("no arguments runs the bridge against production", () => {
  const options = parseArgs([]);
  assert.equal(options.command, "bridge");
  assert.equal(serverUrl(options), PRODUCTION_URL);
  assert.deepEqual(serverArgs(options), []);
});

test("commands and flags", () => {
  assert.equal(parseArgs(["install"]).command, "install");
  assert.equal(parseArgs(["uninstall", "--yes"]).yes, true);
  assert.equal(parseArgs(["install", "-y", "--dry-run"]).dryRun, true);
  assert.equal(parseArgs(["--help"]).command, "help");
  assert.equal(parseArgs(["install", "-h"]).command, "help");
  assert.equal(parseArgs(["--version"]).command, "version");
  assert.equal(parseArgs(["-v"]).command, "version");
  assert.equal(parseArgs(["--debug"]).debug, true);
  assert.deepEqual(parseArgs(["install", "--only", "cursor,claude-code"]).only, ["cursor", "claude-code"]);
  assert.deepEqual(parseArgs(["install", "--only=claude-desktop"]).only, ["claude-desktop"]);
});

test("--staging and --url pick the server and are passed back into client configs", () => {
  const staging = parseArgs(["--staging"]);
  assert.equal(serverUrl(staging), STAGING_URL);
  assert.deepEqual(serverArgs(staging), ["--staging"]);
  const local = parseArgs(["install", "--url", "http://127.0.0.1:54321/functions/v1/mcp"]);
  assert.equal(serverUrl(local), "http://127.0.0.1:54321/functions/v1/mcp");
  assert.deepEqual(serverArgs(local), ["--url", "http://127.0.0.1:54321/functions/v1/mcp"]);
  assert.equal(serverUrl(parseArgs(["--url=https://example.com/mcp"])), "https://example.com/mcp");
});

test("bad input is a usage error", () => {
  for (const argv of [
    ["--bogus"],
    ["frobnicate"],
    ["install", "uninstall"],
    ["--url"],
    ["--url", "--yes"],
    ["--url", "not a url"],
    ["--url", "http://example.com/mcp"],
    ["--url", "https://user:pw@example.com/mcp"],
    ["--url", "https://example.com/mcp?x=1&y=2"],
    ["--url", "https://example.com/mcp#frag"],
    ["--staging", "--url", "https://example.com/mcp"],
    ["install", "--only", "vscode"],
    ["install", "--only", ","],
  ]) {
    assert.throws(() => parseArgs(argv), UsageError, argv.join(" "));
  }
});
