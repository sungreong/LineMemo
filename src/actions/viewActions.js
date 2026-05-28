export function createViewActions({ state, render }) {
  function toggleSetCollapse(setKey) {
    if (!setKey) return;
    state.collapsedSets = state.collapsedSets || {};
    if (state.collapsedSets[setKey]) delete state.collapsedSets[setKey];
    else state.collapsedSets[setKey] = true;
    render();
  }

  function toggleVisibleSetCollapse(setKeys = []) {
    const keys = [...new Set(setKeys.filter(Boolean))];
    if (!keys.length) return;
    state.collapsedSets = state.collapsedSets || {};
    const shouldExpand = keys.every((key) => state.collapsedSets[key]);
    for (const key of keys) {
      if (shouldExpand) delete state.collapsedSets[key];
      else state.collapsedSets[key] = true;
    }
    render();
  }

  function setViewMode(mode) {
    state.viewMode = mode === "table" ? "table" : "cards";
    if (mode === "dense") state.denseMode = true;
    localStorage.setItem("linememo-view-mode", state.viewMode);
    localStorage.setItem("linememo-dense-mode", String(state.denseMode));
    render();
  }

  function focusTableAdd() {
    state.viewMode = "table";
    state.showTableAdd = true;
    localStorage.setItem("linememo-view-mode", state.viewMode);
    render();
    queueMicrotask(() => document.querySelector("[data-table-quick-add] [name='lineValue']")?.focus());
  }

  return { setViewMode, focusTableAdd, toggleSetCollapse, toggleVisibleSetCollapse };
}
