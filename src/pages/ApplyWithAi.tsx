import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { NoIndex } from "@/components/NoIndex";
import { portal } from "@/portal/paths";
import { PORTAL_BACKGROUND } from "@/portal/theme";
import { portalTitle } from "@/portal/titles";
import {
  CLAUDE_CODE_COMMAND, FIRST_MESSAGE, INSTALL_COMMAND, MCP_LIVE, MCP_URL, NPM_PUBLISHED, clientConfig,
} from "./applyWithAiConfig";
import "./apply-with-ai.css";

/** Copies `text`, falling back to a hidden textarea where the Clipboard API isn't allowed (http, old Safari). */
async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** A command, URL or snippet with a copy button. */
function Copyable({ label, text, block = false }: { label: string; text: string; block?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };
  return (
    <div className={block ? "awa-copy awa-copy-block" : "awa-copy"}>
      {block ? <pre><code>{text}</code></pre> : <code>{text}</code>}
      <button type="button" className="awa-copy-button" onClick={copy} aria-label={`Copy ${label}`}>
        {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}
      </button>
      <span className="awa-sr" aria-live="polite">{state === "copied" ? `${label} copied` : state === "failed" ? "Couldn't copy; select the text instead" : ""}</span>
    </div>
  );
}

type Tab = { id: string; label: string; body: ReactNode };

function tabs(npmPublished: boolean): Tab[] {
  const ask = (
    <li>Start a new chat and ask: <q>{FIRST_MESSAGE}</q> (or as a mentor or judge). Sign in with Google when it asks, and choose <strong>Allow</strong>.</li>
  );
  const list: Tab[] = [
    {
      id: "claude",
      label: "Claude",
      body: (
        <>
          <p>On claude.ai, the Claude desktop app, or the mobile app.</p>
          <ol>
            <li>Open <strong>Settings → Connectors</strong> and choose <strong>Add custom connector</strong>.</li>
            <li>Name it <strong>DataHacks</strong> and paste this URL:
              <Copyable label="server URL" text={MCP_URL} />
            </li>
            <li>Choose <strong>Add</strong>, then <strong>Connect</strong>.</li>
            {ask}
          </ol>
          <p className="awa-note">Don't see custom connectors? They depend on your Claude plan, and on a Team or Enterprise plan an owner may need to turn them on. Try another tab, or use the form.</p>
        </>
      ),
    },
  ];
  if (npmPublished) {
    list.push({
      id: "one-command",
      label: "One command",
      body: (
        <>
          <p>Sets up Claude Desktop, Cursor and Claude Code in one go. Run it in a terminal (it needs <a href="https://nodejs.org">Node.js</a> 20 or newer):</p>
          <Copyable label="install command" text={INSTALL_COMMAND} />
          <p>It finds the apps on your computer, shows each change and asks before making it, and backs up any file it edits. Your other settings stay as they are. <code>--dry-run</code> shows what it would do without changing anything.</p>
          <ol>
            <li>Quit the app completely and open it again.</li>
            {ask}
          </ol>
        </>
      ),
    });
  }
  list.push(
    {
      id: "claude-code",
      label: "Claude Code",
      body: (
        <>
          <p>In a terminal:</p>
          <Copyable label="Claude Code command" text={CLAUDE_CODE_COMMAND} />
          <ol>
            <li>Start <code>claude</code>, run <code>/mcp</code>, pick <strong>datahacks</strong> and sign in.</li>
            {ask}
          </ol>
          <p className="awa-note">Add <code>--scope user</code> before <code>datahacks</code> to have it in every folder, not just this one.</p>
        </>
      ),
    },
    {
      id: "cursor",
      label: "Cursor & others",
      body: (
        <>
          <p>
            In Cursor, open <strong>Settings → MCP → Add new MCP server</strong>, or add this to <code>~/.cursor/mcp.json</code>.
            Other apps that take MCP servers (VS Code, Windsurf, Claude Desktop's config file) use the same shape.
          </p>
          <Copyable label="MCP config" text={clientConfig(npmPublished)} block />
          {!npmPublished && <p className="awa-note">This needs an app that can sign in to remote MCP servers itself. Most current ones can.</p>}
          <ol>
            <li>Restart the app and check that <strong>datahacks</strong> is switched on.</li>
            {ask}
          </ol>
        </>
      ),
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      body: (
        <>
          <p>Where available. ChatGPT can connect to custom MCP servers on some plans, through developer mode:</p>
          <ol>
            <li>Turn on developer mode under <strong>Settings → Apps &amp; Connectors → Advanced settings</strong>.</li>
            <li>Create a connector named <strong>DataHacks</strong> with this URL, using OAuth:
              <Copyable label="server URL" text={MCP_URL} />
            </li>
            <li>In a new chat, choose the DataHacks connector, then ask: <q>{FIRST_MESSAGE}</q>. Sign in with Google when it asks.</li>
          </ol>
          <p className="awa-note">Menu names change, and it isn't on every plan. If you can't find it, use another assistant or the form.</p>
        </>
      ),
    },
  );
  return list;
}

/** Arrow keys, Home and End move between tabs (the WAI-ARIA tabs pattern). */
function Tabs({ items }: { items: Tab[] }) {
  const base = useId();
  const initial = () => {
    const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return items.some(t => t.id === hash) ? hash : items[0].id;
  };
  const [active, setActive] = useState(initial);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string, focus = false) => {
    setActive(id);
    if (focus) refs.current[id]?.focus();
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      // not allowed in this frame
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex(t => t.id === active);
    const next =
      event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    select(items[next].id, true);
  };

  return (
    <div className="awa-tabs">
      <div className="awa-tablist" role="tablist" aria-label="Choose your assistant" onKeyDown={onKeyDown}>
        {items.map(tab => (
          <button
            key={tab.id}
            ref={el => { refs.current[tab.id] = el; }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            className="awa-tab"
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {items.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="awa-panel"
          tabIndex={0}
        >
          {tab.body}
        </div>
      ))}
    </div>
  );
}

/**
 * `/apply-with-ai`: how to connect an AI assistant to DataHacks' MCP server and apply
 * by chatting (docs/mcp-server.md). Public, no sign-in, and outside the portal shell
 * so it doesn't load the Supabase client. Its styles are its own (apply-with-ai.css).
 */
export default function ApplyWithAi({ live = MCP_LIVE, npmPublished = NPM_PUBLISHED }: { live?: boolean; npmPublished?: boolean }) {
  useEffect(() => {
    const html = document.documentElement;
    const before = { title: document.title, background: html.style.backgroundColor };
    document.title = portalTitle("/apply-with-ai");
    html.style.backgroundColor = PORTAL_BACKGROUND;
    return () => {
      document.title = before.title;
      html.style.backgroundColor = before.background;
    };
  }, []);

  return (
    <div className="awa-root">
      {!live && <NoIndex />}
      <div className="awa-sky" aria-hidden="true" />
      <main className="awa-main">
        <header className="awa-header">
          <img src="/datahacks-logo.png" alt="" width={56} height={56} />
          <p className="awa-eyebrow">DataHacks applications</p>
          <h1>Apply with AI</h1>
          <p className="awa-lede">
            Connect your AI assistant to DataHacks and it can fill out your application with you. It asks you the
            questions, in your own words, reads your answers back, and submits only when you say yes.
          </p>
        </header>

        {!live && (
          <div className="awa-banner" role="status">
            <strong>Coming soon.</strong> Signing in from an assistant isn't switched on yet, so these steps won't work
            quite yet. The application form works now: <Link to={portal.applyHacker}>apply as a hacker</Link> or{" "}
            <Link to={portal.applyStaff}>as a mentor or judge</Link>.
          </div>
        )}

        <section className="awa-card" aria-labelledby="awa-how">
          <h2 id="awa-how">How it works</h2>
          <ol className="awa-steps">
            <li>Add DataHacks to your assistant, using the steps for it below.</li>
            <li>Ask it: <q>{FIRST_MESSAGE}</q>, or as a mentor, a judge, or both.</li>
            <li>Sign in with Google when it asks, and choose <strong>Allow</strong>. That's the same account as the portal.</li>
            <li>Answer its questions. It reads everything back before submitting, because an application can't be changed afterwards.</li>
          </ol>
        </section>

        <section className="awa-card" aria-labelledby="awa-setup">
          <h2 id="awa-setup">Set up your assistant</h2>
          <Tabs items={tabs(npmPublished)} />
        </section>

        <section className="awa-card awa-split" aria-labelledby="awa-can">
          <div>
            <h2 id="awa-can">What it can do</h2>
            <ul>
              <li>Ask you the application's questions and check your answers the way the form does.</li>
              <li>Read your answers back and submit your application when you say yes.</li>
              <li>Tell you whether you've applied and your application's status.</li>
            </ul>
          </div>
          <div>
            <h2>What it can't do</h2>
            <ul>
              <li>See anyone else's application. It acts as you, and only you.</li>
              <li>Change your application after it's submitted, or see decisions before they're released.</li>
              <li>Do anything before you sign in and allow it. You can remove it from your assistant at any time.</li>
            </ul>
          </div>
        </section>

        <section className="awa-card" aria-labelledby="awa-form">
          <h2 id="awa-form">Rather use the form?</h2>
          <p>It's always there, and it's exactly the same application.</p>
          <div className="awa-actions">
            <Link className="awa-button" to={portal.applyHacker}>Apply as a hacker</Link>
            <Link className="awa-button awa-button-quiet" to={portal.applyStaff}>Apply as a mentor or judge</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
