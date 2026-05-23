const DELETE_CONFIRM_SKIP_MS = 5 * 60 * 1000;

export function createDeleteConfirmActions({ state, render, notify }) {
  function requestDeleteConfirm(message, onConfirm, options = {}) {
    const skipConfirm = !state.data.settings.confirmBeforeDelete || Date.now() < Number(state.deleteConfirmMutedUntil || 0);
    if (skipConfirm) {
      onConfirm();
      return;
    }
    state.deleteConfirm = {
      message,
      detail: options.detail || "",
      onConfirm
    };
    render();
  }

  function cancelDeleteConfirm() {
    state.deleteConfirm = null;
    render();
  }

  function confirmPendingDelete(skipTemporarily = false) {
    const pending = state.deleteConfirm;
    if (!pending) return;
    state.deleteConfirm = null;
    if (skipTemporarily) state.deleteConfirmMutedUntil = Date.now() + DELETE_CONFIRM_SKIP_MS;
    pending.onConfirm?.();
    if (skipTemporarily) notify("5분 동안 삭제 확인을 묻지 않습니다");
  }

  return { requestDeleteConfirm, cancelDeleteConfirm, confirmPendingDelete };
}
