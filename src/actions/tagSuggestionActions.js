import { formatTags, parseTags } from "../domain.js";
import { syncTagSuggestionPanel } from "../ui/tagSuggestions.js";

const boundRoots = new WeakSet();

export function bindTagSuggestionActions(root, { state }) {
  if (!root || boundRoots.has(root)) return;
  boundRoots.add(root);
  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-tag-suggestion]");
    if (!button || !root.contains(button)) return;
    const input = button.closest("form")?.querySelector("[data-tag-input]");
    if (!input) return;
    const tags = parseTags(`${input.value}, ${button.dataset.tagSuggestion}`);
    input.value = formatTags(tags);
    if (state.editorDraft) state.editorDraft.tags = input.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });
  root.addEventListener("input", (event) => {
    const form = event.target.closest?.("#card-form");
    if (form) syncTagSuggestionPanel(form, state);
  });
}
