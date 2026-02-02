import type { FC } from "react";
import { useSpinulation } from "./SpinulationContext";

const UNLOCK_THRESHOLD = 10;

export const Shop: FC = () => {
  const { spinCount } = useSpinulation();

  if (spinCount < UNLOCK_THRESHOLD) return null;

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-zinc-800/75 rounded-xl w-full">
      <span className="text-lg">Spins: {spinCount}</span>
      <span className="text-sm text-gray-400">Upgrades coming soon...</span>
    </div>
  );
};

export default Shop;
