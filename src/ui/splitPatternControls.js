import { DEFAULT_SPLIT_PATTERN } from "../domain.js";
import { icon } from "./icons.js";
import { escapeAttr } from "./utils.js";

export function renderPatternInsertButton() {
  return `<button type="button" class="compact pattern-add-button" data-action="insert-split-pattern" title="현재 분리 기준을 내용에 넣기" aria-label="현재 분리 기준을 내용에 넣기">${icon("plus")} 패턴 넣기</button>`;
}

export function renderSplitPatternTools(splitPattern, inputAttrs = "", copied = false) {
  const pattern = splitPattern || DEFAULT_SPLIT_PATTERN;
  return `
    <div class="pattern-field option-field">
      <span class="option-label">분리 기준</span>
      <div class="pattern-control-row" role="group" aria-label="분리 기준 도구">
        <input name="quickSplitPattern" ${inputAttrs} value="${escapeAttr(pattern)}" placeholder="${escapeAttr(DEFAULT_SPLIT_PATTERN)}" aria-label="분리 기준" />
        <button type="button" class="icon-button" data-action="copy-split-pattern" title="분리 기준 복사" aria-label="분리 기준 복사">${icon(copied ? "check" : "copy")}</button>
      </div>
    </div>
  `;
}
