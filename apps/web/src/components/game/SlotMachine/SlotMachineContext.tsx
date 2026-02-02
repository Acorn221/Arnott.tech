import {
  createContext,
  useContext,
  useRef,
  useCallback,
  type FC,
  type ReactNode,
  useMemo,
  useState,
  useEffect,
} from "react";
import type * as THREE from "three";
import { createLogger } from "@arnott/logger";

const log = createLogger("ui:slot-machine");
import { type AnimatedGlowBorderMaterial } from "./display-border-material";
import { type DynamicDisplayPlate } from "./display-plate";
import { type AnimatedFaceplateMaterial } from "./faceplate-material";
import {
  type ReelTextureManager,
  createReelTextureManager,
  detectFrontFaceByPosition,
  shuffleReel,
  initializeTexturePool,
} from "./config/reel-textures";
import { type Technology } from "./config/technologies";
import {
  calculateScore,
  type ScoreResult,
  getScoreMessage,
} from "./config/scoring";
import { soundManager } from "./sounds";
import { SPIN_COST, calculateSpinsWon } from "./config/gambling";

// Share button material type
export interface ShareButtonMaterial {
  material: THREE.MeshPhysicalMaterial;
  setActive: (active: boolean) => void;
}

// ============================================================================
// Types
// ============================================================================

export type ReelPhase = "stopped" | "spinning" | "decelerating" | "settling";

export interface ReelState {
  angle: number;
  velocity: number;
  phase: ReelPhase;
  lastSwappedFace: number;
}

export interface SpinResult {
  backend: Technology;
  frontend: Technology;
  database: Technology;
  score: ScoreResult;
  message: string;
}

export interface SlotMachineContextValue {
  // 3D object refs
  handlePivotRef: React.MutableRefObject<THREE.Object3D | null>;
  spinnersRef: React.MutableRefObject<Record<string, THREE.Object3D>>;
  knobMaterialRef: React.MutableRefObject<AnimatedGlowBorderMaterial | null>;
  displayPlateRef: React.MutableRefObject<DynamicDisplayPlate | null>;
  indicatorMaterialsRef: React.MutableRefObject<THREE.MeshPhysicalMaterial[]>;
  faceplateMaterialRef: React.MutableRefObject<AnimatedFaceplateMaterial | null>;
  /** Face objects for each reel: reelIndex -> (faceIndex -> Object3D) */
  reelFaceObjectsRef: React.MutableRefObject<
    Map<number, Map<number, THREE.Object3D>>
  >;

  // Buttons
  shareButtonRef: React.MutableRefObject<THREE.Object3D | null>;
  shareButtonMaterialRef: React.MutableRefObject<ShareButtonMaterial | null>;
  spinButtonRef: React.MutableRefObject<THREE.Object3D | null>;
  spinButtonMaterialRef: React.MutableRefObject<ShareButtonMaterial | null>;

  // Reel state
  reelManagersRef: React.MutableRefObject<ReelTextureManager[] | null>;
  reelStatesRef: React.MutableRefObject<ReelState[]>;
  swapTimersRef: React.MutableRefObject<number[]>;

  // State
  isSpinningRef: React.MutableRefObject<boolean>;
  isInitialized: boolean;
  lastResult: SpinResult | null;

  // Actions
  startGame: () => boolean;
  setHandlePivot: (pivot: THREE.Object3D | null) => void;
  setSpinners: (spinners: Record<string, THREE.Object3D>) => void;
  setKnobMaterial: (material: AnimatedGlowBorderMaterial) => void;
  setDisplayPlate: (plate: DynamicDisplayPlate) => void;
  setIndicatorMaterials: (materials: THREE.MeshPhysicalMaterial[]) => void;
  setFaceplateMaterial: (material: AnimatedFaceplateMaterial) => void;
  setReelFaceObjects: (
    reelIndex: number,
    faceObjects: Map<number, THREE.Object3D>,
  ) => void;
  setShareButton: (button: THREE.Object3D | null) => void;
  setShareButtonMaterial: (material: ShareButtonMaterial) => void;
  setSpinButton: (button: THREE.Object3D | null) => void;
  setSpinButtonMaterial: (material: ShareButtonMaterial) => void;
  initializeReels: () => Promise<void>;
  calculateFinalResult: () => void;
  setIsSpinning: (spinning: boolean) => void;
  shareResult: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const SPIN_SPEED = 12;
const STOP_DELAY = 0.6;

const secureRandom = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
};

// ============================================================================
// Context
// ============================================================================

export const SlotMachineContext = createContext<SlotMachineContextValue | null>(
  null,
);

export const useSlotMachine = (): SlotMachineContextValue => {
  const context = useContext(SlotMachineContext);
  if (!context) {
    throw new Error("useSlotMachine must be used within SlotMachineProvider");
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

interface SlotMachineProviderProps {
  children: ReactNode;
  onShareDialog?: (result: SpinResult) => void;
  captureScreenshot?: () => string | null;
  onAttemptSpin?: () => boolean;
  onSpinComplete?: (score: number) => void;
  gamblingEnabled?: boolean;
  gamblingMultiplier?: number;
}

export const SlotMachineProvider: FC<SlotMachineProviderProps> = ({
  children,
  onShareDialog,
  captureScreenshot,
  onAttemptSpin,
  onSpinComplete,
  gamblingEnabled,
  gamblingMultiplier = 1,
}) => {
  // 3D object refs
  const handlePivotRef = useRef<THREE.Object3D | null>(null);
  const spinnersRef = useRef<Record<string, THREE.Object3D>>({});
  const knobMaterialRef = useRef<AnimatedGlowBorderMaterial | null>(null);
  const displayPlateRef = useRef<DynamicDisplayPlate | null>(null);
  const indicatorMaterialsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const faceplateMaterialRef = useRef<AnimatedFaceplateMaterial | null>(null);
  const reelManagersRef = useRef<ReelTextureManager[] | null>(null);
  const reelFaceObjectsRef = useRef<Map<number, Map<number, THREE.Object3D>>>(
    new Map(),
  );

  // Button refs
  const shareButtonRef = useRef<THREE.Object3D | null>(null);
  const shareButtonMaterialRef = useRef<ShareButtonMaterial | null>(null);
  const spinButtonRef = useRef<THREE.Object3D | null>(null);
  const spinButtonMaterialRef = useRef<ShareButtonMaterial | null>(null);

  // Reel state refs
  const reelStatesRef = useRef<ReelState[]>([
    { angle: 0, velocity: 0, phase: "stopped", lastSwappedFace: -1 },
    { angle: 0, velocity: 0, phase: "stopped", lastSwappedFace: -1 },
    { angle: 0, velocity: 0, phase: "stopped", lastSwappedFace: -1 },
  ]);
  const swapTimersRef = useRef<number[]>([0, 0, 0]);

  // State
  const isSpinningRef = useRef(false);
  const stopTimers = useRef<number[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);

  // Initialize reel texture managers
  const initializeReels = useCallback(async () => {
    if (reelManagersRef.current) return;

    // Initialize texture pool first (pre-generates all textures)
    await initializeTexturePool();

    const [backend, frontend, database] = await Promise.all([
      createReelTextureManager("backend"),
      createReelTextureManager("frontend"),
      createReelTextureManager("database"),
    ]);

    reelManagersRef.current = [backend, frontend, database];
    setIsInitialized(true);
  }, []);

  // Setters
  const setHandlePivot = useCallback((pivot: THREE.Object3D | null) => {
    handlePivotRef.current = pivot;
  }, []);

  const setSpinners = useCallback(
    (spinners: Record<string, THREE.Object3D>) => {
      spinnersRef.current = spinners;
    },
    [],
  );

  const setKnobMaterial = useCallback(
    (material: AnimatedGlowBorderMaterial) => {
      knobMaterialRef.current = material;
    },
    [],
  );

  const setDisplayPlate = useCallback((plate: DynamicDisplayPlate) => {
    displayPlateRef.current = plate;
  }, []);

  const setIndicatorMaterials = useCallback(
    (materials: THREE.MeshPhysicalMaterial[]) => {
      indicatorMaterialsRef.current = materials;
    },
    [],
  );

  const setFaceplateMaterial = useCallback(
    (material: AnimatedFaceplateMaterial) => {
      faceplateMaterialRef.current = material;
    },
    [],
  );

  const setReelFaceObjects = useCallback(
    (reelIndex: number, faceObjects: Map<number, THREE.Object3D>) => {
      reelFaceObjectsRef.current.set(reelIndex, faceObjects);
    },
    [],
  );

  const setShareButton = useCallback((button: THREE.Object3D | null) => {
    shareButtonRef.current = button;
  }, []);

  const setShareButtonMaterial = useCallback(
    (material: ShareButtonMaterial) => {
      shareButtonMaterialRef.current = material;
    },
    [],
  );

  const setSpinButton = useCallback((button: THREE.Object3D | null) => {
    spinButtonRef.current = button;
  }, []);

  const setSpinButtonMaterial = useCallback((material: ShareButtonMaterial) => {
    spinButtonMaterialRef.current = material;
  }, []);

  const setIsSpinning = useCallback((spinning: boolean) => {
    isSpinningRef.current = spinning;
    faceplateMaterialRef.current?.setSpinning(spinning);
    if (!spinning) {
      knobMaterialRef.current?.setPaused(false);
    }
  }, []);

  // Stop a single reel
  const stopReel = useCallback((index: number) => {
    reelStatesRef.current[index].phase = "decelerating";
  }, []);

  // Calculate final result when all reels stop
  const calculateFinalResult = useCallback(() => {
    if (!reelManagersRef.current) return;

    const managers = reelManagersRef.current;
    const results: Technology[] = [];

    for (let reelIndex = 0; reelIndex < 3; reelIndex++) {
      const faceObjects = reelFaceObjectsRef.current.get(reelIndex);

      let faceIndex: number;
      if (faceObjects && faceObjects.size > 0) {
        // Use position-based detection (reliable)
        faceIndex = detectFrontFaceByPosition(faceObjects);
      } else {
        // Fallback - shouldn't happen if model is set up correctly
        faceIndex = 0;
      }

      const tech = managers[reelIndex].currentTechs[faceIndex];
      results.push(tech);
    }

    const [backend, frontend, database] = results;
    const score = calculateScore(backend.id, frontend.id, database.id);
    const message = getScoreMessage(score);

    const result: SpinResult = {
      backend,
      frontend,
      database,
      score,
      message,
    };

    setLastResult(result);

    // Award winnings
    onSpinComplete?.(score.score);

    // Play win/lose sound based on score
    if (score.score >= 50) {
      soundManager.playWin();
    } else {
      soundManager.playLose();
    }

    // Update display plate with score (and spins won if gambling)
    const spinsWon = gamblingEnabled ? calculateSpinsWon(score.score) * gamblingMultiplier : undefined;
    displayPlateRef.current?.showScore(
      score.score,
      score.label,
      score.color,
      score.emoji,
      spinsWon,
    );
  }, [onSpinComplete, gamblingEnabled, gamblingMultiplier]);

  // Share the result
  const shareResult = useCallback(async () => {
    if (!lastResult) return;

    const { backend, frontend, database, score, message } = lastResult;
    const text =
      `🎰 Tech Stack Slot Machine Result!\n\n` +
      `Backend: ${backend.name}\n` +
      `Frontend: ${frontend.name}\n` +
      `Database: ${database.name}\n\n` +
      `${score.emoji} Score: ${score.score}/100 - ${score.label}\n` +
      `${message}\n\n` +
      `Try your luck at: ${window.location.href}`;

    // Only use navigator.share on mobile devices
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isMobile && navigator.share) {
      // Capture screenshot and convert to file for sharing
      const dataUrl = captureScreenshot?.();
      if (dataUrl && navigator.canShare) {
        try {
          // Convert data URL to blob
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `tech-stack-${score.score}.png`, {
            type: "image/png",
          });

          const shareData = {
            title: "Tech Stack Slot Machine",
            text,
            files: [file],
          };

          // Check if we can share with files
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
          }
        } catch (err) {
          log.debug("Failed to share with screenshot, falling back to text", { error: err });
        }
      }

      // Fallback to text-only share
      void navigator.share({
        title: "Tech Stack Slot Machine",
        text,
        url: window.location.href,
      });
    } else if (onShareDialog) {
      // Desktop - open share dialog with screenshot
      onShareDialog(lastResult);
    } else {
      // Fallback - log share text
      log.info("Share result (no share dialog available)", { text });
    }
  }, [lastResult, onShareDialog, captureScreenshot]);

  // Start the game - returns true if spin started, false otherwise
  const startGame = useCallback((): boolean => {
    const anyReelActive = reelStatesRef.current.some(
      (state) => state.phase !== "stopped",
    );
    if (anyReelActive || !reelManagersRef.current) return false;

    // Check if spin is allowed (has enough spins)
    if (onAttemptSpin && !onAttemptSpin()) {
      // Show insufficient funds feedback
      displayPlateRef.current?.showInsufficientFunds();
      soundManager.playLose();
      // Reset back to normal after 1.5 seconds
      setTimeout(() => {
        const actualCost = SPIN_COST * gamblingMultiplier;
        displayPlateRef.current?.reset(true, actualCost);
      }, 1500);
      return false; // Not enough spins
    }

    // Clear existing timers and result
    stopTimers.current.forEach(clearTimeout);
    stopTimers.current = [];
    setLastResult(null);

    // Shuffle reels before starting
    reelManagersRef.current.forEach((manager) => shuffleReel(manager));

    // Mark as spinning and pause knob glow
    isSpinningRef.current = true;
    knobMaterialRef.current?.setPaused(true);
    faceplateMaterialRef.current?.setSpinning(true);

    // Update display to show spinning
    displayPlateRef.current?.showSpinning();

    // Reset swap timers
    swapTimersRef.current = [0, 0, 0];

    // Start all reels
    reelStatesRef.current.forEach((state) => {
      state.velocity = SPIN_SPEED + secureRandom() * 3;
      state.phase = "spinning";
      state.lastSwappedFace = -1;
    });

    // Schedule staggered stops
    const spinDuration = 2000 + secureRandom() * 1500;
    [0, 1, 2].forEach((reelIndex) => {
      const delay = spinDuration + reelIndex * STOP_DELAY * 1000;
      const timer = window.setTimeout(() => stopReel(reelIndex), delay);
      stopTimers.current.push(timer);
    });

    return true;
  }, [stopReel, onAttemptSpin, gamblingMultiplier]);

  // Initialize on mount
  useEffect(() => {
    void initializeReels();
  }, [initializeReels]);

  // Update display plate when gambling mode changes
  useEffect(() => {
    if (displayPlateRef.current && !isSpinningRef.current && !lastResult) {
      const actualCost = SPIN_COST * gamblingMultiplier;
      displayPlateRef.current.reset(gamblingEnabled, actualCost);
    }
  }, [gamblingEnabled, gamblingMultiplier, lastResult]);

  const value = useMemo<SlotMachineContextValue>(
    () => ({
      handlePivotRef,
      spinnersRef,
      knobMaterialRef,
      displayPlateRef,
      indicatorMaterialsRef,
      faceplateMaterialRef,
      reelFaceObjectsRef,
      shareButtonRef,
      shareButtonMaterialRef,
      spinButtonRef,
      spinButtonMaterialRef,
      reelManagersRef,
      reelStatesRef,
      swapTimersRef,
      isSpinningRef,
      isInitialized,
      lastResult,
      startGame,
      setHandlePivot,
      setSpinners,
      setKnobMaterial,
      setDisplayPlate,
      setIndicatorMaterials,
      setFaceplateMaterial,
      setReelFaceObjects,
      setShareButton,
      setShareButtonMaterial,
      setSpinButton,
      setSpinButtonMaterial,
      initializeReels,
      calculateFinalResult,
      setIsSpinning,
      shareResult,
    }),
    [
      isInitialized,
      lastResult,
      startGame,
      setHandlePivot,
      setSpinners,
      setKnobMaterial,
      setDisplayPlate,
      setIndicatorMaterials,
      setFaceplateMaterial,
      setReelFaceObjects,
      setShareButton,
      setShareButtonMaterial,
      setSpinButton,
      setSpinButtonMaterial,
      initializeReels,
      calculateFinalResult,
      setIsSpinning,
      shareResult,
    ],
  );

  return (
    <SlotMachineContext.Provider value={value}>
      {children}
    </SlotMachineContext.Provider>
  );
};
