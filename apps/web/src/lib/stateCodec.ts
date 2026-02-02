interface EncodedState {
  s: number; // spinCount
  u: number[]; // upgrade levels
  h: string; // hash
}

const UPGRADE_ORDER = [
  "bearingUpgrade",
  "rgbMode",
  "gamblingMode",
  "stimulationMode",
  "autoSpin",
  "theoMode",
];

// Simple checksum - not secure, just deters casual editing
const computeHash = (spinCount: number, upgrades: number[]): string => {
  const sum = spinCount + upgrades.reduce((a, b) => a + b, 0);
  return btoa(String(sum * 42)).slice(0, 8);
};

export const encodeGameState = (
  spinCount: number,
  upgrades: Record<string, number>,
): string => {
  const upgradeArray = UPGRADE_ORDER.map((id) => upgrades[id] ?? 0);
  const payload: EncodedState = {
    s: spinCount,
    u: upgradeArray,
    h: computeHash(spinCount, upgradeArray),
  };
  return btoa(JSON.stringify(payload));
};

export const decodeGameState = (
  encoded: string,
): { spinCount: number; upgrades: Record<string, number> } | null => {
  try {
    const payload: EncodedState = JSON.parse(atob(encoded));
    const expectedHash = computeHash(payload.s, payload.u);
    if (payload.h !== expectedHash) return null;

    const upgrades: Record<string, number> = {};
    UPGRADE_ORDER.forEach((id, i) => {
      upgrades[id] = payload.u[i] ?? 0;
    });
    return { spinCount: payload.s, upgrades };
  } catch {
    return null;
  }
};

export const generateContinueUrl = (
  spinCount: number,
  upgrades: Record<string, number>,
): string => {
  const encoded = encodeGameState(spinCount, upgrades);
  return `${window.location.origin}/stimulation-spinner?state=${encoded}`;
};
