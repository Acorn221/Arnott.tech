import type { FC } from "react";
import { useLocation } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import {
  selectShopUnlocked,
  selectAllUpgradesMaxed,
  selectIsUpgradeMaxed,
} from "@/store/slices/gameSlice";
import { UPGRADES } from "./upgrades";
import UpgradeButton from "./UpgradeButton";

export const Shop: FC = () => {
  const location = useLocation();
  const isStimulationPage = location.pathname === "/stimulation-spinner";

  const shopUnlocked = useAppSelector(selectShopUnlocked);
  const allMaxed = useAppSelector(selectAllUpgradesMaxed);
  const bearingMaxed = useAppSelector(selectIsUpgradeMaxed("bearingUpgrade"));
  const gamblingMaxed = useAppSelector(selectIsUpgradeMaxed("gamblingMode"));
  const stimulationMaxed = useAppSelector(selectIsUpgradeMaxed("stimulationMode"));

  if (!shopUnlocked) return null;

  // Filter upgrades: show gambling only after bearings maxed,
  // show stimulation mode only after gambling is maxed, show auto spin only on stimulation page
  const visibleUpgrades = UPGRADES.filter((upgrade) => {
    // Gambling mode only shows after bearings are maxed
    if (upgrade.id === "gamblingMode") {
      return bearingMaxed;
    }
    // Stimulation mode only shows after gambling is maxed
    if (upgrade.id === "stimulationMode") {
      return gamblingMaxed;
    }
    // Auto spin only shows on stimulation page after stimulation mode is maxed
    if (upgrade.id === "autoSpin") {
      return isStimulationPage && stimulationMaxed;
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
