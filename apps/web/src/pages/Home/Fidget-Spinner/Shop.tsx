import type { FC } from "react";
import { useAppSelector } from "@/store/hooks";
import {
  selectShopUnlocked,
  selectAllUpgradesMaxed,
} from "@/store/slices/gameSlice";
import { UPGRADES } from "./upgrades";
import UpgradeButton from "./UpgradeButton";

export const Shop: FC = () => {
  const shopUnlocked = useAppSelector(selectShopUnlocked);
  const allMaxed = useAppSelector(selectAllUpgradesMaxed);

  if (!shopUnlocked || allMaxed) return null;

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full">
      <div className="flex flex-wrap justify-center gap-4">
        {UPGRADES.map((upgrade) => (
          <UpgradeButton key={upgrade.id} upgradeId={upgrade.id} />
        ))}
      </div>
    </div>
  );
};

export default Shop;
