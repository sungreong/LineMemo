import { mergeTabularImport } from "../data/tabularImport.js";
import { exportDataJson, importDataFromJson, saveData } from "../storage.js";
import { syncActiveTabs } from "../state/tabs.js";

export function createBackupActions({ state, notify, render }) {
  async function handleImport(file) {
    if (!file) return;
    const isJson = /\.json$/i.test(file.name || "");
    const message = isJson
      ? "백업 JSON을 가져오면 현재 데이터가 백업된 뒤 새 데이터로 교체됩니다. 계속할까요?"
      : "CSV/TSV 파일은 현재 목록에 새 카드로 추가됩니다. 계속할까요?";
    if (!confirm(message)) return;
    try {
      const text = await file.text();
      if (isJson) {
        state.data = await importDataFromJson(text);
        notify("가져오기 완료");
      } else {
        const imported = mergeTabularImport(state.data, text);
        state.data = await saveData(imported.data);
        notify(`가져오기 완료: 카드 ${imported.cardCount}개, 줄 ${imported.lineCount}개 추가`);
      }
      syncActiveTabs(state, state.data.settings.lastTabId || "inbox", { single: true });
      state.selected.clear();
      render();
    } catch (error) {
      notify(`가져오기 실패: ${error.message}`);
    }
  }

  async function handleExport() {
    const json = await exportDataJson(state.data);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `linememo-lite-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return { handleImport, handleExport };
}
