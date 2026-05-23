import { describe, expect, test } from "bun:test";
import { DEFAULT_SPLIT_PATTERN, parsePasteItems } from "../domain.js";
import { buildQuickPastePreview, renderQuickPastePreview } from "./quickPastePreview.js";

describe("quick paste preview", () => {
  test("uses the same line split count as quick paste parsing", () => {
    const text = "alpha\nbeta\n\npassword = hidden";
    const preview = buildQuickPastePreview({ text, splitMode: "line", baseLabel: "A" });
    const parsed = parsePasteItems(text, { splitMode: "line" }).filter((item) => item.type !== "divider");

    expect(preview.count).toBe(parsed.length);
    expect(preview.itemLabel).toBe("줄");
    expect(preview.splitLabel).toBe("줄바꿈");
    expect(preview.samples.map((item) => item.label)).toEqual(["A.1", "A.2", "password"]);
    expect(preview.sensitiveCount).toBe(1);
    expect(preview.samples.at(-1).value).toBe("민감할 수 있음");
  });

  test("uses the same pattern split count as quick paste parsing", () => {
    const text = `first block\nkept\n${DEFAULT_SPLIT_PATTERN}\nsecond block`;
    const preview = buildQuickPastePreview({ text, splitMode: "pattern", splitPattern: DEFAULT_SPLIT_PATTERN });
    const parsed = parsePasteItems(text, { splitMode: "pattern", splitPattern: DEFAULT_SPLIT_PATTERN }).filter((item) => item.type !== "divider");

    expect(preview.count).toBe(parsed.length);
    expect(preview.itemLabel).toBe("항목");
    expect(preview.splitLabel).toBe(`패턴 ${DEFAULT_SPLIT_PATTERN}`);
    expect(preview.samples.map((item) => item.value)).toEqual(["first block\nkept", "second block"]);
  });

  test("renders nothing visible for empty text and escapes samples", () => {
    expect(buildQuickPastePreview({ text: "   " })).toEqual({ empty: true, count: 0, samples: [], sensitiveCount: 0 });
    const html = renderQuickPastePreview({ text: "<script>x</script>", splitMode: "line" });

    expect(html).toContain("quick-paste-preview");
    expect(html).toContain("1개 줄 추가 예정");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x</script>");
  });
});
