import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import {
  UPGRADES,
  getUpgradeCost as getUpgradeCostFromDef,
  getMaxLevel,
  getUpgradeById,
} from '@/components/game/upgrades';

const SHOP_UNLOCK_THRESHOLD = 10;

export interface GameState {
  spinCount: number;
  upgrades: Record<string, number>;
  shopUnlocked: boolean;
}

const initialState: GameState = {
  spinCount: 0,
  upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
  shopUnlocked: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    addSpins: (state, action: PayloadAction<number>) => {
      state.spinCount += action.payload;
      if (!state.shopUnlocked && state.spinCount >= SHOP_UNLOCK_THRESHOLD) {
        state.shopUnlocked = true;
      }
    },
    spendSpins: (state, action: PayloadAction<number>) => {
      state.spinCount = Math.max(0, state.spinCount - action.payload);
    },
    purchaseUpgrade: (state, action: PayloadAction<string>) => {
      const upgrade = getUpgradeById(action.payload);
      if (!upgrade) return;
      const level = state.upgrades[action.payload] ?? 0;
      if (level >= getMaxLevel(upgrade)) return;
      const cost = getUpgradeCostFromDef(upgrade, level);
      if (state.spinCount < cost) return;
      state.spinCount -= cost;
      state.upgrades[action.payload] = level + 1;
    },
  },
});

export const { addSpins, spendSpins, purchaseUpgrade } = gameSlice.actions;

// Selectors
export const selectSpinCount = (state: RootState) => state.game.spinCount;
export const selectShopUnlocked = (state: RootState) => state.game.shopUnlocked;
export const selectUpgradeLevel = (id: string) => (state: RootState) =>
  state.game.upgrades[id] ?? 0;
export const selectUpgradeCost = (id: string) => (state: RootState) => {
  const upgrade = getUpgradeById(id);
  if (!upgrade) return Infinity;
  return getUpgradeCostFromDef(upgrade, state.game.upgrades[id] ?? 0);
};
export const selectUpgradeEffect = (id: string) => (state: RootState) => {
  const upgrade = getUpgradeById(id);
  if (!upgrade) return 1;
  return upgrade.effect(state.game.upgrades[id] ?? 0);
};
export const selectIsUpgradeMaxed = (id: string) => (state: RootState) => {
  const upgrade = getUpgradeById(id);
  if (!upgrade) return true;
  return (state.game.upgrades[id] ?? 0) >= getMaxLevel(upgrade);
};
export const selectAllUpgradesMaxed = (state: RootState) =>
  UPGRADES.every((u) => (state.game.upgrades[u.id] ?? 0) >= getMaxLevel(u));
export const selectGamblingUnlocked = (state: RootState) =>
  (state.game.upgrades["gamblingMode"] ?? 0) > 0;
export const selectGamblingMultiplier = (state: RootState) => {
  const level = state.game.upgrades["gamblingMode"] ?? 0;
  return level > 0 ? Math.pow(10, level - 1) : 0; // 1x at level 1 (200 cost), 10x at level 2 (2000 cost)
};

export default gameSlice.reducer;
