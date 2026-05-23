import { describe, expect, test } from "bun:test";
import { normalizeData } from "../domain.js";
import { buildTagSuggestions } from "./tagSuggestions.js";

describe("tag suggestions", () => {
  test("prefers tags from the selected tab", () => {
    const data = normalizeData({
      cards: [
        { id: "a", tabId: "prompt", title: "뉴스 모니터링", tags: ["뉴스모니터링", "롯데카드"], items: [{ id: "l1", value: "daily prompt" }] },
        { id: "b", tabId: "api", title: "API", tags: ["apikey"], items: [{ id: "l2", value: "token" }] }
      ]
    });
    expect(buildTagSuggestions(data, { tabId: "prompt", tags: "", title: "", quickValues: "" })[0].tag).toBe("뉴스모니터링");
  });

  test("uses similar card text when recommending tags", () => {
    const data = normalizeData({
      cards: [
        { id: "a", tabId: "prompt", title: "주간 분석 프롬프트", tags: ["자기관찰"], items: [{ id: "l1", value: "weekly conversation analysis" }] }
      ]
    });
    const tags = buildTagSuggestions(data, { tabId: "prompt", tags: "", title: "weekly analysis", quickValues: "" }).map((entry) => entry.tag);
    expect(tags).toContain("자기관찰");
  });
});
