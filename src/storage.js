import { invoke } from "@tauri-apps/api/core";
import { normalizeData, createEmptyData } from "./domain.js";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const browserKey = "linememo-lite-data";

export async function loadData() {
  if (!isTauri) {
    const raw = localStorage.getItem(browserKey);
    return normalizeData(raw ? JSON.parse(raw) : createEmptyData());
  }
  const data = await invoke("load_data");
  return normalizeData(data);
}

export async function saveData(data) {
  const normalized = normalizeData(data);
  if (!isTauri) {
    localStorage.setItem(browserKey, JSON.stringify(normalized));
    return normalized;
  }
  return normalizeData(await invoke("save_data", { data: normalized }));
}

export async function getDataFilePath() {
  if (!isTauri) return "브라우저 미리보기: localStorage";
  return invoke("get_data_file_path");
}

export async function getStoragePathStatus() {
  if (!isTauri) return { path: "브라우저 미리보기: localStorage", defaultPath: "브라우저 미리보기: localStorage", custom: false };
  return invoke("get_storage_path_status");
}

export async function setDataFilePath(path, data) {
  if (!isTauri) throw new Error("저장 위치 변경은 설치된 앱에서 사용할 수 있습니다.");
  return invoke("set_data_file_path", { path, data: normalizeData(data) });
}

export async function resetDataFilePath(data) {
  if (!isTauri) throw new Error("저장 위치 변경은 설치된 앱에서 사용할 수 있습니다.");
  return invoke("reset_data_file_path", { data: normalizeData(data) });
}

export async function importDataFromJson(jsonText) {
  const parsed = normalizeData(JSON.parse(jsonText));
  if (!isTauri) {
    localStorage.setItem(browserKey, JSON.stringify(parsed));
    return parsed;
  }
  return normalizeData(await invoke("import_data", { data: parsed }));
}

export async function exportDataJson(data) {
  if (!isTauri) return JSON.stringify(normalizeData(data), null, 2);
  const exported = await invoke("export_data");
  return JSON.stringify(exported, null, 2);
}

export async function applyDesktopPreferences(settings = {}) {
  const prefs = {
    minimizeToTray: Boolean(settings.minimizeToTray),
    launchOnStartup: Boolean(settings.launchOnStartup)
  };
  if (!isTauri) return { ...prefs, available: false };
  const status = await invoke("set_desktop_preferences", { prefs });
  return { ...status, available: true };
}

export async function getDesktopPreferences() {
  if (!isTauri) return { minimizeToTray: false, launchOnStartup: false, available: false };
  const status = await invoke("get_desktop_preferences");
  return { ...status, available: true };
}
