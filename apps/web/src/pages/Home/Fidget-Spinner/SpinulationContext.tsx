import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from "react";
import {
  UPGRADES,
  getUpgradeCost as getUpgradeCostFromDef,
  getMaxLevel,
  getUpgradeById,
  type UpgradeId,
} from "./upgrades";

// Dynamic upgrade levels based on defined upgrades
type UpgradeLevels = Record<string, number>;

interface SpinulationState {
  spinCount: number;
  upgrades: UpgradeLevels;
  shopUnlocked: boolean;
}

interface SpinulationContextValue {
  state: SpinulationState;
  addSpins: (count: number) => void;
  purchaseUpgrade: (upgradeId: UpgradeId) => boolean;
  getUpgradeCost: (upgradeId: UpgradeId) => number;
  getUpgradeLevel: (upgradeId: UpgradeId) => number;
  getUpgradeEffect: (upgradeId: UpgradeId) => number;
  isUpgradeMaxed: (upgradeId: UpgradeId) => boolean;
}

const SHOP_UNLOCK_THRESHOLD = 10;

// Initialize all upgrades at level 0
const initialUpgrades: UpgradeLevels = Object.fromEntries(
  UPGRADES.map((u) => [u.id, 0])
);

const SpinulationContext = createContext<SpinulationContextValue | null>(null);

export const SpinulationProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<SpinulationState>({
    spinCount: 0,
    upgrades: initialUpgrades,
    shopUnlocked: false,
  });

  const addSpins = useCallback((count: number) => {
    setState((prev) => {
      const newSpinCount = prev.spinCount + count;
      return {
        ...prev,
        spinCount: newSpinCount,
        shopUnlocked:
          prev.shopUnlocked || newSpinCount >= SHOP_UNLOCK_THRESHOLD,
      };
    });
  }, []);

  const getUpgradeLevel = useCallback(
    (upgradeId: UpgradeId): number => {
      return state.upgrades[upgradeId] ?? 0;
    },
    [state.upgrades]
  );

  const getUpgradeCost = useCallback(
    (upgradeId: UpgradeId): number => {
      const upgrade = getUpgradeById(upgradeId);
      if (!upgrade) return Infinity;
      return getUpgradeCostFromDef(upgrade, state.upgrades[upgradeId] ?? 0);
    },
    [state.upgrades]
  );

  const isUpgradeMaxed = useCallback(
    (upgradeId: UpgradeId): boolean => {
      const upgrade = getUpgradeById(upgradeId);
      if (!upgrade) return true;
      return (state.upgrades[upgradeId] ?? 0) >= getMaxLevel(upgrade);
    },
    [state.upgrades]
  );

  const getUpgradeEffect = useCallback(
    (upgradeId: UpgradeId): number => {
      const upgrade = getUpgradeById(upgradeId);
      if (!upgrade) return 1;
      return upgrade.effect(state.upgrades[upgradeId] ?? 0);
    },
    [state.upgrades]
  );

  const purchaseUpgrade = useCallback((upgradeId: UpgradeId): boolean => {
    let purchased = false;

    setState((prev) => {
      const upgrade = getUpgradeById(upgradeId);
      if (!upgrade) return prev;

      const level = prev.upgrades[upgradeId] ?? 0;
      if (level >= getMaxLevel(upgrade)) return prev;

      const cost = getUpgradeCostFromDef(upgrade, level);
      if (prev.spinCount < cost) return prev;

      purchased = true;
      return {
        ...prev,
        spinCount: prev.spinCount - cost,
        upgrades: {
          ...prev.upgrades,
          [upgradeId]: level + 1,
        },
      };
    });

    return purchased;
  }, []);

  const value = useMemo<SpinulationContextValue>(
    () => ({
      state,
      addSpins,
      purchaseUpgrade,
      getUpgradeCost,
      getUpgradeLevel,
      getUpgradeEffect,
      isUpgradeMaxed,
    }),
    [
      state,
      addSpins,
      purchaseUpgrade,
      getUpgradeCost,
      getUpgradeLevel,
      getUpgradeEffect,
      isUpgradeMaxed,
    ]
  );

  return (
    <SpinulationContext.Provider value={value}>
      {children}
    </SpinulationContext.Provider>
  );
};

export const useSpinulation = (): SpinulationContextValue => {
  const context = useContext(SpinulationContext);
  if (!context) {
    throw new Error("useSpinulation must be used within a SpinulationProvider");
  }
  return context;
};
