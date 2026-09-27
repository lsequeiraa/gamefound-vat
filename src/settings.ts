import type { LearnedCache, LearnedStore } from "./learned";

// Firefox exposes `browser` (promise-based); Chrome's MV3 `chrome` returns
// promises too, so both share this one code path.
declare const browser: typeof chrome | undefined;
export const ext: typeof chrome = typeof browser !== "undefined" ? browser : chrome;

const ENABLED = "enabled";
const LEARNED = "learnedRates";

export async function getEnabled(): Promise<boolean> {
  const stored = await ext.storage.local.get(ENABLED);
  return stored[ENABLED] !== false;
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await ext.storage.local.set({ [ENABLED]: enabled });
}

export function onEnabledChange(listener: (enabled: boolean) => void): void {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && ENABLED in changes) listener(changes[ENABLED]!.newValue !== false);
  });
}

export const learnedStore: LearnedStore = {
  async get() {
    const stored = await ext.storage.local.get(LEARNED);
    return (stored[LEARNED] as LearnedCache | undefined) ?? null;
  },
  async set(cache) {
    await ext.storage.local.set({ [LEARNED]: cache });
  },
};
