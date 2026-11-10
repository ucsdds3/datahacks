# datahacks-mcp

Apply to [DataHacks](https://datahacks.ds3atucsd.com), UC San Diego's data science hackathon, by chatting with your AI assistant instead of filling out the form.

```sh
npx -y datahacks-mcp install
```

That adds a "datahacks" server to the AI apps it finds on your computer: **Claude Desktop**, **Cursor** and **Claude Code**. Then:

1. Quit the app completely and open it again.
2. Start a new chat and ask: **"Apply me to DataHacks as a hacker"** (or as a mentor or judge).
3. When it asks, sign in with Google in the browser window that opens, and choose **Allow**.

The assistant goes through the application's questions with you, reads every answer back, and submits only when you say yes. The normal form is always there too: <https://datahacks.ds3atucsd.com/portal>.

> **Maintainers:** don't advertise `npx datahacks-mcp` anywhere until the package is actually on npm (see [Publishing](#publishing-for-ds3-maintainers)). An unpublished name can be registered by someone else, and then every copied command would run their code. The site's Apply with AI page only shows the npx commands once `NPM_PUBLISHED` is `true` in `src/pages/applyWithAiConfig.ts`.

## Privacy and what the assistant can do

- **It only connects to DataHacks' own server** (`https://yrxjhrrphhbmqejresvy.supabase.co/functions/v1/mcp`). The package sends nothing anywhere else.
- **You sign in with Google**, on the DataHacks site, and choose which assistant to allow. The package never sees your password.
- **The assistant can only see and submit your own application.** It acts as you, under the same rules as the portal: it can't see anyone else's application, change yours once it's submitted, or see decisions before they're released.
- Your sign-in is saved on your computer by [mcp-remote](https://github.com/punkpeye/mcp-remote) in `~/.mcp-auth`, so you don't sign in every time.

## Commands

```sh
npx -y datahacks-mcp install            # add it, asking before each change
npx -y datahacks-mcp install --dry-run  # show what would change, change nothing
npx -y datahacks-mcp install --yes      # don't ask (still never replaces a different "datahacks" server)
npx -y datahacks-mcp install --only cursor,claude-code
npx -y datahacks-mcp uninstall          # take it out again
npx -y datahacks-mcp --help
npx -y datahacks-mcp --version
npx -y datahacks-mcp                    # the connection itself; this is what the apps run
```

What `install` changes, and how it stays safe:

| App | Where | How |
| --- | --- | --- |
| Claude Desktop | macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`, Linux `~/.config/Claude/claude_desktop_config.json` | adds `mcpServers.datahacks` |
| Cursor | `~/.cursor/mcp.json` | adds `mcpServers.datahacks` |
| Claude Code | runs `claude mcp add --transport http --scope user datahacks <url>` | prints the command instead if `claude` isn't installed |

- A file is copied to `<file>.bak-<time>` before it's edited, and written in one step.
- Only the `datahacks` entry is touched; your other servers and settings stay as they are.
- A different `datahacks` entry you already have is shown to you and only replaced if you type yes (`--yes` never replaces it).
- A file that isn't valid JSON is left alone, with the snippet to add by hand.
- Apps that aren't installed are skipped (`--only` sets one up anyway).

The entry it adds to Claude Desktop and Cursor (on Windows, `"command": "cmd", "args": ["/c", "npx", "-y", "datahacks-mcp"]`):

```json
{
  "mcpServers": {
    "datahacks": { "command": "npx", "args": ["-y", "datahacks-mcp"] }
  }
}
```

Other MCP apps: use that same command, or connect straight to the server URL if the app supports remote MCP servers with sign-in (Claude on the web: Settings → Connectors → Add custom connector).

### Requirements

Node.js 18 or newer for `install`. The connection itself runs [mcp-remote](https://www.npmjs.com/package/mcp-remote), which needs Node.js 20.18.1 or newer. If an app says the server failed to start, update Node from <https://nodejs.org>, and make sure the app can find `npx` (apps opened from the Dock don't always see a Node installed with nvm; in that case put the full path to `npx` in `"command"`).

### Testing flags

`--staging` and `--url <https url>` point the connection (and anything `install` writes) at another server, for testing against DataHacks' staging project or a local Supabase stack (`http://localhost` is allowed). `--debug` makes mcp-remote write a log to `~/.mcp-auth`.

## Publishing (for DS3 maintainers)

`.github/workflows/publish-mcp.yml` publishes this folder to npm, with [provenance](https://docs.npmjs.com/generating-provenance-statements), when a tag `datahacks-mcp-v<version>` is pushed. The tag must match `version` in `package.json`, and the tests must pass.

One-time setup:

1. **An npm account** that will own the package: sign up at <https://www.npmjs.com/signup> (or use DS3's), and turn on two-factor authentication. Optionally create an npm organization for DS3 and add the officers, so the package doesn't depend on one person.
2. **A token for GitHub Actions:** npmjs.com → your avatar → Access Tokens → Generate New Token → **Granular Access Token**. Permissions: *Read and write*, packages: *All packages* (the package doesn't exist yet, so it can't be picked by name), and tick **Bypass two-factor authentication**. npm caps write tokens at 90 days; note the expiry. (npm no longer issues the old "Automation" tokens; this is the replacement.)
3. **Save it in the repo:** GitHub → `ucsdds3/datahacks` → Settings → Secrets and variables → Actions → New repository secret, name `NPM_TOKEN`, value the token.
4. **Release:** with `version` in `packages/datahacks-mcp/package.json` set (it starts at `0.1.0`), on an up-to-date `main`:
   ```sh
   git tag datahacks-mcp-v0.1.0
   git push origin datahacks-mcp-v0.1.0
   ```
   Watch the "publish-mcp" run in the Actions tab, then check <https://www.npmjs.com/package/datahacks-mcp>.
5. **Then** set `NPM_PUBLISHED = true` in `src/pages/applyWithAiConfig.ts` so the site shows the npx commands.

Afterwards (optional, recommended): on the package's npm page → Settings → **Trusted Publisher**, add GitHub Actions with repository `ucsdds3/datahacks` and workflow `publish-mcp.yml`. Publishing then needs no token at all, and you can delete the `NPM_TOKEN` secret and the token.

Later releases: bump `version`, merge, tag `datahacks-mcp-v<new version>`, push the tag.

## License

MIT. Made by DS3 at UC San Diego for [DataHacks](https://datahacks.ds3atucsd.com).
