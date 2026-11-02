import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseArgs } from "../src/args.js";
import { PRODUCTION_URL, STAGING_URL } from "../src/constants.js";
import { install, uninstall } from "../src/install.js";
import { bridgeEntry, findExecutable, jsonClients } from "../src/clients.js";

const ENTRY = { command: "npx", args: ["-y", "datahacks-mcp"] };
const plain = s => s;

/**
 * A fake computer in a temp folder: nothing here touches the real home folder.
 * `claude`: false for no Claude Code CLI, or what `claude mcp get datahacks` prints (null: not set up).
 */
function machine({ platform = process.platform === "win32" ? "win32" : "darwin", answers = [], claude = false, claudeAddFails = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "datahacks-mcp-home-"));
  const bin = path.join(home, "bin");
  fs.mkdirSync(bin);
  if (claude !== false) {
    fs.writeFileSync(path.join(bin, platform === "win32" ? "claude.exe" : "claude"), "#!/bin/sh\n", { mode: 0o755 });
  }
  const env = { PATH: bin, APPDATA: path.join(home, "AppData", "Roaming"), PATHEXT: ".EXE;.CMD" };
  const lines = [];
  const runs = [];
  const asked = [];
  const ctx = {
    platform, home, env, nodeVersion: "v22.0.0", interactive: true,
    now: () => new Date("2026-11-01T12:00:00Z"),
    out: (line = "") => lines.push(line),
    ask: async question => { asked.push(question); return answers.length ? answers.shift() : true; },
    run: (file, args) => {
      runs.push(args);
      if (args[1] === "get") return claude === null ? { status: 1, stdout: "", stderr: "No MCP server found" } : { status: 0, stdout: claude, stderr: "" };
      if (args[1] === "add" && claudeAddFails) return { status: 1, stdout: "", stderr: "boom" };
      return { status: 0, stdout: "", stderr: "" };
    },
    style: { bold: plain, dim: plain, green: plain, yellow: plain, red: plain },
  };
  const paths = {
    claudeDesktop: platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : platform === "win32"
        ? path.win32.join(env.APPDATA, "Claude", "claude_desktop_config.json")
        : path.join(home, ".config", "Claude", "claude_desktop_config.json"),
    cursor: path.join(home, ".cursor", "mcp.json"),
  };
  const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2)); };
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  const backups = file => fs.existsSync(path.dirname(file)) ? fs.readdirSync(path.dirname(file)).filter(f => f.startsWith(`${path.basename(file)}.bak-`)) : [];
  return { home, ctx, lines, runs, asked, paths, write, read, backups, text: () => lines.join("\n") };
}

const status = (results, id) => results.find(r => r.client.id === id).status;

test("Claude Desktop (macOS): merges into an existing config, keeps everything else, backs it up", async () => {
  const m = machine();
  const before = { globalShortcut: "Alt+Space", mcpServers: { github: { command: "gh-mcp", args: ["serve"] } } };
  m.write(m.paths.claudeDesktop, before);
  const results = await install(parseArgs(["install", "--yes"]), m.ctx);
  assert.equal(status(results, "claude-desktop"), "added");
  assert.deepEqual(m.read(m.paths.claudeDesktop), { ...before, mcpServers: { ...before.mcpServers, datahacks: ENTRY } });
  const [bak] = m.backups(m.paths.claudeDesktop);
  assert.equal(bak, "claude_desktop_config.json.bak-20261101T120000Z");
  assert.deepEqual(m.read(path.join(path.dirname(m.paths.claudeDesktop), bak)), before);
  assert.match(m.text(), /Apply me to DataHacks as a hacker/);
  assert.match(m.text(), /sign in with Google/);
});

test("Claude Desktop: an app folder with no config file yet gets a new file and no backup", async () => {
  const m = machine();
  fs.mkdirSync(path.dirname(m.paths.claudeDesktop), { recursive: true });
  await install(parseArgs(["install", "--yes"]), m.ctx);
  assert.deepEqual(m.read(m.paths.claudeDesktop), { mcpServers: { datahacks: ENTRY } });
  assert.deepEqual(m.backups(m.paths.claudeDesktop), []);
});

test("Claude Desktop (Windows): %APPDATA% path, and npx goes through cmd", () => {
  // Paths only: a win32 path joined on macOS/Linux would be a stray file in the working folder.
  const env = { APPDATA: "C:\\Users\\ana\\AppData\\Roaming" };
  const [desktop, cursor] = jsonClients({ platform: "win32", home: "C:\\Users\\ana", env });
  assert.equal(desktop.file, "C:\\Users\\ana\\AppData\\Roaming\\Claude\\claude_desktop_config.json");
  assert.equal(cursor.file, "C:\\Users\\ana\\.cursor\\mcp.json");
  assert.equal(jsonClients({ platform: "win32", home: "C:\\Users\\ana", env: {} })[0].file, "C:\\Users\\ana\\AppData\\Roaming\\Claude\\claude_desktop_config.json");
  assert.deepEqual(bridgeEntry({ platform: "win32" }), { command: "cmd", args: ["/c", "npx", "-y", "datahacks-mcp"] });
  assert.deepEqual(bridgeEntry({ platform: "win32", serverArgs: ["--staging"] }), { command: "cmd", args: ["/c", "npx", "-y", "datahacks-mcp", "--staging"] });
  assert.equal(jsonClients({ platform: "linux", home: "/home/ana", env: { XDG_CONFIG_HOME: "/xdg" } })[0].file, "/xdg/Claude/claude_desktop_config.json");
});

test("Claude Desktop (Linux): ~/.config/Claude", async () => {
  const m = machine({ platform: "linux" });
  m.write(m.paths.claudeDesktop, { mcpServers: {} });
  await install(parseArgs(["install", "--yes", "--only", "claude-desktop"]), m.ctx);
  assert.deepEqual(m.read(m.paths.claudeDesktop).mcpServers.datahacks, ENTRY);
});

test("Cursor: ~/.cursor/mcp.json, merged without clobbering other servers", async () => {
  const m = machine();
  m.write(m.paths.cursor, { mcpServers: { linear: { url: "https://mcp.linear.app/sse" } } });
  const results = await install(parseArgs(["install", "--yes"]), m.ctx);
  assert.equal(status(results, "cursor"), "added");
  assert.equal(status(results, "claude-desktop"), "not-found");
  assert.deepEqual(m.read(m.paths.cursor).mcpServers, { linear: { url: "https://mcp.linear.app/sse" }, datahacks: ENTRY });
  assert.equal(m.backups(m.paths.cursor).length, 1);
  assert.ok(!fs.existsSync(m.paths.claudeDesktop), "doesn't create configs for apps that aren't there");
});

test("--only creates the config for a client even if it isn't detected", async () => {
  const m = machine();
  await install(parseArgs(["install", "--yes", "--only", "cursor"]), m.ctx);
  assert.deepEqual(m.read(m.paths.cursor), { mcpServers: { datahacks: ENTRY } });
  assert.ok(!fs.existsSync(m.paths.claudeDesktop));
});

test("--dry-run changes nothing anywhere and runs nothing but the lookup", async () => {
  const m = machine({ claude: null });
  const before = '{\n  "mcpServers": {}\n}';
  m.write(m.paths.claudeDesktop, before);
  m.write(m.paths.cursor, before);
  const results = await install(parseArgs(["install", "--dry-run"]), m.ctx);
  assert.deepEqual(results.map(r => r.status), ["would-add", "would-add", "would-add"]);
  assert.equal(fs.readFileSync(m.paths.claudeDesktop, "utf8"), before);
  assert.equal(fs.readFileSync(m.paths.cursor, "utf8"), before);
  assert.deepEqual(m.backups(m.paths.claudeDesktop), []);
  assert.deepEqual(m.backups(m.paths.cursor), []);
  assert.deepEqual(m.runs, [["mcp", "get", "datahacks"]]);
  assert.deepEqual(m.asked, []);
  assert.match(m.text(), /Would run: claude mcp add --transport http --scope user datahacks/);
});

test("running it twice is a no-op the second time", async () => {
  const m = machine();
  m.write(m.paths.cursor, {});
  await install(parseArgs(["install", "--yes"]), m.ctx);
  const results = await install(parseArgs(["install", "--yes"]), m.ctx);
  assert.equal(status(results, "cursor"), "same");
  assert.equal(m.backups(m.paths.cursor).length, 1);
});

test("a different existing datahacks entry: --yes leaves it, No keeps it, Yes replaces it after a backup", async () => {
  const theirs = { mcpServers: { datahacks: { url: "https://my-own-thing.example/mcp" } } };

  const withYes = machine();
  withYes.write(withYes.paths.cursor, theirs);
  assert.equal(status(await install(parseArgs(["install", "--yes"]), withYes.ctx), "cursor"), "conflict");
  assert.deepEqual(withYes.read(withYes.paths.cursor), theirs);
  assert.deepEqual(withYes.backups(withYes.paths.cursor), []);

  const dry = machine();
  dry.write(dry.paths.cursor, theirs);
  assert.equal(status(await install(parseArgs(["install", "--dry-run"]), dry.ctx), "cursor"), "conflict");
  assert.deepEqual(dry.read(dry.paths.cursor), theirs);

  const no = machine({ answers: [false] });
  no.write(no.paths.cursor, theirs);
  assert.equal(status(await install(parseArgs(["install", "--only", "cursor"]), no.ctx), "cursor"), "kept");
  assert.deepEqual(no.read(no.paths.cursor), theirs);
  assert.match(no.asked[0], /Replace it\?/);

  const yes = machine({ answers: [true] });
  yes.write(yes.paths.cursor, theirs);
  assert.equal(status(await install(parseArgs(["install", "--only", "cursor"]), yes.ctx), "cursor"), "added");
  assert.deepEqual(yes.read(yes.paths.cursor).mcpServers.datahacks, ENTRY);
  assert.equal(yes.backups(yes.paths.cursor).length, 1);
});

test("answering No to adding skips it", async () => {
  const m = machine({ answers: [false] });
  m.write(m.paths.cursor, {});
  assert.equal(status(await install(parseArgs(["install", "--only", "cursor"]), m.ctx), "cursor"), "skipped");
  assert.deepEqual(m.read(m.paths.cursor), {});
});

test("a config that isn't valid JSON is left exactly as it was", async () => {
  const m = machine();
  m.write(m.paths.cursor, "{ // comments aren't JSON\n}");
  const results = await install(parseArgs(["install", "--yes"]), m.ctx);
  assert.equal(status(results, "cursor"), "error");
  assert.equal(fs.readFileSync(m.paths.cursor, "utf8"), "{ // comments aren't JSON\n}");
  assert.deepEqual(m.backups(m.paths.cursor), []);
  assert.match(m.text(), /add DataHacks by hand/);
});

test("--staging is carried into the config entry and the Claude Code URL", async () => {
  const m = machine({ claude: null });
  m.write(m.paths.cursor, {});
  await install(parseArgs(["install", "--yes", "--staging"]), m.ctx);
  assert.deepEqual(m.read(m.paths.cursor).mcpServers.datahacks, { command: "npx", args: ["-y", "datahacks-mcp", "--staging"] });
  assert.deepEqual(m.runs.at(-1), ["mcp", "add", "--transport", "http", "--scope", "user", "datahacks", STAGING_URL]);
});

test("Claude Code: no CLI prints the command", async () => {
  const m = machine();
  const results = await install(parseArgs(["install", "--yes", "--only", "claude-code"]), m.ctx);
  assert.equal(status(results, "claude-code"), "printed");
  assert.deepEqual(m.runs, []);
  assert.match(m.text(), new RegExp(`claude mcp add --transport http --scope user datahacks ${PRODUCTION_URL}`));
});

test("Claude Code: adds it at user scope when it isn't there", async () => {
  const m = machine({ claude: null });
  const results = await install(parseArgs(["install", "--yes", "--only", "claude-code"]), m.ctx);
  assert.equal(status(results, "claude-code"), "added");
  assert.deepEqual(m.runs, [["mcp", "get", "datahacks"], ["mcp", "add", "--transport", "http", "--scope", "user", "datahacks", PRODUCTION_URL]]);
  assert.match(m.text(), /run \/mcp/);
});

test("Claude Code: already there, a different one, and a failed add", async () => {
  const same = machine({ claude: `datahacks:\n  Type: http\n  URL: ${PRODUCTION_URL}\n` });
  assert.equal(status(await install(parseArgs(["install", "--yes", "--only", "claude-code"]), same.ctx), "claude-code"), "same");
  assert.equal(same.runs.length, 1);

  const other = machine({ claude: "datahacks:\n  Type: http\n  URL: https://other.example/mcp\n" });
  assert.equal(status(await install(parseArgs(["install", "--yes", "--only", "claude-code"]), other.ctx), "claude-code"), "conflict");
  assert.equal(other.runs.length, 1, "never removes or re-adds someone else's server");

  const fails = machine({ claude: null, claudeAddFails: true });
  assert.equal(status(await install(parseArgs(["install", "--yes", "--only", "claude-code"]), fails.ctx), "claude-code"), "error");
  assert.match(fails.text(), /boom/);
});

test("uninstall removes only our entry, with a backup, and keeps everything else", async () => {
  const m = machine({ claude: `URL: ${PRODUCTION_URL}` });
  const keep = { theme: "light", mcpServers: { github: { command: "gh-mcp" } } };
  m.write(m.paths.claudeDesktop, { ...keep, mcpServers: { ...keep.mcpServers, datahacks: ENTRY } });
  m.write(m.paths.cursor, { mcpServers: { datahacks: { command: "cmd", args: ["/c", "npx", "-y", "datahacks-mcp"] } } });
  const results = await uninstall(parseArgs(["uninstall", "--yes"]), m.ctx);
  assert.deepEqual(results.map(r => r.status), ["removed", "removed", "removed"]);
  assert.deepEqual(m.read(m.paths.claudeDesktop), keep);
  assert.deepEqual(m.read(m.paths.cursor), { mcpServers: {} });
  assert.equal(m.backups(m.paths.claudeDesktop).length, 1);
  assert.deepEqual(m.runs.at(-1), ["mcp", "remove", "datahacks"]);
});

test("uninstall --yes leaves a datahacks entry that isn't ours; --dry-run changes nothing", async () => {
  const theirs = { mcpServers: { datahacks: { url: "https://my-own-thing.example/mcp" } } };
  const m = machine({ claude: "URL: https://my-own-thing.example/mcp" });
  m.write(m.paths.cursor, theirs);
  const results = await uninstall(parseArgs(["uninstall", "--yes"]), m.ctx);
  assert.equal(status(results, "cursor"), "not-ours");
  assert.equal(status(results, "claude-code"), "not-ours");
  assert.deepEqual(m.read(m.paths.cursor), theirs);
  assert.ok(!m.runs.some(args => args[1] === "remove"));

  const dry = machine({ claude: `URL: ${PRODUCTION_URL}` });
  dry.write(dry.paths.cursor, { mcpServers: { datahacks: ENTRY } });
  const dryResults = await uninstall(parseArgs(["uninstall", "--dry-run"]), dry.ctx);
  assert.equal(status(dryResults, "cursor"), "would-remove");
  assert.equal(status(dryResults, "claude-code"), "would-remove");
  assert.deepEqual(dry.read(dry.paths.cursor), { mcpServers: { datahacks: ENTRY } });
  assert.deepEqual(dry.backups(dry.paths.cursor), []);
  assert.ok(!dry.runs.some(args => args[1] === "remove"));
});

test("uninstall with nothing installed is a no-op", async () => {
  const m = machine({ claude: null });
  const results = await uninstall(parseArgs(["uninstall", "--yes"]), m.ctx);
  assert.deepEqual(results.map(r => r.status), ["absent", "absent", "absent"]);
  assert.ok(!fs.existsSync(m.paths.cursor));
});

test("an old Node gets a warning when a desktop app is set up", async () => {
  const m = machine();
  m.write(m.paths.cursor, {});
  m.ctx.nodeVersion = "v18.20.0";
  await install(parseArgs(["install", "--yes"]), m.ctx);
  assert.match(m.text(), /needs Node\.js 20\.18\.1 or newer/);
});

test("findExecutable looks on PATH and needs the file to be executable", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datahacks-mcp-path-"));
  fs.writeFileSync(path.join(dir, "claude"), "", { mode: 0o644 });
  assert.equal(findExecutable("claude", { platform: "linux", env: { PATH: dir } }), null);
  fs.chmodSync(path.join(dir, "claude"), 0o755);
  assert.equal(findExecutable("claude", { platform: "linux", env: { PATH: `/nonexistent${path.delimiter}${dir}` } }), path.join(dir, "claude"));
  assert.equal(findExecutable("claude", { platform: "linux", env: {} }), null);
});
