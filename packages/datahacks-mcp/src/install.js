// `datahacks-mcp install` and `uninstall`: add or remove the "datahacks" server in
// Claude Desktop, Cursor and Claude Code.
//
// Safe by default: every change is shown and asked about first, files are backed
// up before they're edited, nothing else in them is touched, and a different
// "datahacks" entry someone already has is never replaced without a yes typed by
// a person (--yes doesn't count for that). --dry-run says what would happen and
// changes nothing.

import { APPLY_WITH_AI_PAGE, BRIDGE_MIN_NODE, PACKAGE_NAME, PORTAL_URL, PRODUCTION_URL, SERVER_NAME, STAGING_URL } from "./constants.js";
import { serverArgs, serverUrl } from "./args.js";
import { bridgeEntry, findExecutable, isInstalled, jsonClients } from "./clients.js";
import { ConfigError, backup, isOurEntry, planAdd, readConfig, withEntry, withoutEntry, writeConfig } from "./config.js";

/**
 * @typedef {object} Context
 * @property {string} platform
 * @property {string} home
 * @property {Record<string, string | undefined>} env
 * @property {string} nodeVersion            e.g. "v20.18.1"
 * @property {() => Date} now
 * @property {(line?: string) => void} out
 * @property {(question: string, defaultYes: boolean) => Promise<boolean>} ask   Only called when a person can answer.
 * @property {(file: string, args: string[]) => { status: number | null, stdout: string, stderr: string, error?: Error }} run
 * @property {{ bold: (s: string) => string, dim: (s: string) => string, green: (s: string) => string, yellow: (s: string) => string, red: (s: string) => string }} style
 */

/** Which clients this run is about, as { kind, ...client } in a fixed order. */
function clientsFor(options, ctx) {
  const wanted = id => !options.only || options.only.includes(id);
  const list = jsonClients(ctx).filter(c => wanted(c.id)).map(c => ({ kind: "json", ...c }));
  if (wanted("claude-code")) list.push({ kind: "claude-code", id: "claude-code", name: "Claude Code" });
  return list;
}

/** --yes and --dry-run answer for the person; otherwise ask. */
async function confirm(options, ctx, question, defaultYes = true) {
  if (options.dryRun || options.yes) return true;
  return ctx.ask(question, defaultYes);
}

const claudeAddArgs = url => ["mcp", "add", "--transport", "http", "--scope", "user", SERVER_NAME, url];
const claudeAddCommand = url => `claude ${claudeAddArgs(url).join(" ")}`;

function atLeast(version, min) {
  const parts = version.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < min.length; i++) {
    if ((parts[i] ?? 0) !== min[i]) return (parts[i] ?? 0) > min[i];
  }
  return true;
}

export async function install(options, ctx) {
  const { out, style } = ctx;
  const url = serverUrl(options);
  const entry = bridgeEntry({ platform: ctx.platform, serverArgs: serverArgs(options) });
  const results = [];

  out(style.bold("DataHacks · Apply with AI"));
  out(`Connects your AI assistant to DataHacks so it can fill out your application with you.`);
  if (options.dryRun) out(style.yellow("Dry run: nothing will be changed."));
  if (url !== serverUrl({})) out(style.yellow(`Server: ${url}`));
  out();

  for (const client of clientsFor(options, ctx)) {
    const result = client.kind === "json"
      ? await installJson(client, entry, options, ctx)
      : await installClaudeCode(url, options, ctx);
    results.push({ client, ...result });
    out();
  }

  const ready = results.filter(r => ["added", "would-add", "same"].includes(r.status));
  if (ready.some(r => r.client.kind === "json") && !atLeast(ctx.nodeVersion, BRIDGE_MIN_NODE)) {
    out(style.yellow(`Heads up: the connection needs Node.js ${BRIDGE_MIN_NODE.join(".")} or newer, and this is ${ctx.nodeVersion}. Update Node from https://nodejs.org first.`));
    out();
  }

  if (ready.length === 0) {
    if (!results.some(r => r.status === "printed")) out("Nothing was set up.");
    out(`To add DataHacks by hand, see ${APPLY_WITH_AI_PAGE}`);
  } else {
    out(style.bold(options.dryRun ? "After a real run:" : "Next:"));
    let step = 1;
    for (const r of ready) {
      if (r.client.kind === "json") out(`  ${step++}. ${r.client.restart}`);
      else out(`  ${step++}. In Claude Code, run /mcp and pick "datahacks" to sign in.`);
    }
    out(`  ${step++}. Start a new chat and ask: ${style.bold('"Apply me to DataHacks as a hacker"')} (or as a mentor or judge).`);
    out(`  ${step++}. When it asks, sign in with Google in the browser window that opens, and choose Allow.`);
  }
  out();
  out(style.dim(`The assistant can only see and submit your own application, and it reads every answer back before submitting.`));
  out(style.dim(`Prefer the form? It's always at ${PORTAL_URL}`));
  return results;
}

async function installJson(client, entry, options, ctx) {
  const { out, style } = ctx;
  out(style.bold(client.name));
  if (!options.only && !isInstalled(client)) {
    out(style.dim(`  Not found on this computer, skipped.`));
    return { status: "not-found" };
  }
  let config;
  try {
    config = readConfig(client.file);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    out(style.red(`  ${error.message}`));
    out(`  To add DataHacks by hand, put this under "mcpServers" in that file:`);
    out(indent(JSON.stringify({ [SERVER_NAME]: entry }, null, 2), 4));
    return { status: "error" };
  }

  const plan = planAdd(config.data, entry);
  if (plan.status === "same") {
    out(style.green(`  Already set up in ${client.file}`));
    return { status: "same" };
  }
  if (plan.status === "conflict") {
    out(`  ${client.file} already has a different "${SERVER_NAME}" server:`);
    out(indent(JSON.stringify(plan.existing, null, 2), 4));
    out(`  This would replace it with:`);
    out(indent(JSON.stringify(entry, null, 2), 4));
    if (options.dryRun) {
      out(style.yellow(`  Would ask before replacing it.`));
      return { status: "conflict" };
    }
    if (options.yes || !ctx.interactive) {
      out(style.yellow(`  Left it alone. Run this again without --yes to choose whether to replace it.`));
      return { status: "conflict" };
    }
    if (!(await ctx.ask(`  Replace it?`, false))) {
      out(`  Left it alone.`);
      return { status: "kept" };
    }
  } else if (!(await confirm(options, ctx, `  Add DataHacks to ${client.name}? (${client.file})`))) {
    out(`  Skipped.`);
    return { status: "skipped" };
  }

  if (options.dryRun) {
    out(`  Would ${config.exists ? "back up and edit" : "create"} ${client.file}, adding:`);
    out(indent(JSON.stringify({ [SERVER_NAME]: entry }, null, 2), 4));
    return { status: "would-add" };
  }
  const backupFile = config.exists ? backup(client.file, ctx.now()) : null;
  writeConfig(client.file, withEntry(config.data, entry));
  out(style.green(`  Added to ${client.file}`));
  if (backupFile) out(style.dim(`  Backup of the old file: ${backupFile}`));
  return { status: "added", backup: backupFile };
}

async function installClaudeCode(url, options, ctx) {
  const { out, style } = ctx;
  out(style.bold("Claude Code"));
  const claude = findExecutable("claude", ctx);
  if (!claude) {
    out(style.dim(`  The claude command isn't installed here. If you use Claude Code, run:`));
    out(`    ${claudeAddCommand(url)}`);
    return { status: "printed" };
  }

  const existing = ctx.run(claude, ["mcp", "get", SERVER_NAME]);
  if (existing.status === 0) {
    if (existing.stdout.includes(url)) {
      out(style.green(`  Already set up.`));
      return { status: "same" };
    }
    out(`  Claude Code already has a different "${SERVER_NAME}" server:`);
    out(indent(existing.stdout.trim(), 4));
    out(`  To switch it to DataHacks' server, run:`);
    out(`    claude mcp remove ${SERVER_NAME}`);
    out(`    ${claudeAddCommand(url)}`);
    return { status: "conflict" };
  }

  if (!(await confirm(options, ctx, `  Add DataHacks to Claude Code (for all your projects)?`))) {
    out(`  Skipped. To add it later: ${claudeAddCommand(url)}`);
    return { status: "skipped" };
  }
  if (options.dryRun) {
    out(`  Would run: ${claudeAddCommand(url)}`);
    return { status: "would-add" };
  }
  const added = ctx.run(claude, claudeAddArgs(url));
  if (added.status !== 0) {
    out(style.red(`  That didn't work: ${(added.stderr || added.stdout || added.error?.message || "").trim()}`));
    out(`  Try it yourself: ${claudeAddCommand(url)}`);
    return { status: "error" };
  }
  out(style.green(`  Added (user scope, so it's there in every project).`));
  return { status: "added" };
}

export async function uninstall(options, ctx) {
  const { out, style } = ctx;
  const results = [];
  out(style.bold("DataHacks · remove the AI connection"));
  if (options.dryRun) out(style.yellow("Dry run: nothing will be changed."));
  out();

  for (const client of clientsFor(options, ctx)) {
    out(style.bold(client.name));
    const result = client.kind === "json" ? await uninstallJson(client, options, ctx) : await uninstallClaudeCode(options, ctx);
    results.push({ client, ...result });
    out();
  }
  out(style.dim(`Your application itself isn't affected. To also forget the saved sign-in, delete the ~/.mcp-auth folder`));
  out(style.dim(`(it's shared with any other servers you use through mcp-remote), or revoke DataHacks from your account.`));
  return results;
}

async function uninstallJson(client, options, ctx) {
  const { out, style } = ctx;
  let config;
  try {
    config = readConfig(client.file);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    out(style.red(`  ${error.message}`));
    return { status: "error" };
  }
  const existing = config.data.mcpServers?.[SERVER_NAME];
  if (!config.exists || existing === undefined) {
    out(style.dim(`  Not set up, nothing to remove.`));
    return { status: "absent" };
  }
  const ours = isOurEntry(existing, PACKAGE_NAME);
  if (!ours) {
    out(`  The "${SERVER_NAME}" server in ${client.file} doesn't look like this one:`);
    out(indent(JSON.stringify(existing, null, 2), 4));
    if (options.dryRun) {
      out(style.yellow(`  Would ask before removing it.`));
      return { status: "not-ours" };
    }
    if (options.yes || !ctx.interactive || !(await ctx.ask(`  Remove it anyway?`, false))) {
      out(`  Left it alone.`);
      return { status: "not-ours" };
    }
  } else if (!(await confirm(options, ctx, `  Remove DataHacks from ${client.name}? (${client.file})`))) {
    out(`  Skipped.`);
    return { status: "skipped" };
  }
  if (options.dryRun) {
    out(`  Would back up and edit ${client.file}, removing "${SERVER_NAME}".`);
    return { status: "would-remove" };
  }
  const backupFile = backup(client.file, ctx.now());
  writeConfig(client.file, withoutEntry(config.data));
  out(style.green(`  Removed from ${client.file}`));
  out(style.dim(`  Backup of the old file: ${backupFile}`));
  return { status: "removed", backup: backupFile };
}

async function uninstallClaudeCode(options, ctx) {
  const { out, style } = ctx;
  const claude = findExecutable("claude", ctx);
  if (!claude) {
    out(style.dim(`  The claude command isn't installed here. If you added DataHacks to Claude Code, run:`));
    out(`    claude mcp remove ${SERVER_NAME}`);
    return { status: "printed" };
  }
  const existing = ctx.run(claude, ["mcp", "get", SERVER_NAME]);
  if (existing.status !== 0) {
    out(style.dim(`  Not set up, nothing to remove.`));
    return { status: "absent" };
  }
  const ours = [PRODUCTION_URL, STAGING_URL, serverUrl(options), PACKAGE_NAME].some(mark => existing.stdout.includes(mark));
  if (!ours) {
    out(`  Claude Code's "${SERVER_NAME}" server doesn't look like this one:`);
    out(indent(existing.stdout.trim(), 4));
    if (options.dryRun) {
      out(style.yellow(`  Would ask before removing it.`));
      return { status: "not-ours" };
    }
    if (options.yes || !ctx.interactive || !(await ctx.ask(`  Remove it anyway?`, false))) {
      out(`  Left it alone.`);
      return { status: "not-ours" };
    }
  } else if (!(await confirm(options, ctx, `  Remove "${SERVER_NAME}" from Claude Code?`))) {
    out(`  Skipped.`);
    return { status: "skipped" };
  }
  if (options.dryRun) {
    out(`  Would run: claude mcp remove ${SERVER_NAME}`);
    return { status: "would-remove" };
  }
  const removed = ctx.run(claude, ["mcp", "remove", SERVER_NAME]);
  if (removed.status !== 0) {
    out(style.red(`  That didn't work: ${(removed.stderr || removed.stdout || removed.error?.message || "").trim()}`));
    out(`  It may be in more than one scope; try: claude mcp remove ${SERVER_NAME} --scope user`);
    return { status: "error" };
  }
  out(style.green(`  Removed.`));
  return { status: "removed" };
}

function indent(text, spaces) {
  const pad = " ".repeat(spaces);
  return text.split("\n").map(line => pad + line).join("\n");
}

export { atLeast };
