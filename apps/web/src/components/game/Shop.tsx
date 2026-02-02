import type { FC } from "react";
import { useLocation } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import {
  selectShopUnlocked,
  selectAllUpgradesMaxed,
  selectIsUpgradeMaxed,
  selectUpgradeLevel,
} from "@/store/slices/gameSlice";
import { UPGRADES } from "./upgrades";
import UpgradeButton from "./UpgradeButton";

export const Shop: FC = () => {
  const location = useLocation();
  const isStimulationPage = location.pathname === "/stimulation-spinner";

  const shopUnlocked = useAppSelector(selectShopUnlocked);
  const allMaxed = useAppSelector(selectAllUpgradesMaxed);
  const bearingMaxed = useAppSelector(selectIsUpgradeMaxed("bearingUpgrade"));
  const gamblingLevel = useAppSelector(selectUpgradeLevel("gamblingMode"));
  const gamblingMaxed = useAppSelector(selectIsUpgradeMaxed("gamblingMode"));
  const stimulationMaxed = useAppSelector(selectIsUpgradeMaxed("stimulationMode"));

  if (!shopUnlocked) return null;

  // Mobile detection for "Continue on Desktop" feature
  const isMobile =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Filter upgrades: show gambling only after bearings maxed,
  // show stimulation mode only after gambling level 2, show auto spin only on stimulation page
  const visibleUpgrades = UPGRADES.filter((upgrade) => {
    // Gambling mode: levels 1-2 on home page, levels 3-4 only on stimulation page
    if (upgrade.id === "gamblingMode") {
      if (!bearingMaxed) return false;
      // On home page, hide once level 2 is reached (levels 3-4 are stimulation page only)
      if (!isStimulationPage && gamblingLevel >= 2) return false;
      return true;
    }
    // Stimulation mode unlocks after gambling level 2 (not max level)
    if (upgrade.id === "stimulationMode") {
      return gamblingLevel >= 2;
    }
    // Auto spin only shows on stimulation page after stimulation mode is maxed
    if (upgrade.id === "autoSpin") {
      return isStimulationPage && stimulationMaxed;
    }
    // Theo mode shows alongside auto spin (after stimulation mode is maxed)
    if (upgrade.id === "theoMode") {
      return isStimulationPage && stimulationMaxed;
    }
    // FTX mode shows alongside auto spin (after stimulation mode is maxed)
    if (upgrade.id === "ftxMode") {
      return isStimulationPage && stimulationMaxed;
    }
    // Continue on Desktop only shows on mobile after all upgrades are maxed
    if (upgrade.id === "continueOnDesktop") {
      return isMobile && allMaxed;
    }
    return true;
  });

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full">
      <div className="flex flex-wrap justify-center gap-4">
        {visibleUpgrades.map((upgrade) => (
          <UpgradeButton key={upgrade.id} upgradeId={upgrade.id} />
        ))}
      </div>
    </div>
  );
};

export default Shop;
