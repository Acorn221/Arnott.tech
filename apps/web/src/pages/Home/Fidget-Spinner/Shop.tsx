import type { FC } from "react";
import { useAppSelector } from "@/store/hooks";
import {
  selectShopUnlocked,
  selectAllUpgradesMaxed,
  selectIsUpgradeMaxed,
} from "@/store/slices/gameSlice";
import { UPGRADES } from "./upgrades";
import UpgradeButton from "./UpgradeButton";

export const Shop: FC = () => {
  const shopUnlocked = useAppSelector(selectShopUnlocked);
  const allMaxed = useAppSelector(selectAllUpgradesMaxed);
  const bearingMaxed = useAppSelector(selectIsUpgradeMaxed("bearingUpgrade"));

  if (!shopUnlocked || allMaxed) return null;

  // Filter upgrades: hide maxed ones, show gambling only after bearings maxed
  const visibleUpgrades = UPGRADES.filter((upgrade) => {
    // Gambling mode only shows after bearings are maxed
    if (upgrade.id === "gamblingMode") {
      return bearingMaxed;
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
