import { describe, expect, test } from "bun:test";
import { cardPayloadHasChanges, lineEditHasChanges } from "./saveDiff.js";

const baseLine = {
  id: "line-1",
  label: "라벨",
  value: "alpha\nbeta",
  group: "세트",
  type: "text",
  secret: false,
  expiresAt: "2026-12-31",
  order: 1
};

describe("save diff helpers", () => {
  test("detects meaningful line editor changes", () => {
    expect(lineEditHasChanges(baseLine, { ...baseLine })).toBe(false);
    expect(lineEditHasChanges(baseLine, { ...baseLine, value: "alpha\nbeta\nnext" })).toBe(true);
    expect(lineEditHasChanges(baseLine, { ...baseLine, expiresAt: "2027-01-01" })).toBe(true);
  });

  test("compares card editor payloads without timestamp noise", () => {
    const card = {
      id: "card-1",
      title: "카드",
      tabId: "inbox",
      description: "설명",
      tags: ["api"],
      items: [{ ...baseLine, createdAt: "old", updatedAt: "old" }]
    };
    const payload = {
      title: "카드",
      tabId: "inbox",
      description: "설명",
      tags: ["api"],
      items: [{ ...baseLine, updatedAt: "newer" }]
    };

    expect(cardPayloadHasChanges(card, payload)).toBe(false);
    expect(cardPayloadHasChanges(card, { ...payload, items: [{ ...baseLine, label: "다른 라벨" }] })).toBe(true);
  });
});
