import { type FC } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { selectStimulationUnlocked, selectSpinCount } from "@/store/slices/gameSlice";
import FidgetSpinner from "@/components/game/FidgetSpinner";
import SlotMachine from "@/components/game/SlotMachine";
import Shop from "@/components/game/Shop";

const StimulationSpinner: FC = () => {
  const isUnlocked = useAppSelector(selectStimulationUnlocked);
  const spinCount = useAppSelector(selectSpinCount);

  // Redirect to home if not unlocked
  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-black text-white lg:h-screen lg:overflow-hidden lg:relative">
      {/* Mobile: scrollable layout */}
      <div className="lg:hidden flex flex-col items-center py-8 gap-8">
        <div className="text-4xl font-bold text-center">
          {spinCount.toLocaleString()} <span className="text-zinc-400 text-2xl">spins</span>
        </div>
        <FidgetSpinner
          disableSync
          hideStatusBar
          enableAutoSpin
          className="w-full max-w-[500px] h-[300px]"
        />
        <Shop />
        <SlotMachine className="w-full max-w-[500px] h-[350px]" />
      </div>

      {/* Desktop: absolute positioning */}
      <div className="hidden lg:block h-full">
        {/* Centered FidgetSpinner with counter above and shop below */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-6xl font-bold mb-4">
            {spinCount.toLocaleString()} <span className="text-zinc-400 text-4xl">spins</span>
          </div>
          <FidgetSpinner
            disableSync
            hideStatusBar
            enableAutoSpin
            className="w-[700px] h-[400px]"
          />
          <Shop />
        </div>

        {/* SlotMachine - bottom right */}
        <div className="absolute bottom-4 right-4 w-[500px] h-[450px]">
          <SlotMachine className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export default StimulationSpinner;
