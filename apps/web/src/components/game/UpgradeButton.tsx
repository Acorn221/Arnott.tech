import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  purchaseUpgrade,
  selectSpinCount,
  selectUpgradeLevel,
  selectUpgradeCost,
  selectIsUpgradeMaxed,
  selectUpgrades,
} from "@/store/slices/gameSlice";
import { getUpgradeById } from "./upgrades";
import { generateContinueUrl } from "@/lib/stateCodec";

interface UpgradeButtonProps {
  upgradeId: string;
}

export const UpgradeButton = ({ upgradeId }: UpgradeButtonProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const spinCount = useAppSelector(selectSpinCount);
  const level = useAppSelector(selectUpgradeLevel(upgradeId));
  const cost = useAppSelector(selectUpgradeCost(upgradeId));
  const isMaxed = useAppSelector(selectIsUpgradeMaxed(upgradeId));
  const upgrades = useAppSelector(selectUpgrades);

  const upgrade = getUpgradeById(upgradeId);

  const handlePurchase = useCallback(() => {
    // Special handling for "Continue on Desktop" - use Web Share API
    if (upgradeId === "continueOnDesktop") {
      const url = generateContinueUrl(spinCount, upgrades);

      if (navigator.share) {
        navigator
          .share({
            title: "Continue Fidget Spinner",
            text: "Continue my fidget spinner progress on desktop",
            url,
          })
          .catch(() => {
            // User cancelled or share failed - fallback to clipboard
            navigator.clipboard.writeText(url);
          });
      } else {
        // Fallback for browsers without Share API
        navigator.clipboard.writeText(url);
      }
      return;
    }

    dispatch(purchaseUpgrade(upgradeId));

    // Scroll to slot machine after purchasing gambling mode
    if (upgradeId === "gamblingMode") {
      setTimeout(() => {
        const slotMachine = document.querySelector("[data-slot-machine]");
        slotMachine?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }

    // Navigate to stimulation spinner page after purchasing
    if (upgradeId === "stimulationMode") {
      setTimeout(() => {
        navigate("/stimulation-spinner");
      }, 100);
    }
  }, [dispatch, upgradeId, navigate, spinCount, upgrades]);

  if (!upgrade) return null;

  // Hide maxed upgrades (except continueOnDesktop which has no levels)
  if (isMaxed && upgradeId !== "continueOnDesktop") return null;

  const isContinueOnDesktop = upgradeId === "continueOnDesktop";
  const canAfford = isContinueOnDesktop || spinCount >= cost;
  const Icon = upgrade.icon;

  // Special UI for "Continue on Desktop"
  if (isContinueOnDesktop) {
    return (
      <button
        onClick={handlePurchase}
        className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all w-[160px] bg-blue-700 hover:bg-blue-600 cursor-pointer"
        title={upgrade.description}
      >
        <Icon className="w-8 h-8" />
        <span className="text-sm font-medium text-center leading-tight">{upgrade.name}</span>
        <span className="text-xs text-gray-300">{upgrade.description}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handlePurchase}
      disabled={!canAfford}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-xl transition-all w-[160px]
        ${
          canAfford
            ? "bg-zinc-700 hover:bg-zinc-600 cursor-pointer"
            : "bg-zinc-800 opacity-50 cursor-not-allowed"
        }
      `}
      title={upgrade.description}
    >
      <Icon className="w-8 h-8" />
      <span className="text-sm font-medium text-center leading-tight">{upgrade.name}</span>
      <span className="text-xs text-gray-400">
        Lvl {level} → {level + 1}
      </span>
      <span
        className={`text-xs ${canAfford ? "text-green-400" : "text-red-400"}`}
      >
        Cost: {cost}
      </span>
    </button>
  );
};
