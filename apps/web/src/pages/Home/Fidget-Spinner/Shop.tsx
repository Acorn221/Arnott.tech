import type { FC } from "react";
import { useSpinulation } from "./SpinulationContext";
import { UPGRADES } from "./upgrades";
import UpgradeButton from "./UpgradeButton";

export const Shop: FC = () => {
  const { state, isUpgradeMaxed } = useSpinulation();

  const allMaxed = UPGRADES.every((u) => isUpgradeMaxed(u.id));

  if (!state.shopUnlocked || allMaxed) return null;

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
