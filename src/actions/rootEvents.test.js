import { describe, expect, test } from "bun:test";
import { bindRootActions } from "./rootEvents.js";

describe("bindRootActions", () => {
  test("binds one delegated click listener per root", () => {
    const listeners = [];
    const root = {
      addEventListener(type, listener) {
        listeners.push({ type, listener });
      },
      contains() {
        return true;
      }
    };
    const calls = [];
    const handleAction = (element, event) => calls.push({ element, event });
    const actionElement = { dataset: { action: "open-panel" } };

    expect(bindRootActions(root, handleAction)).toBe(true);
    expect(bindRootActions(root, handleAction)).toBe(false);
    expect(listeners).toHaveLength(1);

    listeners[0].listener({
      target: {
        closest(selector) {
          return selector === "[data-action]" ? actionElement : null;
        }
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].element).toBe(actionElement);
  });
});
