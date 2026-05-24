import { expiryLabel, lineExpiryInfo } from "../expiry.js";
import { escapeAttr, escapeHtml } from "./utils.js";

export function renderExpiryBadge(item) {
  const info = lineExpiryInfo(item);
  if (!info) return "";
  const state = info.expired ? "expired" : info.today ? "today" : "upcoming";
  const title = info.expired
    ? `유효기간 지남: ${info.date}`
    : `유효기간: ${info.date}`;
  return `<span class="line-expiry-chip ${state}" title="${escapeAttr(title)}">${escapeHtml(expiryLabel(info))}</span>`;
}

export function expiryStateClass(item) {
  const info = lineExpiryInfo(item);
  if (!info) return "";
  if (info.expired) return "expired-line";
  if (info.daysLeft <= 3) return "expiring-line";
  return "dated-line";
}
