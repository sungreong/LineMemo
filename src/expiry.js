const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function lineExpiryInfo(item, now = new Date()) {
  const date = parseDateOnly(item?.expiresAt);
  if (!date) return null;
  const daysLeft = Math.ceil((date.getTime() - startOfLocalDay(now).getTime()) / DAY_MS);
  return {
    date: item.expiresAt,
    daysLeft,
    expired: daysLeft < 0,
    today: daysLeft === 0
  };
}

export function expiryLabel(info) {
  if (!info) return "";
  if (info.expired) return `만료 ${info.date}`;
  if (info.today) return "오늘 만료";
  return `D-${info.daysLeft}`;
}

export function collectExpiryEntries(data, beforeDays = 7, now = new Date()) {
  const entries = [];
  for (const card of data?.cards || []) {
    for (const item of card.items || []) {
      if (item.type === "divider") continue;
      const info = lineExpiryInfo(item, now);
      if (!info || (!info.expired && info.daysLeft > beforeDays)) continue;
      entries.push({ card, item, info });
    }
  }
  return entries.sort((a, b) => a.info.daysLeft - b.info.daysLeft || a.card.title.localeCompare(b.card.title, "ko"));
}

export function summarizeExpiry(data, beforeDays = 7, now = new Date()) {
  const entries = collectExpiryEntries(data, beforeDays, now);
  const expired = entries.filter((entry) => entry.info.expired);
  const upcoming = entries.filter((entry) => !entry.info.expired);
  return {
    entries,
    expired,
    upcoming,
    total: entries.length,
    title: expired.length ? "유효기간이 지난 복사본이 있습니다" : "유효기간이 임박한 복사본이 있습니다",
    body: [
      expired.length ? `만료 ${expired.length}줄` : "",
      upcoming.length ? `${beforeDays}일 내 만료 ${upcoming.length}줄` : ""
    ].filter(Boolean).join(", ")
  };
}
