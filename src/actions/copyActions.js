function copyMessage(feedback = {}) {
  if (feedback.type === "line") return `[라인] ${feedback.label || "값"} 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "card") return `[카드] ${feedback.title || "전체"}${feedback.count ? ` · ${feedback.count}줄` : ""} 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "card-title") return `[카드] 제목 포함 · ${feedback.title || "전체"} 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "card-markdown") return `[카드] 마크다운 · ${feedback.title || "전체"} 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "block") return `[블록] ${feedback.count || 0}줄 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "group") return `[세트] ${feedback.label || "관련 줄"} · ${feedback.count || 0}줄 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "group-tab") return `[세트] ${feedback.label || "관련 줄"} · 탭 구분 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "group-next") return `[세트] ${feedback.index || 1}/${feedback.count || 1} · ${feedback.label || "다음 값"} 복사됨${feedback.secret ? " · 민감값" : ""}`;
  if (feedback.type === "selected") return `[선택] ${feedback.count || 0}줄 복사됨${feedback.includeLabels ? " · 라벨 포함" : ""}${feedback.secret ? " · 민감값" : ""}`;
  return "복사됨";
}

function normalizeFeedback(feedback) {
  if (!feedback || typeof feedback === "string") return { key: feedback || "", message: "복사됨", secret: false };
  return {
    key: feedback.key || "",
    message: copyMessage(feedback),
    secret: Boolean(feedback.secret)
  };
}

export function createCopyActions({ state, notify, render, writeText, readText, feedbackMs = 1000 }) {
  let copyFeedbackTimer = null;
  return {
    async copyText(text, feedback = "") {
      const value = String(text || "");
      if (!value) {
        notify("복사할 값이 없습니다");
        return;
      }
      try {
        await writeText(value);
      } catch {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          notify("복사 실패");
          return;
        }
      }
      const normalized = normalizeFeedback(feedback);
      state.lastCopiedText = normalized.secret ? "" : value;
      state.lastCopiedKey = normalized.key;
      notify(normalized.message);
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => {
        state.lastCopiedKey = "";
        render();
      }, feedbackMs);

      const settings = state.data.settings;
      if (settings.autoClearClipboard) {
        window.setTimeout(async () => {
          try {
            const current = await readText();
            if (current === value) await writeText("");
          } catch {
            const current = await navigator.clipboard.readText();
            if (current === value) await navigator.clipboard.writeText("");
          }
        }, Number(settings.clipboardClearSeconds || 30) * 1000);
      }
    }
  };
}
