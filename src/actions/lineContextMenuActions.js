import { copyTextForItems, sortedItems } from "../domain.js";

const boundRoots = new WeakSet();

function interactiveTarget(target, { allowEditableCells = false } = {}) {
  const selector = allowEditableCells
    ? "button, input, textarea, select, summary, [data-line-menu-action]"
    : "button, input, textarea, select, a, summary, [data-cell-edit], [data-line-menu-action]";
  return Boolean(target?.closest?.(selector));
}

function lineFromTarget(state, target) {
  const row = target?.closest?.("[data-line-row]");
  if (!row) return null;
  const card = state.data.cards.find((entry) => entry.id === row.dataset.card);
  const item = card?.items.find((line) => line.id === row.dataset.id);
  if (!card || !item || item.type === "divider") return null;
  return { row, card, item };
}

function findLine(state, cardId, lineId) {
  const card = state.data.cards.find((entry) => entry.id === cardId);
  const item = card?.items.find((line) => line.id === lineId);
  return card && item ? { card, item } : null;
}

function lineText(item, includeLabel = false) {
  if (!includeLabel || !String(item.label || "").trim()) return item.value;
  return `${item.label}: ${item.value}`;
}

function relatedLineItems(card, item) {
  const group = String(item?.group || "").trim();
  if (!group) return [];
  return sortedItems(card.items).filter((entry) => entry.type !== "divider" && String(entry.group || "").trim() === group);
}

function clampMenuPoint(event) {
  const width = 228;
  const height = 356;
  return {
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))
  };
}

async function copyLine(copyText, card, item, includeLabel = false) {
  await copyText(lineText(item, includeLabel), {
    key: includeLabel ? `line:${card.id}:${item.id}:label` : `line:${card.id}:${item.id}`,
    type: "line",
    label: includeLabel ? (item.label || item.type || "라벨 포함") : (item.label || item.type || "값"),
    secret: item.secret
  });
}

export function bindLineContextMenuActions(root, deps) {
  if (!root || boundRoots.has(root)) return;
  boundRoots.add(root);
  const { state, render, copyText, startLineEdit, startLineMove, deleteCardLine, toggleReveal } = deps;

  root.addEventListener("contextmenu", async (event) => {
    if (!state.data.settings.lineContextMenu || interactiveTarget(event.target, { allowEditableCells: true })) return;
    const found = lineFromTarget(state, event.target);
    if (!found) return;
    event.preventDefault();
    const point = clampMenuPoint(event);
    state.lineContextMenu = { cardId: found.card.id, lineId: found.item.id, x: point.x, y: point.y };
    render();
    if (state.data.settings.rightClickCopy) await copyLine(copyText, found.card, found.item);
  });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-line-menu-action]");
    if (button) {
      event.preventDefault();
      await runMenuAction(button.dataset.lineMenuAction, button.dataset.card, button.dataset.id);
      return;
    }
    if (state.lineContextMenu && !event.target.closest?.(".line-context-menu")) {
      state.lineContextMenu = null;
      render();
    }
    if (!state.data.settings.lineClickSelect || interactiveTarget(event.target)) return;
    const found = lineFromTarget(state, event.target);
    if (!found) return;
    const key = `${found.card.id}:${found.item.id}`;
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.lineContextMenu) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.lineContextMenu = null;
    render();
  });

  async function runMenuAction(action, cardId, lineId) {
    const found = findLine(state, cardId, lineId);
    state.lineContextMenu = null;
    if (!found) {
      render();
      return;
    }
    const { card, item } = found;
    if (action === "copy") await copyLine(copyText, card, item);
    if (action === "copy-label") await copyLine(copyText, card, item, true);
    if (action === "edit") startLineEdit(card.id, item.id);
    if (action === "move") startLineMove(card.id, item.id);
    if (action === "select") {
      const key = `${card.id}:${item.id}`;
      if (state.selected.has(key)) state.selected.delete(key);
      else state.selected.add(key);
      render();
    }
    if (action === "reveal") toggleReveal(item.id);
    if (action === "open-url") {
      window.open(item.value, "_blank", "noopener,noreferrer");
      render();
    }
    if (action === "copy-group") {
      const related = relatedLineItems(card, item);
      await copyText(copyTextForItems(related, true), { key: `group:${card.id}:${item.group}`, type: "group", label: item.group, count: related.length, secret: related.some((entry) => entry.secret) });
    }
    if (action === "copy-group-tab") {
      const related = relatedLineItems(card, item);
      await copyText(related.map((entry) => entry.value).join("\t"), { key: `group:${card.id}:${item.group}:tab`, type: "group-tab", label: item.group, count: related.length, secret: related.some((entry) => entry.secret) });
    }
    if (action === "copy-group-next") {
      const related = relatedLineItems(card, item);
      const key = `group:${card.id}:${item.group}:next`;
      state.groupCopyCursor = state.groupCopyCursor || {};
      const index = state.groupCopyCursor[key] || 0;
      const next = related[index % Math.max(related.length, 1)];
      state.groupCopyCursor[key] = (index + 1) % Math.max(related.length, 1);
      await copyText(next?.value || "", { key, type: "group-next", label: next?.label || item.group, index: index + 1, count: related.length, secret: next?.secret });
    }
    if (action === "delete") deleteCardLine(card.id, item.id);
  }
}
