// Where each supported MCP client keeps its config, and what the "datahacks"
// entry in it looks like. Everything takes the platform, home folder and
// environment as arguments so the tests can point it at a temp folder.

import fs from "node:fs";
import path from "node:path";
import { PACKAGE_NAME } from "./constants.js";

const pathFor = platform => (platform === "win32" ? path.win32 : path.posix);

/**
 * The clients configured by editing a JSON file.
 * `dir` existing is how we tell the app is installed (it creates it on first run).
 */
export function jsonClients({ platform, home, env }) {
  const p = pathFor(platform);
  let claudeDir;
  if (platform === "darwin") claudeDir = p.join(home, "Library", "Application Support", "Claude");
  else if (platform === "win32") claudeDir = p.join(env.APPDATA || p.join(home, "AppData", "Roaming"), "Claude");
  else claudeDir = p.join(env.XDG_CONFIG_HOME || p.join(home, ".config"), "Claude");
  const cursorDir = p.join(home, ".cursor");
  return [
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      dir: claudeDir,
      file: p.join(claudeDir, "claude_desktop_config.json"),
      restart: "Quit Claude Desktop completely (on a Mac, Claude → Quit or Cmd+Q; closing the window isn't enough) and open it again.",
    },
    {
      id: "cursor",
      name: "Cursor",
      dir: cursorDir,
      file: p.join(cursorDir, "mcp.json"),
      restart: "Restart Cursor, then check Settings → MCP that \"datahacks\" is on.",
    },
  ];
}

export function isInstalled(client) {
  return fs.existsSync(client.dir) || fs.existsSync(client.file);
}

/**
 * The entry for a JSON config: run this package with npx, which starts the stdio bridge.
 * On Windows, npx is a .cmd script that apps can't start directly, so it goes through cmd.
 */
export function bridgeEntry({ platform, serverArgs = [] }) {
  const args = ["-y", PACKAGE_NAME, ...serverArgs];
  return platform === "win32" ? { command: "cmd", args: ["/c", "npx", ...args] } : { command: "npx", args };
}

/** The full path of an executable on PATH, or null. On Windows, tries PATHEXT's extensions. */
export function findExecutable(name, { platform, env }) {
  const p = pathFor(platform);
  const dirs = (env.PATH ?? env.Path ?? "").split(p.delimiter).filter(Boolean);
  const exts = platform === "win32" ? ["", ...(env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = p.join(dir, name + ext);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (platform !== "win32") fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // not here
      }
    }
  }
  return null;
}
