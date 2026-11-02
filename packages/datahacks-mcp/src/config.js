// Reading and editing an MCP client's JSON config without losing anything in it.
//
// The rules: never write a file we couldn't parse, never touch another server's
// entry or any other setting, back the file up before every change, and write
// the new file in one step (a temp file renamed over it) so a crash mid-write
// can't leave half a config.

import fs from "node:fs";
import path from "node:path";
import { SERVER_NAME } from "./constants.js";

export class ConfigError extends Error {}

/** The file's contents, or an empty config if it doesn't exist yet. Throws ConfigError if it isn't a JSON object. */
export function readConfig(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, data: {} };
    throw new ConfigError(`Couldn't read ${file}: ${error.message}`);
  }
  const text = raw.replace(/^﻿/, "");
  if (!text.trim()) return { exists: true, data: {} };
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`${file} isn't valid JSON (${error.message}), so it was left alone.`);
  }
  if (!isPlainObject(data)) throw new ConfigError(`${file} doesn't hold a JSON object, so it was left alone.`);
  if (data.mcpServers !== undefined && !isPlainObject(data.mcpServers)) {
    throw new ConfigError(`"mcpServers" in ${file} isn't a JSON object, so the file was left alone.`);
  }
  return { exists: true, data };
}

/** What adding `entry` would do: "add" it, nothing ("same"), or replace a different "datahacks" entry ("conflict"). */
export function planAdd(data, entry) {
  const existing = data.mcpServers?.[SERVER_NAME];
  if (existing === undefined) return { status: "add" };
  if (sameEntry(existing, entry)) return { status: "same", existing };
  return { status: "conflict", existing };
}

/** A copy of the config with the "datahacks" entry set; every other key and server kept as it was. */
export function withEntry(data, entry) {
  return { ...data, mcpServers: { ...(data.mcpServers ?? {}), [SERVER_NAME]: entry } };
}

/** A copy of the config without the "datahacks" entry. */
export function withoutEntry(data) {
  if (!data.mcpServers || !(SERVER_NAME in data.mcpServers)) return data;
  const { [SERVER_NAME]: _removed, ...rest } = data.mcpServers;
  return { ...data, mcpServers: rest };
}

/** Whether an entry runs this package (so uninstall --yes knows it's ours to remove). */
export function isOurEntry(entry, packageName) {
  if (!isPlainObject(entry)) return false;
  const args = Array.isArray(entry.args) ? entry.args.map(String) : [];
  return [entry.command, ...args].some(part => typeof part === "string" && (part === packageName || part.startsWith(`${packageName}@`)));
}

/** `claude_desktop_config.json.bak-20261101T120000Z`, never clobbering an earlier backup. */
export function backupPath(file, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  let candidate = `${file}.bak-${stamp}`;
  for (let n = 2; fs.existsSync(candidate); n++) candidate = `${file}.bak-${stamp}-${n}`;
  return candidate;
}

/** Copies the file next to itself and returns the copy's path. */
export function backup(file, now = new Date()) {
  const target = backupPath(file, now);
  fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
  return target;
}

/** Writes the config as 2-space JSON, creating its folder if needed, via a temp file renamed into place. */
export function writeConfig(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let mode;
  try {
    mode = fs.statSync(file).mode & 0o777;
  } catch {
    mode = undefined;
  }
  const temp = `${file}.datahacks-${process.pid}-${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, mode === undefined ? undefined : { mode });
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

function sameEntry(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isPlainObject(value)) return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
