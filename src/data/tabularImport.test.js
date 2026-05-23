import { describe, expect, test } from "bun:test";
import { createEmptyData } from "../domain.js";
import { importSampleCsvText } from "./importSamples.js";
import { mergeTabularImport, parseDelimitedRows } from "./tabularImport.js";

describe("tabular import", () => {
  test("parses quoted CSV cells", () => {
    expect(parseDelimitedRows('title,value\n"보고, 공식","A ""quoted"" value"')).toEqual([
      ["title", "value"],
      ["보고, 공식", 'A "quoted" value']
    ]);
  });

  test("adds CSV rows as cards without replacing existing data", () => {
    const data = createEmptyData();
    data.cards.push({ id: "existing", tabId: "inbox", title: "기존", items: [] });

    const result = mergeTabularImport(data, importSampleCsvText());
    const imported = result.data.cards.find((card) => card.title === "문제 보고 공식");

    expect(result.cardCount).toBe(1);
    expect(result.lineCount).toBe(2);
    expect(result.data.cards.some((card) => card.id === "existing")).toBe(true);
    expect(imported?.items.map((item) => item.label)).toEqual(["현재 문제", "요청"]);
    expect(result.data.tabs.some((tab) => tab.name === "프롬프트")).toBe(true);
  });
});
