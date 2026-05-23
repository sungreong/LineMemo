import {
  clearPasswordRecord,
  createPasswordRecord,
  isLockConfigured,
  lockTimeoutMs,
  verifyPassword
} from "../security/appLock.js";

export function createLockActions({ state, scheduleSave, notify, render, clearSecrets, openSettings }) {
  let inactivityTimer = null;

  function configured() {
    return isLockConfigured(state.data.settings);
  }

  function armInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (!configured() || state.lock.locked) return;
    inactivityTimer = setTimeout(() => lockApp("timeout"), lockTimeoutMs(state.data.settings));
  }

  function touchActivity() {
    if (!configured() || state.lock.locked) return;
    state.lock.lastActivityAt = Date.now();
    armInactivityTimer();
  }

  function lockOnBoot() {
    state.lock.locked = configured();
    state.lock.unlockError = "";
    state.lock.lastActivityAt = Date.now();
    if (!state.lock.locked) armInactivityTimer();
  }

  function lockApp(reason = "manual") {
    if (!configured()) {
      notify("설정에서 비밀번호를 먼저 설정하세요");
      openSettings?.();
      return false;
    }
    clearTimeout(inactivityTimer);
    clearSecrets();
    state.lock.locked = true;
    state.lock.reason = reason;
    state.lock.unlockError = "";
    render();
    return true;
  }

  async function unlockApp(password) {
    if (await verifyPassword(password, state.data.settings)) {
      state.lock.locked = false;
      state.lock.unlockError = "";
      state.lock.reason = "";
      state.lock.lastActivityAt = Date.now();
      armInactivityTimer();
      render();
      return true;
    }
    state.lock.unlockError = "비밀번호가 맞지 않습니다.";
    render();
    return false;
  }

  async function setPassword(password, confirm) {
    if (password !== confirm) {
      notify("새 비밀번호가 서로 다릅니다");
      return false;
    }
    Object.assign(state.data.settings, await createPasswordRecord(password));
    state.data.settings.lockTimeoutMinutes = Number(state.data.settings.lockTimeoutMinutes || 60);
    scheduleSave();
    notify("앱 잠금이 켜졌습니다");
    render();
    armInactivityTimer();
    return true;
  }

  async function changePassword(currentPassword, nextPassword, confirm) {
    if (!(await verifyPassword(currentPassword, state.data.settings))) {
      notify("현재 비밀번호가 맞지 않습니다");
      return false;
    }
    return setPassword(nextPassword, confirm);
  }

  async function removePassword(currentPassword) {
    if (!(await verifyPassword(currentPassword, state.data.settings))) {
      notify("현재 비밀번호가 맞지 않습니다");
      return false;
    }
    Object.assign(state.data.settings, clearPasswordRecord(state.data.settings));
    clearTimeout(inactivityTimer);
    scheduleSave();
    notify("앱 잠금이 꺼졌습니다");
    render();
    return true;
  }

  function bindActivityTracking() {
    ["pointerdown", "keydown", "input"].forEach((eventName) => {
      window.addEventListener(eventName, touchActivity, { passive: true });
    });
    window.addEventListener("focus", () => {
      if (!configured() || state.lock.locked) return;
      const elapsed = Date.now() - Number(state.lock.lastActivityAt || 0);
      if (elapsed >= lockTimeoutMs(state.data.settings)) lockApp("timeout");
      else armInactivityTimer();
    });
  }

  return {
    bindActivityTracking,
    changePassword,
    lockApp,
    lockOnBoot,
    removePassword,
    setPassword,
    touchActivity,
    unlockApp
  };
}

export function bindLockForms({ unlockApp, setPassword, changePassword, removePassword }) {
  document.querySelector("#unlock-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await unlockApp(new FormData(event.currentTarget).get("password"));
  });

  document.querySelector("#lock-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const current = data.get("currentPassword");
    const next = data.get("newPassword");
    const confirm = data.get("confirmPassword");
    const ok = current ? await changePassword(current, next, confirm) : await setPassword(next, confirm);
    if (ok) event.currentTarget.reset();
  });

  document.querySelector("#lock-remove-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ok = await removePassword(new FormData(event.currentTarget).get("currentPassword"));
    if (ok) event.currentTarget.reset();
  });
}
