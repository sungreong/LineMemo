function toggle(name, checked, title, detail) {
  return `
    <label class="feature-toggle">
      <input type="checkbox" data-setting="${name}" ${checked ? "checked" : ""} />
      <span><strong>${title}</strong><small>${detail}</small></span>
    </label>
  `;
}

export function renderQuickActionsSettings(settings) {
  return `
    <section class="settings-section quick-action-settings">
      <h3>빠른 작업</h3>
      <div class="feature-toggle-stack">
        ${toggle("cardDraftAutosave", settings.cardDraftAutosave, "카드 작성 초안 자동 복구", "앱을 껐다 켜도 새 카드/수정 중이던 내용을 다시 엽니다.")}
        ${toggle("lineContextMenu", settings.lineContextMenu, "줄 우클릭 빠른 메뉴", "각 줄에서 복사, 수정, 이동, 삭제, 세트 복사를 바로 실행합니다.")}
        ${toggle("rightClickCopy", settings.rightClickCopy, "우클릭과 동시에 값 복사", "빠른 메뉴를 열면서 해당 줄의 값도 즉시 클립보드에 넣습니다.")}
        ${toggle("lineClickSelect", settings.lineClickSelect, "줄 빈 곳 클릭으로 선택", "체크박스를 정확히 누르지 않아도 여러 줄 복사 대상을 빠르게 고릅니다.")}
      </div>
    </section>
  `;
}
