#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    env,
    fmt::Display,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

const APP_DIR_NAME: &str = "LineMemoLite";
const DATA_FILE_NAME: &str = "data.json";
const STORAGE_CONFIG_FILE_NAME: &str = "storage.json";

#[derive(Default)]
struct DesktopPreferences {
    minimize_to_tray: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPreferencesInput {
    minimize_to_tray: bool,
    launch_on_startup: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPreferencesStatus {
    minimize_to_tray: bool,
    launch_on_startup: bool,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageConfig {
    data_file_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StoragePathStatus {
    path: String,
    default_path: String,
    custom: bool,
}

fn app_dir() -> Result<PathBuf, String> {
    let appdata = env::var_os("APPDATA").ok_or("APPDATA environment variable is not available")?;
    Ok(PathBuf::from(appdata).join(APP_DIR_NAME))
}

fn default_data_path() -> Result<PathBuf, String> {
    Ok(app_dir()?.join(DATA_FILE_NAME))
}

fn storage_config_path() -> Result<PathBuf, String> {
    Ok(app_dir()?.join(STORAGE_CONFIG_FILE_NAME))
}

fn read_storage_config() -> Result<StorageConfig, String> {
    let path = storage_config_path()?;
    if !path.exists() {
        return Ok(StorageConfig::default());
    }
    let text = fs::read_to_string(path).map_err(error_to_string)?;
    serde_json::from_str(&text).map_err(error_to_string)
}

fn write_storage_config(path: Option<&Path>) -> Result<(), String> {
    let config_path = storage_config_path()?;
    ensure_parent(&config_path)?;
    if let Some(path) = path {
        let config = StorageConfig {
            data_file_path: Some(path.display().to_string()),
        };
        fs::write(config_path, serde_json::to_string_pretty(&config).map_err(error_to_string)?)
            .map_err(error_to_string)?;
    } else if config_path.exists() {
        fs::remove_file(config_path).map_err(error_to_string)?;
    }
    Ok(())
}

fn configured_data_path() -> Result<Option<PathBuf>, String> {
    Ok(read_storage_config()?.data_file_path.map(PathBuf::from))
}

fn data_path() -> Result<PathBuf, String> {
    Ok(configured_data_path()?.unwrap_or(default_data_path()?))
}

fn backup_dir() -> Result<PathBuf, String> {
    Ok(app_dir()?.join("backup"))
}

fn default_data() -> Value {
    json!({
        "version": "0.1",
        "tabs": [
            { "id": "all", "name": "전체", "order": 0, "system": true },
            { "id": "inbox", "name": "Inbox", "order": 1, "system": true },
            { "id": "account", "name": "계정/접속", "order": 2, "system": false },
            { "id": "ssh", "name": "SSH/서버", "order": 3, "system": false },
            { "id": "api", "name": "API", "order": 4, "system": false },
            { "id": "code", "name": "코드", "order": 5, "system": false },
            { "id": "prompt", "name": "프롬프트", "order": 6, "system": false },
            { "id": "sql", "name": "SQL", "order": 7, "system": false },
            { "id": "phrase", "name": "업무문구", "order": 8, "system": false },
            { "id": "etc", "name": "기타", "order": 9, "system": false }
        ],
        "cards": [],
        "settings": {
            "rememberLastTab": true,
            "lastTabId": "inbox",
            "autoClearClipboard": false,
            "clipboardClearSeconds": 30,
            "secretRevealSeconds": 10,
            "confirmBeforeDelete": true,
            "confirmBeforeSave": true,
            "fontSize": "normal",
            "colorTheme": "warm",
            "darkMode": false,
            "minimizeToTray": false,
            "launchOnStartup": false,
            "expiryNotifications": false,
            "expiryNotificationIntervalHours": 24,
            "expiryNotifyBeforeDays": 7,
            "expiryNotificationLastRunAt": "",
            "acknowledgedPlainTextWarning": false,
            "lockEnabled": false,
            "lockPasswordHash": "",
            "lockPasswordSalt": "",
            "lockPasswordAlgorithm": "PBKDF2-SHA256",
            "lockPasswordIterations": 210000,
            "lockTimeoutMinutes": 60
        }
    })
}

fn validate_data(data: &Value) -> Result<(), String> {
    if !data.is_object() {
        return Err("데이터는 JSON object여야 합니다.".into());
    }
    if !data.get("tabs").is_some_and(Value::is_array) {
        return Err("tabs 배열이 필요합니다.".into());
    }
    if !data.get("cards").is_some_and(Value::is_array) {
        return Err("cards 배열이 필요합니다.".into());
    }
    if !data.get("settings").is_some_and(Value::is_object) {
        return Err("settings object가 필요합니다.".into());
    }
    Ok(())
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(error_to_string)?;
    }
    Ok(())
}

fn backup_existing_file(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let dir = backup_dir()?;
    fs::create_dir_all(&dir).map_err(error_to_string)?;
    let stamp = Local::now().format("data_%Y%m%d_%H%M%S.json").to_string();
    let backup = dir.join(stamp);
    fs::copy(path, &backup).map_err(error_to_string)?;
    Ok(Some(backup))
}

fn write_data_to_path(path: &Path, data: &Value) -> Result<(), String> {
    validate_data(data)?;
    ensure_parent(path)?;
    let tmp_name = format!(
        "{}.tmp",
        path.file_name()
            .ok_or("저장 파일 이름을 확인할 수 없습니다.")?
            .to_string_lossy()
    );
    let tmp_path = path.with_file_name(tmp_name);
    let text = serde_json::to_string_pretty(data).map_err(error_to_string)?;
    fs::write(&tmp_path, text).map_err(error_to_string)?;
    backup_existing_file(path)?;
    if path.exists() {
        fs::remove_file(path).map_err(error_to_string)?;
    }
    fs::rename(&tmp_path, path).map_err(error_to_string)?;
    Ok(())
}

fn write_data_atomically(data: &Value) -> Result<(), String> {
    write_data_to_path(&data_path()?, data)
}

fn storage_path_status() -> Result<StoragePathStatus, String> {
    let default_path = default_data_path()?;
    let active_path = data_path()?;
    let custom = configured_data_path()?.is_some();
    Ok(StoragePathStatus {
        path: active_path.display().to_string(),
        default_path: default_path.display().to_string(),
        custom,
    })
}

fn resolve_user_data_path(input: &str) -> Result<PathBuf, String> {
    let text = input.trim();
    if text.is_empty() {
        return Err("저장 위치를 입력하세요.".into());
    }
    let mut path = PathBuf::from(text);
    if !path.is_absolute() {
        return Err("드라이브를 포함한 전체 경로를 입력하세요.".into());
    }
    if (path.exists() && path.is_dir()) || path.extension().is_none() {
        path = path.join(DATA_FILE_NAME);
    }
    Ok(path)
}

fn read_or_seed_data() -> Result<Value, String> {
    let path = data_path()?;
    if !path.exists() {
        let data = default_data();
        write_data_atomically(&data)?;
        return Ok(data);
    }
    let text = fs::read_to_string(&path).map_err(error_to_string)?;
    let data: Value = serde_json::from_str(&text).map_err(error_to_string)?;
    validate_data(&data)?;
    Ok(data)
}

#[tauri::command]
fn get_data_file_path() -> Result<String, String> {
    Ok(data_path()?.display().to_string())
}

#[tauri::command]
fn get_storage_path_status() -> Result<StoragePathStatus, String> {
    storage_path_status()
}

#[tauri::command]
fn load_data() -> Result<Value, String> {
    read_or_seed_data()
}

#[tauri::command]
fn save_data(data: Value) -> Result<Value, String> {
    write_data_atomically(&data)?;
    Ok(data)
}

#[tauri::command]
fn export_data() -> Result<Value, String> {
    read_or_seed_data()
}

#[tauri::command]
fn import_data(data: Value) -> Result<Value, String> {
    validate_data(&data)?;
    let path = data_path()?;
    ensure_parent(&path)?;
    backup_existing_file(&path)?;
    write_data_atomically(&data)?;
    Ok(data)
}

#[tauri::command]
fn set_data_file_path(path: String, data: Value) -> Result<StoragePathStatus, String> {
    validate_data(&data)?;
    let target = resolve_user_data_path(&path)?;
    write_data_to_path(&target, &data)?;
    write_storage_config(Some(&target))?;
    storage_path_status()
}

#[tauri::command]
fn reset_data_file_path(data: Value) -> Result<StoragePathStatus, String> {
    validate_data(&data)?;
    let target = default_data_path()?;
    write_data_to_path(&target, &data)?;
    write_storage_config(None)?;
    storage_path_status()
}

#[tauri::command]
fn set_desktop_preferences(
    app: tauri::AppHandle,
    prefs: DesktopPreferencesInput,
) -> Result<DesktopPreferencesStatus, String> {
    {
        let state = app.state::<Mutex<DesktopPreferences>>();
        let mut desktop = state.lock().map_err(error_to_string)?;
        desktop.minimize_to_tray = prefs.minimize_to_tray;
    }

    let autostart = app.autolaunch();
    if prefs.launch_on_startup {
        autostart.enable().map_err(error_to_string)?;
    } else {
        autostart.disable().map_err(error_to_string)?;
    }

    Ok(DesktopPreferencesStatus {
        minimize_to_tray: prefs.minimize_to_tray,
        launch_on_startup: autostart.is_enabled().map_err(error_to_string)?,
    })
}

#[tauri::command]
fn get_desktop_preferences(app: tauri::AppHandle) -> Result<DesktopPreferencesStatus, String> {
    let minimize_to_tray = {
        let state = app.state::<Mutex<DesktopPreferences>>();
        let desktop = state.lock().map_err(error_to_string)?;
        desktop.minimize_to_tray
    };
    Ok(DesktopPreferencesStatus {
        minimize_to_tray,
        launch_on_startup: app.autolaunch().is_enabled().map_err(error_to_string)?,
    })
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn error_to_string(error: impl Display) -> String {
    error.to_string()
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(DesktopPreferences::default()))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--startup"]),
        ))
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "열기", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("LineMemo Lite")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            let start_hidden = env::args().any(|arg| arg == "--startup")
                && read_or_seed_data()
                    .ok()
                    .and_then(|data| data.get("settings")?.get("minimizeToTray")?.as_bool())
                    .unwrap_or(false);
            if start_hidden {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let should_hide = window
                    .state::<Mutex<DesktopPreferences>>()
                    .lock()
                    .map(|desktop| desktop.minimize_to_tray)
                    .unwrap_or(false);
                if should_hide {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_data_file_path,
            get_storage_path_status,
            load_data,
            save_data,
            export_data,
            import_data,
            set_data_file_path,
            reset_data_file_path,
            set_desktop_preferences,
            get_desktop_preferences
        ])
        .run(tauri::generate_context!())
        .expect("error while running LineMemo Lite");
}
