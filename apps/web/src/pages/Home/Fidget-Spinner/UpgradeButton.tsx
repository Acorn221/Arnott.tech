import type { FC } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  purchaseUpgrade,
  selectSpinCount,
  selectUpgradeLevel,
  selectUpgradeCost,
  selectIsUpgradeMaxed,
} from "@/store/slices/gameSlice";
import { getUpgradeById } from "./upgrades";

interface UpgradeButtonProps {
  upgradeId: string;
}

export const UpgradeButton: FC<UpgradeButtonProps> = ({ upgradeId }) => {
  const dispatch = useAppDispatch();
  const spinCount = useAppSelector(selectSpinCount);
  const level = useAppSelector(selectUpgradeLevel(upgradeId));
  const cost = useAppSelector(selectUpgradeCost(upgradeId));
  const isMaxed = useAppSelector(selectIsUpgradeMaxed(upgradeId));

  const upgrade = getUpgradeById(upgradeId);
  if (!upgrade) return null;

  const canAfford = spinCount >= cost;
  const Icon = upgrade.icon;

  return (
    <button
      onClick={() => dispatch(purchaseUpgrade(upgradeId))}
      disabled={!canAfford || isMaxed}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-xl transition-all min-w-[100px]
        ${
          isMaxed
            ? "bg-yellow-500/20 border-2 border-yellow-500/50"
            : canAfford
              ? "bg-zinc-700 hover:bg-zinc-600 cursor-pointer"
              : "bg-zinc-800 opacity-50 cursor-not-allowed"
        }
      `}
      title={upgrade.description}
    >
      <Icon className={`w-8 h-8 ${isMaxed ? "text-yellow-400" : ""}`} />
      <span className="text-sm font-medium">{upgrade.name}</span>
      <span className="text-xs text-gray-400">
        {isMaxed ? "MAX" : `Lvl ${level} → ${level + 1}`}
      </span>
      {!isMaxed && (
        <span
          className={`text-xs ${canAfford ? "text-green-400" : "text-red-400"}`}
        >
          Cost: {cost}
        </span>
      )}
    </button>
  );
};

export default UpgradeButton;
