import { mergeTabularImport } from "../data/tabularImport.js";
import { exportDataJson, importDataFromJson, resetDataFilePath, saveData, setDataFilePath } from "../storage.js";
import { syncActiveTabs } from "../state/tabs.js";

export function createBackupActions({ state, notify, render }) {
  function applyStorageStatus(status) {
    state.storagePath = status;
    state.dataPath = status.path;
  }

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

  async function handleDataPathChange() {
    const current = state.storagePath?.path || state.dataPath;
    const nextPath = prompt("새 저장 위치를 입력하세요. 폴더 또는 .json 파일 전체 경로를 사용할 수 있습니다.", current);
    if (nextPath === null) return;
    try {
      applyStorageStatus(await setDataFilePath(nextPath, state.data));
      notify("저장 위치 변경됨");
      render();
    } catch (error) {
      notify(`위치 변경 실패: ${error.message}`);
    }
  }

  async function handleDataPathReset() {
    if (!confirm("현재 데이터를 기본 저장 위치로 저장하고 기본 위치를 다시 사용할까요?")) return;
    try {
      applyStorageStatus(await resetDataFilePath(state.data));
      notify("기본 저장 위치로 변경됨");
      render();
    } catch (error) {
      notify(`기본 위치 변경 실패: ${error.message}`);
    }
  }

  return { handleImport, handleExport, handleDataPathChange, handleDataPathReset };
}
