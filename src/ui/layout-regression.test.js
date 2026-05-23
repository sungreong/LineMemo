import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const toolbarCss = readFileSync(new URL("../styles/components/toolbar.css", import.meta.url), "utf8");
const baseCss = readFileSync(new URL("../styles/01-base-layout.css", import.meta.url), "utf8");
const cardRowsCss = readFileSync(new URL("../styles/02-card-rows.css", import.meta.url), "utf8");
const actionCss = readFileSync(new URL("../styles/components/action-rails.css", import.meta.url), "utf8");
const modalShellCss = readFileSync(new URL("../styles/components/modal-shell.css", import.meta.url), "utf8");
const settingsCss = readFileSync(new URL("../styles/features/settings-backup.css", import.meta.url), "utf8");
const responsiveCss = readFileSync(new URL("../styles/05-responsive-dense.css", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("./renderers.js", import.meta.url), "utf8");

function walkFiles(dir, predicate, acc = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walkFiles(path, predicate, acc);
    } else if (predicate(path)) {
      acc.push(path);
    }
  }
  return acc;
}

describe("layout regression guards", () => {
  test("toolbar actions are owned by the toolbar module and are not clipped", () => {
    const block = toolbarCss.match(/\.toolbar-actions\s*\{[^}]+\}/)?.[0] || "";
    expect(block).toContain("overflow: visible");
    expect(block).not.toContain("overflow: hidden");
    expect(toolbarCss).toContain("grid-template-areas:");
    expect(toolbarCss).toContain("@media (max-width: 640px)");
  });

  test("preview and table row actions are grouped in the action rail module", () => {
    expect(actionCss).toContain(".preview-actions");
    expect(actionCss).toContain(".table-actions");
    expect(actionCss).toContain(".line-edit-actions");
    expect(responsiveCss).not.toContain(".preview-row .copy-line");
    expect(responsiveCss).not.toContain(".preview-row button:not(.copy-line)");
  });

  test("modal and backup controls stay compact and consistent", () => {
    expect(modalShellCss).toContain("width: min(calc(100vw - 24px), 460px)");
    expect(modalShellCss).toContain("@media (max-width: 560px)");
    expect(settingsCss).toContain(".backup-button");
    expect(settingsCss).toContain("font-size: var(--font-sm)");
  });

  test("line detail editor keeps label and type on the same row", () => {
    expect(responsiveCss).not.toContain(".line-editor-grid,\n  .line-editor-actions");
    expect(responsiveCss).toContain(".line-editor-grid");
    expect(responsiveCss).toContain("minmax(104px, 0.45fr)");
  });

  test("form fields use theme-aware backgrounds", () => {
    expect(baseCss).toContain("--field-bg");
    expect(toolbarCss).toContain("background: var(--field-bg)");
    expect(cardRowsCss).toContain("background: var(--field-bg)");
    expect(`${toolbarCss}\n${cardRowsCss}`).not.toContain("background: oklch(99% 0.006 82)");
  });

  test("source JS and CSS files stay under the 1000 line budget", () => {
    const srcDir = fileURLToPath(new URL("..", import.meta.url));
    const files = walkFiles(srcDir, (path) => [".css", ".js"].includes(extname(path)));
    const overBudget = files
      .map((path) => ({ path, lines: readFileSync(path, "utf8").split(/\r?\n/).length }))
      .filter(({ lines }) => lines > 1000);

    expect(overBudget).toEqual([]);
  });

  test("rendered buttons declare their button type explicitly", () => {
    expect(rendererSource.match(/<button(?![^>]*\btype=)/g)).toBeNull();
  });
});
