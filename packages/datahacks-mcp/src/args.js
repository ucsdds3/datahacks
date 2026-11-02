import { PRODUCTION_URL, STAGING_URL } from "./constants.js";

export const COMMANDS = ["bridge", "install", "uninstall", "help", "version"];
export const CLIENT_IDS = ["claude-desktop", "cursor", "claude-code"];

export class UsageError extends Error {}

/**
 * Parses the command line (without `node` and the script).
 *
 * No command runs the stdio bridge, which is what MCP client configs launch.
 * `--staging` and `--url` are for testing and aren't in --help.
 */
export function parseArgs(argv) {
  const options = {
    command: null,
    yes: false,
    dryRun: false,
    staging: false,
    url: null,
    debug: false,
    only: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, null];
    const value = () => {
      if (inline !== null) return inline;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) throw new UsageError(`${flag} needs a value.`);
      i++;
      return next;
    };
    switch (flag) {
      case "-h":
      case "--help":
        options.command = "help";
        break;
      case "-v":
      case "--version":
        options.command = options.command === "help" ? "help" : "version";
        break;
      case "-y":
      case "--yes":
        options.yes = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--staging":
        options.staging = true;
        break;
      case "--url":
        options.url = value();
        break;
      case "--debug":
        options.debug = true;
        break;
      case "--only": {
        const ids = value().split(",").map(s => s.trim()).filter(Boolean);
        const unknown = ids.filter(id => !CLIENT_IDS.includes(id));
        if (unknown.length || !ids.length) throw new UsageError(`--only takes a comma-separated list of: ${CLIENT_IDS.join(", ")}.`);
        options.only = ids;
        break;
      }
      default:
        if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}. Run with --help to see the options.`);
        if (options.command && options.command !== "help" && options.command !== "version") {
          throw new UsageError(`Unexpected "${arg}". Run with --help to see the commands.`);
        }
        if (!COMMANDS.includes(arg)) throw new UsageError(`Unknown command "${arg}". Run with --help to see the commands.`);
        if (!options.command) options.command = arg;
    }
  }

  if (options.staging && options.url) throw new UsageError("Use either --staging or --url, not both.");
  if (options.url) checkUrl(options.url);
  options.command ??= "bridge";
  return options;
}

/** The server to connect to: production unless --staging or --url says otherwise. */
export function serverUrl(options) {
  if (options.url) return options.url;
  return options.staging ? STAGING_URL : PRODUCTION_URL;
}

/** The flags a client config has to pass back to the bridge so it reaches the same server. */
export function serverArgs(options) {
  if (options.url) return ["--url", options.url];
  return options.staging ? ["--staging"] : [];
}

/** https anywhere, http only on this machine (for a local Supabase stack). */
export function checkUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new UsageError(`--url "${url}" isn't a URL.`);
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new UsageError("--url must start with https:// (or http:// for localhost).");
  }
  if (parsed.username || parsed.password) throw new UsageError("--url can't contain a username or password.");
  if (parsed.search || parsed.hash || /["'\s]/.test(url)) throw new UsageError("--url can't have a query, a fragment, quotes or spaces.");
}
