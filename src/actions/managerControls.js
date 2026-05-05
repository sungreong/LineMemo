export function bindManagerControls({ state, render }) {
  document.querySelectorAll("[data-manager-field]").forEach((control) => {
    const eventName = control.tagName === "SELECT" ? "change" : "input";
    control.addEventListener(eventName, (event) => {
      const field = event.currentTarget.dataset.managerField;
      if (!field) return;
      state.managerFilters[field] = event.currentTarget.value;
      state.managerPages[field.startsWith("tag") ? "tags" : "tabs"] = 1;
      render();
    });
  });
}
