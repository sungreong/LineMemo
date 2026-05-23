export function createViewActions({ state, render }) {
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

  return { setViewMode, focusTableAdd };
}
