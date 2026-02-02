import type { FC } from "react";
import { useSpinulation } from "./SpinulationContext";

const UNLOCK_THRESHOLD = 10;

export const Shop: FC = () => {
  const { spinCount } = useSpinulation();

  if (spinCount < UNLOCK_THRESHOLD) return null;

  return (
    <div className="flex flex-col items-center gap-2 p-4  w-full">
      <span className="">Upgrades coming soon...</span>
    </div>
  );
};

export default Shop;
