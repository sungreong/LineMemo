export async function syncDesktopPreferencesForState(
  { state, applyDesktopPreferences, scheduleSave, render, notify },
  { silent = true } = {}
) {
  try {
    const status = await applyDesktopPreferences(state.data.settings);
    state.desktopIntegration = { ...status, error: "" };
    if (typeof status.launchOnStartup === "boolean" && status.launchOnStartup !== state.data.settings.launchOnStartup) {
      state.data.settings.launchOnStartup = status.launchOnStartup;
      scheduleSave();
    }
    render();
  } catch (error) {
    state.desktopIntegration = { ...state.desktopIntegration, error: error?.message || String(error) };
    if (!silent) notify("Windows 설정 적용 실패");
    else render();
  }
}
