import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import ApplyWithAi from "./ApplyWithAi";
import { CLAUDE_CODE_COMMAND, INSTALL_COMMAND, MCP_LIVE, MCP_URL, NPM_PUBLISHED, clientConfig } from "./applyWithAiConfig";

const renderPage = (props: { live?: boolean; npmPublished?: boolean } = {}) =>
  render(<MemoryRouter><ApplyWithAi {...props} /></MemoryRouter>);

const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("Apply with AI page", () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    window.history.replaceState(null, "", "/apply-with-ai");
  });
  afterEach(() => vi.useRealTimers());

  it("explains it, names the tab, and links to the forms", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Apply with AI" })).toBeInTheDocument();
    expect(document.title).toBe("Apply with AI · DataHacks");
    expect(screen.getByRole("heading", { name: "What it can do" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What it can't do" })).toBeInTheDocument();
    expect(screen.getByText(/See anyone else's application/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply as a hacker" })).toHaveAttribute("href", "/portal/apply/hacker");
    expect(screen.getByRole("link", { name: "Apply as a mentor or judge" })).toHaveAttribute("href", "/portal/apply/mentor-judge");
  });

  it("shows the coming-soon banner until MCP is live", () => {
    const { unmount } = renderPage({ live: false });
    expect(screen.getByRole("status")).toHaveTextContent(/Coming soon/);
    expect(document.querySelector('meta[name="robots"]')).not.toBeNull();
    unmount();
    renderPage({ live: true });
    expect(screen.queryByText(/Coming soon/)).toBeNull();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("ships with the banner on, and the npx commands on now that datahacks-mcp is on npm", () => {
    expect(MCP_LIVE).toBe(false);
    expect(NPM_PUBLISHED).toBe(true);
  });

  it("never shows an npx command before the package is published", () => {
    renderPage({ npmPublished: false });
    expect(screen.queryByRole("tab", { name: /One command/ })).toBeNull();
    fireEvent.click(tab(/Cursor/));
    expect(document.body.textContent).not.toMatch(/npx/);
    expect(clientConfig(false)).toContain(MCP_URL);
  });

  it("has a tab per assistant, and arrow keys move between them", () => {
    renderPage({ npmPublished: true });
    const names = screen.getAllByRole("tab").map(t => t.textContent);
    expect(names).toEqual(["Claude", "One command", "Claude Code", "Cursor & others", "ChatGPT"]);
    expect(tab(/^Claude$/)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Settings → Connectors/);

    fireEvent.keyDown(tab(/^Claude$/), { key: "ArrowRight" });
    expect(tab(/One command/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/One command/)).toHaveFocus();
    fireEvent.keyDown(tab(/One command/), { key: "End" });
    expect(tab(/ChatGPT/)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Where available/);
    fireEvent.keyDown(tab(/ChatGPT/), { key: "ArrowRight" });
    expect(tab(/^Claude$/)).toHaveAttribute("aria-selected", "true");
    expect(window.location.hash).toBe("#claude");
  });

  it("opens the tab named in the URL's #", () => {
    window.history.replaceState(null, "", "/apply-with-ai#claude-code");
    renderPage();
    expect(tab(/Claude Code/)).toHaveAttribute("aria-selected", "true");
  });

  it.each([
    [/^Claude$/, "server URL", MCP_URL],
    [/One command/, "install command", INSTALL_COMMAND],
    [/Claude Code/, "Claude Code command", CLAUDE_CODE_COMMAND],
    [/Cursor/, "MCP config", clientConfig(true)],
    [/ChatGPT/, "server URL", MCP_URL],
  ])("copies exactly what's shown (%s)", async (tabName, label, text) => {
    renderPage({ npmPublished: true });
    fireEvent.click(tab(tabName));
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(text.replace(/\s+/g, " ").trim());
    const button = within(panel).getByRole("button", { name: `Copy ${label}` });
    await act(async () => { fireEvent.click(button); });
    expect(writeText).toHaveBeenCalledWith(text);
    expect(button).toHaveTextContent("Copied");
    expect(within(panel).getByText(`${label} copied`)).toBeInTheDocument();
  });

  it("goes back to Copy after a moment, and says so when copying fails", async () => {
    vi.useFakeTimers();
    renderPage();
    const button = within(screen.getByRole("tabpanel")).getByRole("button", { name: "Copy server URL" });
    await act(async () => { fireEvent.click(button); });
    expect(button).toHaveTextContent("Copied");
    act(() => { vi.advanceTimersByTime(2100); });
    expect(button).toHaveTextContent("Copy");

    writeText.mockRejectedValueOnce(new Error("denied"));
    document.execCommand = vi.fn().mockReturnValue(false);
    await act(async () => { fireEvent.click(button); });
    expect(button).toHaveTextContent("Select and copy");
  });

  it("the commands match the npm package's server URL", () => {
    const constants = fs.readFileSync(path.resolve(__dirname, "../../packages/datahacks-mcp/src/constants.js"), "utf8");
    expect(constants).toContain(`PRODUCTION_URL = "${MCP_URL}"`);
    expect(INSTALL_COMMAND).toBe("npx -y datahacks-mcp install");
    expect(CLAUDE_CODE_COMMAND).toBe(`claude mcp add --transport http datahacks ${MCP_URL}`);
    expect(JSON.parse(clientConfig(true))).toEqual({ mcpServers: { datahacks: { command: "npx", args: ["-y", "datahacks-mcp"] } } });
  });

  it("is a deployed route", () => {
    const deploy = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/deploy.yml"), "utf8");
    expect(deploy).toContain("'/apply-with-ai'");
  });
});
