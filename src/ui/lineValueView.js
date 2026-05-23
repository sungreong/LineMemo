import { escapeAttr, escapeHtml } from "./utils.js";

const TYPE_LABELS = {
  text: "text",
  url: "url",
  command: "cmd",
  code: "code",
  image: "img",
  note: "note"
};

export function lineTypeLabel(type) {
  return TYPE_LABELS[type] || type || "text";
}

export function isImageValue(value) {
  const text = String(value || "").trim();
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(text)
    || /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif)(?:[?#]\S*)?$/i.test(text);
}

function safeImageSrc(value) {
  const text = String(value || "").trim();
  return isImageValue(text) ? text : "";
}

function compactLine(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  const first = text.split("\n").find((line) => line.trim()) || text;
  return first.replace(/\s+/g, " ").trim();
}

function isLongValue(value) {
  const text = String(value || "");
  return text.length > 120 || text.split(/\r?\n/).length > 1;
}

function typePill(type) {
  return `<span class="line-type-pill">${escapeHtml(lineTypeLabel(type))}</span>`;
}

export function renderLineValueHtml(item, options = {}) {
  const { revealed = true, expandable = false } = options;
  const type = item.type || "text";
  const value = String(item.value || "");
  if (!revealed) return `<span class="masked-value">********</span>`;

  if (type === "image") {
    const src = safeImageSrc(value);
    return `
      <span class="image-value-view">
        ${typePill(type)}
        ${src ? `<img src="${escapeAttr(src)}" alt="" loading="lazy" />` : ""}
        ${src ? `<a class="value-link" href="${escapeAttr(src)}" target="_blank" rel="noreferrer">${escapeHtml(compactLine(value) || "이미지 URL")}</a>` : `<code>${escapeHtml(compactLine(value) || "이미지 URL")}</code>`}
      </span>
    `;
  }

  if (type === "url") {
    return `${typePill(type)}<a class="value-link" href="${escapeAttr(value)}" target="_blank" rel="noreferrer">${escapeHtml(compactLine(value))}</a>`;
  }

  const body = `${typePill(type)}<code>${escapeHtml(compactLine(value))}</code>`;
  if (!expandable || !isLongValue(value)) return body;

  const lineCount = value.split(/\r?\n/).length;
  return `
    <details class="line-value-details">
      <summary>${body}<span class="line-more">${lineCount}줄</span></summary>
      <pre>${escapeHtml(value)}</pre>
    </details>
  `;
}
