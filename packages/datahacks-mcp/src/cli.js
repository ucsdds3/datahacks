import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import readline from "node:readline/promises";
import { APPLY_WITH_AI_PAGE, BRIDGE_MIN_NODE, PACKAGE_NAME, PRODUCTION_URL } from "./constants.js";
import { UsageError, parseArgs, serverUrl } from "./args.js";
import { atLeast, install, uninstall } from "./install.js";
import { runBridge } from "./bridge.js";

export const HELP = `datahacks-mcp: apply to DataHacks by chatting with your AI assistant.

Usage
  npx -y ${PACKAGE_NAME} install     Add DataHacks to Claude Desktop, Cursor and Claude Code
  npx -y ${PACKAGE_NAME} uninstall   Take it out again
  npx -y ${PACKAGE_NAME}             The connection itself (what the apps run; you don't need to)

Options
  -y, --yes         Don't ask; add (or remove) wherever it's safe to
      --dry-run     Show what would change, change nothing
      --only <list> Just these, comma-separated: claude-desktop, cursor, claude-code
  -h, --help        This help
  -v, --version     The version

Files are backed up (<file>.bak-<time>) before they're edited, and a "datahacks"
server you already have is never replaced without asking.

Server: ${PRODUCTION_URL}
More: ${APPLY_WITH_AI_PAGE}
`;

function version() {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  return manifest.version;
}

function styles(enabled) {
  const wrap = (open, close) => s => (enabled ? `\u001b[${open}m${s}\u001b[${close}m` : s);
  return { bold: wrap(1, 22), dim: wrap(2, 22), green: wrap(32, 39), yellow: wrap(33, 39), red: wrap(31, 39) };
}

/** Runs a command and captures its output. `.cmd`/`.bat` files (Windows) need a shell; their arguments are ours and plain. */
function run(file, args) {
  const shell = /\.(cmd|bat)$/i.test(file);
  const quoted = shell ? args.map(a => `"${a}"`) : args;
  const result = spawnSync(shell ? `"${file}"` : file, quoted, { encoding: "utf8", shell, timeout: 60_000, windowsHide: true });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`datahacks-mcp: ${error.message}\n`);
    return 2;
  }

  if (options.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (options.command === "version") {
    process.stdout.write(`${version()}\n`);
    return 0;
  }

  if (options.command === "bridge") {
    // Someone typed it in a terminal rather than an app starting it: point them at install.
    if (process.stdin.isTTY && process.stdout.isTTY && !argv.includes("bridge")) {
      process.stderr.write(`This is the connection your AI app runs, and it waits for the app to talk to it.\nTo set up your apps, run:  npx -y ${PACKAGE_NAME} install\n(Run "npx -y ${PACKAGE_NAME} bridge" to start it here anyway.)\n`);
      return 0;
    }
    if (!atLeast(process.version, BRIDGE_MIN_NODE)) {
      process.stderr.write(`datahacks-mcp: needs Node.js ${BRIDGE_MIN_NODE.join(".")} or newer (this is ${process.version}). Update it from https://nodejs.org and restart your app.\n`);
      return 1;
    }
    return runBridge(serverUrl(options), { debug: options.debug });
  }

  const interactive = Boolean(process.stdin.isTTY);
  if (!interactive && !options.yes && !options.dryRun) {
    process.stderr.write(`datahacks-mcp: there's no one to ask here. Add --yes to go ahead, or --dry-run to see what would change.\n`);
    return 2;
  }

  const rl = interactive && !options.yes && !options.dryRun ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  const ctx = {
    platform: process.platform,
    home: os.homedir(),
    env: process.env,
    nodeVersion: process.version,
    now: () => new Date(),
    out: (line = "") => process.stdout.write(`${line}\n`),
    interactive,
    ask: async (question, defaultYes) => {
      if (!rl) return defaultYes;
      const answer = (await rl.question(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)).trim().toLowerCase();
      return answer ? answer === "y" || answer === "yes" : defaultYes;
    },
    run,
    style: styles(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR),
  };
  try {
    const results = options.command === "install" ? await install(options, ctx) : await uninstall(options, ctx);
    return results.some(r => r.status === "error") ? 1 : 0;
  } finally {
    rl?.close();
  }
}
