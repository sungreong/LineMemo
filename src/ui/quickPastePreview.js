import { DEFAULT_SPLIT_PATTERN, applyBaseLabelToItems, applyGroupToItems, parsePasteItems } from "../domain.js";
import { escapeHtml } from "./utils.js";

const SENSITIVE_PATTERN = /(비밀번호|패스워드|암호|password|passwd|secret|token|api[-_ ]?key|apikey|client secret|tenant|pw)/i;

function isSensitiveCandidate(item) {
  return SENSITIVE_PATTERN.test(`${item.label || ""} ${item.value || ""}`);
}

function previewFieldsFromForm(form) {
  const formData = new FormData(form);
  return {
    text: formData.get("quickText"),
    baseLabel: formData.get("quickBaseLabel"),
    group: formData.get("quickGroup"),
    splitMode: formData.get("quickSplitMode"),
    splitPattern: formData.get("quickSplitPattern")
  };
}

export function buildQuickPastePreview(fields = {}) {
  const text = String(fields.text || "");
  if (!text.trim()) return { empty: true, count: 0, samples: [], sensitiveCount: 0 };
  const splitMode = fields.splitMode === "pattern" ? "pattern" : "line";
  const splitPattern = String(fields.splitPattern || DEFAULT_SPLIT_PATTERN).trim() || DEFAULT_SPLIT_PATTERN;
  const group = String(fields.group || "").trim();
  const items = applyGroupToItems(applyBaseLabelToItems(parsePasteItems(text, { splitMode, splitPattern }), fields.baseLabel), group)
    .filter((item) => item.type !== "divider");
  const sensitiveCount = items.filter(isSensitiveCandidate).length;
  return {
    empty: false,
    count: items.length,
    itemLabel: splitMode === "pattern" ? "항목" : "줄",
    splitLabel: splitMode === "pattern" ? `패턴 ${splitPattern}` : "줄바꿈",
    group,
    sensitiveCount,
    samples: items.slice(0, 3).map((item) => ({
      label: item.label || item.type || "값",
      value: isSensitiveCandidate(item) ? "민감할 수 있음" : item.value
    }))
  };
}

function renderPreviewContent(fields) {
  const preview = buildQuickPastePreview(fields);
  if (preview.empty) return "";
  const samples = preview.samples.map((item) => `
    <span><strong>${escapeHtml(item.label)}</strong>${escapeHtml(item.value)}</span>
  `).join("");
  return `
    <div class="quick-preview-summary">
      <strong>${preview.count}개 ${preview.itemLabel} 추가 예정</strong>
      <span>분리 기준: ${escapeHtml(preview.splitLabel)}</span>
      ${preview.group ? `<span>세트: ${escapeHtml(preview.group)}</span>` : ""}
      ${preview.sensitiveCount ? `<em>민감 후보 ${preview.sensitiveCount}개</em>` : ""}
    </div>
    ${samples ? `<div class="quick-preview-samples">${samples}</div>` : ""}
  `;
}

export function renderQuickPastePreview(fields) {
  return `<div class="quick-paste-preview" data-quick-paste-preview aria-live="polite">${renderPreviewContent(fields)}</div>`;
}

export function bindQuickPastePreview() {
  const form = document.querySelector("#quick-form");
  const preview = form?.querySelector("[data-quick-paste-preview]");
  if (!form || !preview) return;
  const update = () => {
    const content = renderPreviewContent(previewFieldsFromForm(form));
    preview.innerHTML = content;
    preview.classList.toggle("visible", Boolean(content));
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}
