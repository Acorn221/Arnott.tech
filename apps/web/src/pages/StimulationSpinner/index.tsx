import { type FC, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectStimulationUnlocked,
  selectSpinCount,
  selectTheoModeUnlocked,
  restoreState,
} from "@/store/slices/gameSlice";
import { decodeGameState } from "@/lib/stateCodec";
import FidgetSpinner from "@/components/game/FidgetSpinner";
import SlotMachine from "@/components/game/SlotMachine";
import Shop from "@/components/game/Shop";
import TheoVideo from "@/components/game/TheoVideo";

const StimulationSpinner: FC = () => {
  const dispatch = useAppDispatch();
  const isUnlocked = useAppSelector(selectStimulationUnlocked);
  const spinCount = useAppSelector(selectSpinCount);
  const theoModeUnlocked = useAppSelector(selectTheoModeUnlocked);
  const [hasCheckedUrl, setHasCheckedUrl] = useState(false);

  // Check for state param and restore before deciding to redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get("state");
    if (stateParam) {
      const decoded = decodeGameState(stateParam);
      if (decoded) {
        dispatch(restoreState(decoded));
        // Clean URL without triggering navigation
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    setHasCheckedUrl(true);
  }, [dispatch]);

  // Wait for URL check before deciding to redirect
  if (!hasCheckedUrl) {
    return null; // Or a loading spinner
  }

  // Redirect to home if not unlocked
  if (!isUnlocked) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-black text-white lg:h-screen lg:overflow-hidden lg:relative">
      {/* Mobile: scrollable layout */}
      <div className="lg:hidden flex flex-col items-center py-8 gap-8">
        {theoModeUnlocked && <TheoVideo />}
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
        {/* Theo video - top left */}
        {theoModeUnlocked && (
          <div className="absolute top-4 left-4 z-10">
            <TheoVideo />
          </div>
        )}

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
