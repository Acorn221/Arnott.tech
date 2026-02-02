import type { FC } from "react";
import { useAppSelector } from "@/store/hooks";
import { selectSpinCount, selectShopUnlocked } from "@/store/slices/gameSlice";

export const StickySpinBalance: FC = () => {
  const spinCount = useAppSelector(selectSpinCount);
  const shopUnlocked = useAppSelector(selectShopUnlocked);

  if (!shopUnlocked) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 bg-gradient-to-r from-zinc-800/95 to-zinc-900/95 backdrop-blur-sm px-4 py-2 md:px-6 md:py-3 rounded-lg shadow-lg border border-zinc-600/50">
      <div className="flex items-center gap-2 text-white">
        <span className="text-base md:text-xl font-bold">{spinCount.toLocaleString()}</span>
        <span className="text-sm md:text-base text-zinc-400">spins</span>
      </div>
    </div>
  );
};

export default StickySpinBalance;
