import { EXCEL_IMPORT_COLUMNS, importSampleCsvText, importSampleJsonText } from "../data/importSamples.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

function copiedIcon(state, key) {
  return state.lastCopiedKey === key ? icon("check") : icon("copy");
}

export function renderDataSettingsPanel(state) {
  const jsonSample = importSampleJsonText();
  const storage = state.storagePath || { path: state.dataPath, defaultPath: state.dataPath, custom: false };
  return `
    <section class="settings-section">
      <h3>데이터</h3>
      <div class="path-box">
        <span>저장 위치${storage.custom ? " · 사용자 지정" : ""}</span>
        <code>${escapeHtml(storage.path)}</code>
        <button type="button" class="icon-button" data-action="copy-path" title="경로 복사" aria-label="경로 복사">${copiedIcon(state, "settings:path")}</button>
      </div>
      <div class="backup-actions">
        <button type="button" class="backup-button" data-action="set-data-path">${icon("folder")} 위치 변경</button>
        <button type="button" class="backup-button" data-action="reset-data-path" ${storage.custom ? "" : "disabled"}>${icon("rotate")} 기본 위치</button>
        <button type="button" class="backup-button" data-action="export">${icon("download")} 백업 내보내기</button>
        <label class="file-button backup-button" role="button" tabindex="0">${icon("upload")} 가져오기<input id="import-file" type="file" accept="application/json,.json,.csv,.tsv,text/csv,text/tab-separated-values" /></label>
      </div>
      <p class="panel-note">위치 변경은 현재 데이터를 새 JSON 파일에 저장한 뒤 그 파일을 사용합니다. JSON 백업은 현재 데이터를 교체하고, CSV/TSV는 현재 목록에 새 카드로 추가합니다.</p>
    </section>
    <section class="settings-section import-sample-section">
      <h3>가져오기 샘플</h3>
      <p class="panel-note">엑셀은 아래 열 이름으로 정리한 뒤 CSV UTF-8로 저장하면 바로 추가할 수 있습니다.</p>
      <div class="sample-copy-actions">
        <button type="button" class="backup-button" data-action="copy-import-csv">${copiedIcon(state, "settings:import-csv")} CSV 샘플 복사</button>
        <button type="button" class="backup-button" data-action="copy-import-json">${copiedIcon(state, "settings:import-json")} JSON 샘플 복사</button>
      </div>
      <div class="import-column-grid" aria-label="가져오기 열 샘플">
        ${EXCEL_IMPORT_COLUMNS.map(([name, sample]) => `
          <div class="import-column-row">
            <code>${escapeHtml(name)}</code>
            <span>${escapeHtml(sample)}</span>
          </div>
        `).join("")}
      </div>
      <details class="json-sample-preview">
        <summary>JSON 구조 보기</summary>
        <pre><code>${escapeHtml(jsonSample)}</code></pre>
      </details>
    </section>
  `;
}
