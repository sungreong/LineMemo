import { describe, expect, test } from "bun:test";
import { normalizeData } from "../domain.js";
import { createPasswordRecord, isLockConfigured, verifyPassword } from "./appLock.js";

describe("app lock password records", () => {
  test("hashes and verifies passwords without storing the raw value", async () => {
    const record = await createPasswordRecord("test-pass", { iterations: 100 });
    expect(record.lockPasswordHash).not.toContain("test-pass");
    expect(record.lockPasswordSalt).toBeTruthy();
    expect(isLockConfigured(record)).toBe(true);
    expect(await verifyPassword("test-pass", record)).toBe(true);
    expect(await verifyPassword("wrong-pass", record)).toBe(false);
  });
});

describe("lock settings normalization", () => {
  test("keeps legacy data unlocked and applies the 1 hour default", () => {
    const data = normalizeData({ settings: { rememberLastTab: false } });
    expect(data.settings.lockEnabled).toBe(false);
    expect(data.settings.lockTimeoutMinutes).toBe(60);
    expect(data.settings.lockPasswordHash).toBe("");
  });

  test("does not enable lock without complete password metadata", () => {
    const data = normalizeData({ settings: { lockEnabled: true, lockPasswordHash: "hash-only" } });
    expect(data.settings.lockEnabled).toBe(false);
  });
});
