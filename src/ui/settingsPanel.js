import { isLockConfigured } from "../security/appLock.js";
import { icon } from "./icons.js";
import { renderDataSettingsPanel } from "./dataSettingsPanel.js";
import { renderQuickActionsSettings } from "./settingsQuickActions.js";
import { escapeAttr, escapeHtml } from "./utils.js";

export function renderSettingsPanel(state) {
  const s = state.data.settings;
  const locked = isLockConfigured(s);
  const desktop = state.desktopIntegration || {};
  const active = ["behavior", "quick-actions", "appearance", "system", "notifications", "help", "security", "data"].includes(state.settingsTab) ? state.settingsTab : "behavior";
  const tabButton = (id, label) => `<button type="button" class="${active === id ? "active" : ""}" data-action="settings-tab" data-tab="${id}" aria-pressed="${active === id}">${label}</button>`;
  return `
    <section class="panel settings settings-panel">
      <header class="panel-head">
        <h2>설정</h2>
        <button type="button" data-action="open-panel" data-panel="settings">닫기</button>
      </header>
      <nav class="settings-tabs" aria-label="설정 그룹">
        ${tabButton("behavior", "동작")}
        ${tabButton("quick-actions", "빠른작업")}
        ${tabButton("appearance", "화면")}
        ${tabButton("system", "시스템")}
        ${tabButton("notifications", "알림")}
        ${tabButton("help", "도움말")}
        ${tabButton("security", "보안")}
        ${tabButton("data", "데이터")}
      </nav>
      <div class="settings-tab-body">
      ${active === "behavior" ? `
      <section class="settings-section">
        <h3>동작</h3>
        <label class="check"><input type="checkbox" data-setting="rememberLastTab" ${s.rememberLastTab ? "checked" : ""} /> 마지막 탭 기억</label>
        <label class="check"><input type="checkbox" data-setting="confirmBeforeDelete" ${s.confirmBeforeDelete ? "checked" : ""} /> 삭제 전 확인</label>
        <label class="check"><input type="checkbox" data-setting="confirmBeforeSave" ${s.confirmBeforeSave ? "checked" : ""} /> 저장 전 확인</label>
        <label class="check"><input type="checkbox" data-setting="autoClearClipboard" ${s.autoClearClipboard ? "checked" : ""} /> 복사 후 클립보드 자동 삭제</label>
        <label>클립보드 삭제 대기
          <select data-setting="clipboardClearSeconds" ${s.autoClearClipboard ? "" : "disabled"}>
            ${[10, 30, 60].map((v) => `<option value="${v}" ${Number(s.clipboardClearSeconds) === v ? "selected" : ""}>${v}초</option>`).join("")}
          </select>
        </label>
      </section>
      ` : ""}
      ${active === "quick-actions" ? renderQuickActionsSettings(s) : ""}
      ${active === "appearance" ? `
      <section class="settings-section">
        <h3>화면</h3>
        <label>글씨 크기
          <select data-setting="fontSize" data-setting-type="string">
            ${[["small", "작게"], ["normal", "보통"], ["large", "크게"]].map(([value, label]) => `<option value="${value}" ${s.fontSize === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>배경 색상
          <select data-setting="colorTheme" data-setting-type="string">
            ${[["warm", "따뜻한 기본"], ["sage", "세이지"], ["sky", "스카이"], ["rose", "로즈"], ["slate", "슬레이트"]].map(([value, label]) => `<option value="${value}" ${s.colorTheme === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label class="check"><input type="checkbox" data-setting="darkMode" ${s.darkMode ? "checked" : ""} /> 다크 모드</label>
        <div class="theme-preview-strip" aria-label="색상 미리보기">
          ${["warm", "sage", "sky", "rose", "slate"].map((theme) => `<span class="theme-dot theme-${theme} ${s.colorTheme === theme ? "active" : ""}"></span>`).join("")}
        </div>
      </section>
      ` : ""}
      ${active === "system" ? `
      <section class="settings-section">
        <h3>Windows</h3>
        <label class="check"><input type="checkbox" data-setting="minimizeToTray" ${s.minimizeToTray ? "checked" : ""} /> 닫기 버튼을 누르면 트레이로 숨김</label>
        <label class="check"><input type="checkbox" data-setting="launchOnStartup" ${s.launchOnStartup ? "checked" : ""} /> 컴퓨터를 켤 때 자동 실행</label>
        <p class="panel-note">${desktop.available === false ? "브라우저 미리보기에서는 Windows 통합 기능이 동작하지 않습니다." : "트레이 아이콘에서 앱을 다시 열거나 완전히 종료할 수 있습니다."}</p>
        ${desktop.error ? `<p class="form-error">${escapeHtml(desktop.error)}</p>` : ""}
      </section>
      ` : ""}
      ${active === "notifications" ? `
      <section class="settings-section notification-settings-section">
        <h3>유효기간 알림</h3>
        <label class="check"><input type="checkbox" data-setting="expiryNotifications" ${s.expiryNotifications ? "checked" : ""} /> 복사본 유효기간 알림 사용</label>
        <label>알림 주기
          <select data-setting="expiryNotificationIntervalHours" ${s.expiryNotifications ? "" : "disabled"}>
            ${[[1, "1시간"], [6, "6시간"], [12, "12시간"], [24, "하루"], [72, "3일"], [168, "1주"]].map(([value, label]) => `<option value="${value}" ${Number(s.expiryNotificationIntervalHours) === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>미리 알림
          <select data-setting="expiryNotifyBeforeDays" ${s.expiryNotifications ? "" : "disabled"}>
            ${[[0, "당일만"], [1, "1일 전"], [3, "3일 전"], [7, "7일 전"], [14, "14일 전"], [30, "30일 전"]].map(([value, label]) => `<option value="${value}" ${Number(s.expiryNotifyBeforeDays) === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="backup-button" data-action="check-expiry-notifications" ${s.expiryNotifications ? "" : "disabled"}>지금 확인</button>
        <p class="panel-note">알림에는 복사 값 대신 카드명, 라벨, 유효기간만 표시합니다.</p>
      </section>
      ` : ""}
      ${active === "help" ? `
      <section class="settings-section guidance-section">
        <h3>빠른 사용법</h3>
        <div class="guide-list">
          <div><strong>새 카드</strong><span>값을 먼저 붙여넣고 제목은 비워두면 첫 줄로 자동 생성됩니다.</span></div>
          <div><strong>행 추가</strong><span>표 보기에서 현재 카드에 한 줄을 바로 추가하고 입력칸은 계속 열어둡니다.</span></div>
          <div><strong>유효기간</strong><span>줄마다 날짜를 지정해 복사본이 언제까지 유효한지 표시하고 알림을 받을 수 있습니다.</span></div>
          <div><strong>세트</strong><span>같이 쓰는 줄을 묶어 전체, 탭 구분, 다음 값 순서로 복사합니다.</span></div>
          <div><strong>중복 경고</strong><span>같은 값이 있으면 기존 위치로 이동하거나 그래도 추가할 수 있습니다.</span></div>
          <div><strong>앱 잠금</strong><span>비밀번호로 화면을 잠급니다. JSON 파일 보호는 Windows 계정 보안에 따릅니다.</span></div>
        </div>
      </section>
      <section class="settings-section shortcut-section">
        <h3>단축키</h3>
        <div class="shortcut-grid">
          ${[
            ["Ctrl+N", "새 카드"],
            ["Ctrl+Shift+N", "빠른 입력"],
            ["Ctrl+Shift+A", "표 행 추가"],
            ["Ctrl+Shift+L", "앱 잠금"],
            ["Alt+1 / 2", "카드 · 표 보기"],
            ["Ctrl+Enter", "현재 폼 제출"],
            ["Ctrl+S", "편집 저장"],
            ["Ctrl+C", "선택 줄 복사"],
            ["Escape", "편집/패널 닫기"]
          ].map(([key, label]) => `<div><kbd>${escapeHtml(key)}</kbd><span>${escapeHtml(label)}</span></div>`).join("")}
        </div>
      </section>
      ` : ""}
      ${active === "security" ? `
      <section class="settings-section lock-settings-section">
        <h3>앱 잠금</h3>
        <p class="panel-note">앱을 열 때 비밀번호를 묻는 화면 잠금입니다. 저장된 JSON 파일은 암호화하지 않습니다.</p>
        <label>자동 재잠금
          <select data-setting="lockTimeoutMinutes">
            ${[[1, "1분"], [5, "5분"], [15, "15분"], [60, "1시간"], [240, "4시간"]].map(([value, label]) => `<option value="${value}" ${Number(s.lockTimeoutMinutes) === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        ${locked ? `
          <div class="lock-status"><span>${icon("shield")}</span><strong>잠금 켜짐</strong><button type="button" data-action="lock-now">${icon("lock")} 지금 잠그기</button></div>
          <form id="lock-password-form" class="password-form">
            <label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required /></label>
            <label>새 비밀번호<input name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <label>새 비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <button type="submit" class="primary">비밀번호 변경</button>
          </form>
          <form id="lock-remove-form" class="password-form compact-password-form">
            <label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required /></label>
            <button type="submit">잠금 끄기</button>
          </form>
        ` : `
          <form id="lock-password-form" class="password-form">
            <label>새 비밀번호<input name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <label>새 비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
            <button type="submit" class="primary">잠금 켜기</button>
          </form>
        `}
      </section>
      ` : ""}
      ${active === "data" ? renderDataSettingsPanel(state) : ""}
      </div>
    </section>
  `;
}
