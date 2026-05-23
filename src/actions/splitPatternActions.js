import { DEFAULT_SPLIT_PATTERN } from "../domain.js";

function splitPatternFromForm(form) {
  if (!form) return DEFAULT_SPLIT_PATTERN;
  const value = String(new FormData(form).get("quickSplitPattern") || DEFAULT_SPLIT_PATTERN).trim();
  return value || DEFAULT_SPLIT_PATTERN;
}

function insertOnOwnLine(field, pattern) {
  const value = String(field.value || "");
  const start = typeof field.selectionStart === "number" ? field.selectionStart : value.length;
  const end = typeof field.selectionEnd === "number" ? field.selectionEnd : start;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const leadingBreak = before && !before.endsWith("\n") ? "\n" : "";
  const trailingBreak = after ? (after.startsWith("\n") ? "" : "\n") : "\n";
  const insert = `${leadingBreak}${pattern}${trailingBreak}`;
  field.value = `${before}${insert}${after}`;
  const cursor = before.length + leadingBreak.length + pattern.length + trailingBreak.length;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
  field.setSelectionRange?.(cursor, cursor);
}

function targetField(form, trigger) {
  return trigger?.closest?.(".field-shell")?.querySelector("textarea")
    || form?.querySelector("[name='quickText'], [name='quickValues'], #paste-area");
}

export function createSplitPatternActions({ copyText, notify }) {
  return {
    copySplitPattern: (form) => copyText(splitPatternFromForm(form), "split-pattern"),
    insertSplitPattern(form, trigger) {
      const field = targetField(form, trigger);
      if (!field) {
        notify("패턴을 넣을 입력칸이 없습니다");
        return;
      }
      insertOnOwnLine(field, splitPatternFromForm(form));
    }
  };
}
