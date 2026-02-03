import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { FidgetSpinner } from "@/components/game/FidgetSpinner";
import { FTXInvestment } from "@/components/game/FTXInvestment";
import { Shop } from "@/components/game/Shop";
import { TechStackSlotMachine as SlotMachine } from "@/components/game/SlotMachine";
import { TheoVideo } from "@/components/game/TheoVideo";
import { VCMode } from "@/components/game/VCMode";
import { decodeGameState } from "@/lib/stateCodec";
import { useAppDispatch,useAppSelector } from "@/store/hooks";
import {
  restoreState,
  selectFtxModeUnlocked,
  selectSpinCount,
  selectStimulationUnlocked,
  selectTheoModeUnlocked,
  selectUpgradeLevel,
  selectVcModeUnlocked,
} from "@/store/slices/gameSlice";

export const StimulationSpinner = () => {
  const dispatch = useAppDispatch();
  const isUnlocked = useAppSelector(selectStimulationUnlocked);
  const spinCount = useAppSelector(selectSpinCount);
  const theoModeUnlocked = useAppSelector(selectTheoModeUnlocked);
  const theoLevel = useAppSelector(selectUpgradeLevel("theoMode"));
  const ftxModeUnlocked = useAppSelector(selectFtxModeUnlocked);
  const vcModeUnlocked = useAppSelector(selectVcModeUnlocked);
  const [hasCheckedUrl, setHasCheckedUrl] = useState(false);
  const [ftxClosed, setFtxClosed] = useState(false);
  const [vcClosed, setVcClosed] = useState(false);

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
      <div className="lg:hidden flex flex-col items-center py-8 gap-8 px-4">
        {theoModeUnlocked && <TheoVideo level={theoLevel} />}
        <div className="text-4xl font-bold text-center">
          {spinCount.toLocaleString()} <span className="text-zinc-400 text-2xl">spins</span>
        </div>
        <FidgetSpinner
          disableSync
          hideStatusBar
          enableAutoSpin
          enableHighSpeedRenderer
          className="w-full max-w-[500px] h-[300px]"
        />
        <Shop />
        {ftxModeUnlocked && !ftxClosed && (
          <FTXInvestment className="w-full max-w-[400px]" onClose={() => setFtxClosed(true)} />
        )}
        {vcModeUnlocked && !vcClosed && (
          <VCMode className="w-full max-w-[400px]" onClose={() => setVcClosed(true)} />
        )}
        <SlotMachine className="w-full max-w-[500px] h-[350px]" />
        <div className="text-zinc-500 text-sm text-center pb-4">
          Made in London - Inspired by Neal.fun ❤️
        </div>
      </div>

      {/* Desktop: absolute positioning */}
      <div className="hidden lg:block h-full">
        {/* Theo video - top left */}
        {theoModeUnlocked && (
          <div className="absolute top-4 left-4 z-10">
            <TheoVideo level={theoLevel} />
          </div>
        )}

        {/* VC Mode - full right side */}
        {vcModeUnlocked && !vcClosed && (
          <div className="absolute top-4 right-4 bottom-4 z-10 w-[400px]">
            <VCMode className="h-full" onClose={() => setVcClosed(true)} />
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
            enableHighSpeedRenderer
            className="w-[700px] h-[400px]"
          />
          <Shop />
        </div>

        {/* FTX Investment - bottom left */}
        {ftxModeUnlocked && !ftxClosed && (
          <div className="absolute bottom-4 left-4 z-10">
            <FTXInvestment onClose={() => setFtxClosed(true)} />
          </div>
        )}

        {/* SlotMachine - bottom right (hidden when VC mode is open) */}
        {(!vcModeUnlocked || vcClosed) && (
          <div className="absolute bottom-4 right-4 w-[500px] h-[450px]">
            <SlotMachine className="w-full h-full" />
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-zinc-500 text-sm">
          Made in London - Inspired by Neal.fun ❤️
        </div>
      </div>
    </div>
  );
};
