import { summarizeExpiry } from "../expiry.js";

const CHECK_MS = 15 * 60 * 1000;
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function notificationBody(summary) {
  const first = summary.entries[0];
  const nearest = first ? `${first.card.title} · ${first.item.label || first.item.type || "값"} (${first.info.date})` : "";
  return [summary.body, nearest ? `가장 가까운 항목: ${nearest}` : ""].filter(Boolean).join("\n");
}

async function sendDesktopNotification(summary) {
  if (!isTauri()) return false;
  const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (!granted) return false;
  sendNotification({
    title: summary.title,
    body: notificationBody(summary)
  });
  return true;
}

function dueByInterval(settings, now = Date.now()) {
  const last = Date.parse(settings.expiryNotificationLastRunAt || "");
  const intervalMs = Number(settings.expiryNotificationIntervalHours || 24) * 60 * 60 * 1000;
  return !Number.isFinite(last) || now - last >= intervalMs;
}

export function createExpiryNotificationScheduler({ state, notify, scheduleSave }) {
  let timer = null;

  async function run(options = {}) {
    const settings = state.data?.settings || {};
    const enabled = Boolean(settings.expiryNotifications);
    const force = Boolean(options.force);
    const userInitiated = Boolean(options.userInitiated);
    if (!enabled && !force) return false;
    if (!force && !dueByInterval(settings)) return false;

    const summary = summarizeExpiry(state.data, Number(settings.expiryNotifyBeforeDays || 7));
    settings.expiryNotificationLastRunAt = new Date().toISOString();
    scheduleSave?.();

    if (!summary.total) {
      if (userInitiated) notify("유효기간 임박 항목이 없습니다");
      return false;
    }

    const delivered = await sendDesktopNotification(summary);
    notify(delivered ? summary.body : `알림 준비됨 · ${summary.body}`);
    return delivered;
  }

  function sync(options = {}) {
    clearInterval(timer);
    timer = null;
    if (!state.data?.settings?.expiryNotifications) return;
    timer = setInterval(() => run(), CHECK_MS);
    if (options.immediate) run({ force: true }).catch(() => notify("알림 확인 실패"));
  }

  return {
    sync,
    runNow: () => run({ force: true, userInitiated: true }),
    stop: () => clearInterval(timer)
  };
}
