// What the Apply with AI page (/apply-with-ai) tells people to paste. One place, so
// the page, its tests and packages/datahacks-mcp agree.

/**
 * Whether people can actually sign in from an assistant yet. False until
 * production's Supabase OAuth server is switched on (docs/mcp-server.md, "One-time
 * setup"); until then the page shows a "coming soon" banner over the steps.
 */
export const MCP_LIVE = false;

/**
 * Whether `datahacks-mcp` is on npm. False until the first publish
 * (packages/datahacks-mcp/README.md, "Publishing"). Until then the page never shows
 * an npx command: a name we haven't published could be registered by someone else,
 * and every copied command would run their code.
 */
export const NPM_PUBLISHED = false;

/** The production MCP server. Same as PRODUCTION_URL in packages/datahacks-mcp/src/constants.js. */
export const MCP_URL = "https://yrxjhrrphhbmqejresvy.supabase.co/functions/v1/mcp";

export const INSTALL_COMMAND = "npx -y datahacks-mcp install";

export const CLAUDE_CODE_COMMAND = `claude mcp add --transport http datahacks ${MCP_URL}`;

/** For Cursor and other apps' JSON configs: the npx bridge once it's published, the server URL until then. */
export const clientConfig = (npmPublished = NPM_PUBLISHED) =>
  JSON.stringify(
    { mcpServers: { datahacks: npmPublished ? { command: "npx", args: ["-y", "datahacks-mcp"] } : { url: MCP_URL } } },
    null,
    2,
  );

export const FIRST_MESSAGE = "Apply me to DataHacks as a hacker";
