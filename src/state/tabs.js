export function selectedTabIds(state) {
  const ids = Array.isArray(state.activeTabIds) ? state.activeTabIds : [];
  if (ids.length) return [...new Set(ids.filter((id) => id && id !== "all"))];
  return state.activeTabId && state.activeTabId !== "all" ? [state.activeTabId] : [];
}

export function activeTabFilter(state) {
  const ids = selectedTabIds(state);
  return ids.length ? ids : "all";
}

export function isAllTabsActive(state) {
  return selectedTabIds(state).length === 0;
}

export function isTabActive(state, id) {
  return id === "all" ? isAllTabsActive(state) : selectedTabIds(state).includes(id);
}

export function defaultTabId(state) {
  const ids = selectedTabIds(state);
  const id = ids.at(-1) || state.lastRealTabId || state.activeTabId;
  return id && id !== "all" ? id : "inbox";
}

export function syncActiveTabs(state, id, options = {}) {
  const validIds = state.data.tabs.filter((tab) => tab.id !== "all").map((tab) => tab.id);
  const valid = new Set(validIds);
  let next = [];

  if (id !== "all" && valid.has(id)) {
    state.lastRealTabId = id;
    if (options.single) {
      next = [id];
    } else {
      const selected = new Set(selectedTabIds(state).filter((entry) => valid.has(entry)));
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      next = validIds.filter((entry) => selected.has(entry));
    }
  }

  state.activeTabIds = next;
  state.activeTabId = next.length ? (id !== "all" && next.includes(id) ? id : next.at(-1)) : "all";
  return next;
}
