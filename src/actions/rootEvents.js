const boundRoots = new WeakSet();

export function bindRootActions(root, handleAction) {
  if (!root || boundRoots.has(root)) return false;
  boundRoots.add(root);

  root.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element || !root.contains(element)) return;
    handleAction(element, event);
  });

  return true;
}
