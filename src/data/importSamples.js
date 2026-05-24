export const EXCEL_IMPORT_COLUMNS = [
  ["tab", "프롬프트"],
  ["title", "문제 보고 공식"],
  ["tags", "문제보고, 프롬프트"],
  ["description", "반복 보고 문구"],
  ["label", "현재 문제"],
  ["value", "현재 [문제]가 있습니다. 이 상태로 가면 [리스크]가 생깁니다."],
  ["type", "text"],
  ["secret", "false"],
  ["expiresAt", "2026-12-31"],
  ["group", "보고세트"]
];

export const IMPORT_SAMPLE_ROWS = [
  {
    tab: "프롬프트",
    title: "문제 보고 공식",
    tags: "문제보고, 프롬프트",
    description: "반복 보고 문구",
    label: "현재 문제",
    value: "현재 [문제]가 있습니다. 이 상태로 가면 [리스크]가 생깁니다.",
    type: "text",
    secret: "false",
    expiresAt: "2026-12-31",
    group: "보고세트"
  },
  {
    tab: "프롬프트",
    title: "문제 보고 공식",
    tags: "문제보고, 프롬프트",
    description: "반복 보고 문구",
    label: "요청",
    value: "[A안] 또는 [B안] 중 결정이 필요합니다.",
    type: "text",
    secret: "false",
    expiresAt: "2026-12-31",
    group: "보고세트"
  }
];

export const IMPORT_SAMPLE_JSON = {
  version: "0.1",
  cards: [
    {
      id: "card-sample-problem-report",
      tabId: "prompt",
      title: "문제 보고 공식",
      description: "반복 보고 문구",
      tags: ["문제보고", "프롬프트"],
      items: [
        {
          id: "line-sample-current",
          label: "현재 문제",
          value: "현재 [문제]가 있습니다. 이 상태로 가면 [리스크]가 생깁니다.",
          type: "text",
          secret: false,
          expiresAt: "2026-12-31",
          group: "보고세트",
          order: 1
        },
        {
          id: "line-sample-request",
          label: "요청",
          value: "[A안] 또는 [B안] 중 결정이 필요합니다.",
          type: "text",
          secret: false,
          expiresAt: "2026-12-31",
          group: "보고세트",
          order: 2
        }
      ]
    }
  ]
};

export function importSampleJsonText() {
  return JSON.stringify(IMPORT_SAMPLE_JSON, null, 2);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function importSampleCsvText() {
  const headers = EXCEL_IMPORT_COLUMNS.map(([key]) => key);
  const lines = [
    headers.join(","),
    ...IMPORT_SAMPLE_ROWS.map((row) => headers.map((key) => csvCell(row[key])).join(","))
  ];
  return lines.join("\n");
}
