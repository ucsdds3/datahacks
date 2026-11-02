// The one place the DataHacks server's address lives in this package.
// Keep in step with docs/mcp-server.md and src/pages/applyWithAi.ts in the site.

export const PRODUCTION_URL = "https://yrxjhrrphhbmqejresvy.supabase.co/functions/v1/mcp";
export const STAGING_URL = "https://gpoqlosneoicpzrluilj.supabase.co/functions/v1/mcp";

/** The key every client config uses for this server. */
export const SERVER_NAME = "datahacks";

/** What people install and what client configs run. */
export const PACKAGE_NAME = "datahacks-mcp";

export const APPLY_WITH_AI_PAGE = "https://datahacks.ds3ucsd.com/apply-with-ai";
export const PORTAL_URL = "https://datahacks.ds3ucsd.com/portal";

/** mcp-remote's undici needs this; the installer itself runs on Node 18. */
export const BRIDGE_MIN_NODE = [20, 18, 1];
