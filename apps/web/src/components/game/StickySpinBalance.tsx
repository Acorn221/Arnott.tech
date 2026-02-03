import { useAppSelector } from "@/store/hooks";
import { selectSpinCount, selectShopUnlocked } from "@/store/slices/gameSlice";

export const StickySpinBalance = () => {
  const spinCount = useAppSelector(selectSpinCount);
  const shopUnlocked = useAppSelector(selectShopUnlocked);

  if (!shopUnlocked) return null;

  const isNegative = spinCount < 0;

  return (
    <div className={`fixed top-0 left-0 right-0 md:top-4 md:left-auto md:right-4 md:w-auto z-50 backdrop-blur-sm px-4 py-3 md:px-8 md:py-4 md:rounded-lg shadow-lg border-b md:border ${
      isNegative
        ? "bg-gradient-to-r from-red-900/95 to-red-950/95 border-red-500/50"
        : "bg-gradient-to-r from-zinc-800/95 to-zinc-900/95 border-zinc-600/50"
    }`}>
      <div className="flex items-center justify-center md:justify-start gap-2 text-white">
        <span className={`text-lg md:text-3xl font-bold ${isNegative ? "text-red-400" : ""}`}>
          {spinCount.toLocaleString()}
        </span>
        <span className={`text-base md:text-xl ${isNegative ? "text-red-300" : "text-zinc-400"}`}>
          spins
        </span>
      </div>
    </div>
  );
};

export default StickySpinBalance;
