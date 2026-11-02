import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ConfigError, backup, isOurEntry, planAdd, readConfig, withEntry, withoutEntry, writeConfig } from "../src/config.js";

const ENTRY = { command: "npx", args: ["-y", "datahacks-mcp"] };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "datahacks-mcp-config-"));

test("a missing file reads as an empty config", () => {
  assert.deepEqual(readConfig(path.join(tmp(), "nope.json")), { exists: false, data: {} });
});

test("empty and BOM-prefixed files read", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "empty.json"), "  \n");
  assert.deepEqual(readConfig(path.join(dir, "empty.json")).data, {});
  fs.writeFileSync(path.join(dir, "bom.json"), '﻿{"a":1}');
  assert.deepEqual(readConfig(path.join(dir, "bom.json")).data, { a: 1 });
});

test("invalid JSON, a non-object, or a bad mcpServers is refused", () => {
  const dir = tmp();
  for (const [name, text] of [["bad.json", "{ nope"], ["array.json", "[]"], ["servers.json", '{"mcpServers": []}']]) {
    fs.writeFileSync(path.join(dir, name), text);
    assert.throws(() => readConfig(path.join(dir, name)), ConfigError, name);
  }
});

test("planAdd: add, same (whatever the key order), conflict", () => {
  assert.equal(planAdd({}, ENTRY).status, "add");
  assert.equal(planAdd({ mcpServers: { other: {} } }, ENTRY).status, "add");
  assert.equal(planAdd({ mcpServers: { datahacks: { args: ["-y", "datahacks-mcp"], command: "npx" } } }, ENTRY).status, "same");
  const conflict = planAdd({ mcpServers: { datahacks: { url: "https://elsewhere.example/mcp" } } }, ENTRY);
  assert.equal(conflict.status, "conflict");
  assert.deepEqual(conflict.existing, { url: "https://elsewhere.example/mcp" });
});

test("withEntry and withoutEntry keep every other setting and server", () => {
  const data = { theme: "dark", mcpServers: { github: { command: "gh-mcp" } }, globalShortcut: "Ctrl+Space" };
  const added = withEntry(data, ENTRY);
  assert.deepEqual(added, { ...data, mcpServers: { github: { command: "gh-mcp" }, datahacks: ENTRY } });
  assert.deepEqual(data.mcpServers, { github: { command: "gh-mcp" } }, "input not mutated");
  assert.deepEqual(withoutEntry(added), data);
  assert.equal(withoutEntry(data), data);
});

test("isOurEntry", () => {
  assert.ok(isOurEntry(ENTRY, "datahacks-mcp"));
  assert.ok(isOurEntry({ command: "cmd", args: ["/c", "npx", "-y", "datahacks-mcp", "--staging"] }, "datahacks-mcp"));
  assert.ok(isOurEntry({ command: "npx", args: ["datahacks-mcp@0.1.0"] }, "datahacks-mcp"));
  assert.ok(!isOurEntry({ command: "npx", args: ["-y", "datahacks-mcp-evil"] }, "datahacks-mcp"));
  assert.ok(!isOurEntry({ url: "https://x" }, "datahacks-mcp"));
  assert.ok(!isOurEntry(null, "datahacks-mcp"));
});

test("backup copies next to the file with a timestamp and never overwrites an earlier backup", () => {
  const dir = tmp();
  const file = path.join(dir, "mcp.json");
  fs.writeFileSync(file, '{"a":1}');
  const now = new Date("2026-11-01T12:34:56.789Z");
  const first = backup(file, now);
  assert.equal(first, `${file}.bak-20261101T123456Z`);
  fs.writeFileSync(file, '{"a":2}');
  const second = backup(file, now);
  assert.equal(second, `${file}.bak-20261101T123456Z-2`);
  assert.equal(fs.readFileSync(first, "utf8"), '{"a":1}');
  assert.equal(fs.readFileSync(second, "utf8"), '{"a":2}');
});

test("writeConfig creates folders, writes 2-space JSON with a newline, leaves no temp file", () => {
  const dir = tmp();
  const file = path.join(dir, "deep", "er", "mcp.json");
  writeConfig(file, { mcpServers: { datahacks: ENTRY } });
  assert.equal(fs.readFileSync(file, "utf8"), `${JSON.stringify({ mcpServers: { datahacks: ENTRY } }, null, 2)}\n`);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ["mcp.json"]);
});
