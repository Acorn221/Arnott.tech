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
} from 'react';
import type * as THREE from 'three';
import { type AnimatedGlowBorderMaterial } from './display-border-material';
import { type DynamicDisplayPlate } from './display-plate';
import {
  type ReelTextureManager,
  createReelTextureManager,
  getFrontFaceIndex,
  shuffleReel,
} from './config/reel-textures';
import { type Technology } from './config/technologies';
import { calculateScore, type ScoreResult, getScoreMessage } from './config/scoring';

// ============================================================================
// Types
// ============================================================================

export type ReelPhase = 'stopped' | 'spinning' | 'decelerating' | 'settling';

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

interface SlotMachineContextValue {
  // 3D object refs
  handlePivotRef: React.MutableRefObject<THREE.Object3D | null>;
  spinnersRef: React.MutableRefObject<Record<string, THREE.Object3D>>;
  knobMaterialRef: React.MutableRefObject<AnimatedGlowBorderMaterial | null>;
  displayPlateRef: React.MutableRefObject<DynamicDisplayPlate | null>;
  indicatorMaterialsRef: React.MutableRefObject<THREE.MeshPhysicalMaterial[]>;

  // Reel state
  reelManagersRef: React.MutableRefObject<ReelTextureManager[] | null>;
  reelStatesRef: React.MutableRefObject<ReelState[]>;
  swapTimersRef: React.MutableRefObject<number[]>;

  // State
  isSpinningRef: React.MutableRefObject<boolean>;
  isInitialized: boolean;
  lastResult: SpinResult | null;

  // Actions
  startGame: () => void;
  setHandlePivot: (pivot: THREE.Object3D | null) => void;
  setSpinners: (spinners: Record<string, THREE.Object3D>) => void;
  setKnobMaterial: (material: AnimatedGlowBorderMaterial) => void;
  setDisplayPlate: (plate: DynamicDisplayPlate) => void;
  setIndicatorMaterials: (materials: THREE.MeshPhysicalMaterial[]) => void;
  initializeReels: () => Promise<void>;
  calculateFinalResult: () => void;
  setIsSpinning: (spinning: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SPIN_SPEED = 12;
const STOP_DELAY = 0.6;

const secureRandom = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xFFFFFFFF + 1);
};

// ============================================================================
// Context
// ============================================================================

const SlotMachineContext = createContext<SlotMachineContextValue | null>(null);

export const useSlotMachine = (): SlotMachineContextValue => {
  const context = useContext(SlotMachineContext);
  if (!context) {
    throw new Error('useSlotMachine must be used within SlotMachineProvider');
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

interface SlotMachineProviderProps {
  children: ReactNode;
}

export const SlotMachineProvider: FC<SlotMachineProviderProps> = ({ children }) => {
  // 3D object refs
  const handlePivotRef = useRef<THREE.Object3D | null>(null);
  const spinnersRef = useRef<Record<string, THREE.Object3D>>({});
  const knobMaterialRef = useRef<AnimatedGlowBorderMaterial | null>(null);
  const displayPlateRef = useRef<DynamicDisplayPlate | null>(null);
  const indicatorMaterialsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const reelManagersRef = useRef<ReelTextureManager[] | null>(null);

  // Reel state refs
  const reelStatesRef = useRef<ReelState[]>([
    { angle: 0, velocity: 0, phase: 'stopped', lastSwappedFace: -1 },
    { angle: 0, velocity: 0, phase: 'stopped', lastSwappedFace: -1 },
    { angle: 0, velocity: 0, phase: 'stopped', lastSwappedFace: -1 },
  ]);
  const swapTimersRef = useRef<number[]>([0, 0, 0]);

  // State
  const isSpinningRef = useRef(false);
  const stopTimers = useRef<NodeJS.Timeout[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);

  // Initialize reel texture managers
  const initializeReels = useCallback(async () => {
    if (reelManagersRef.current) return;

    const [backend, frontend, database] = await Promise.all([
      createReelTextureManager('backend'),
      createReelTextureManager('frontend'),
      createReelTextureManager('database'),
    ]);

    reelManagersRef.current = [backend, frontend, database];
    setIsInitialized(true);
  }, []);

  // Setters
  const setHandlePivot = useCallback((pivot: THREE.Object3D | null) => {
    handlePivotRef.current = pivot;
  }, []);

  const setSpinners = useCallback((spinners: Record<string, THREE.Object3D>) => {
    spinnersRef.current = spinners;
  }, []);

  const setKnobMaterial = useCallback((material: AnimatedGlowBorderMaterial) => {
    knobMaterialRef.current = material;
  }, []);

  const setDisplayPlate = useCallback((plate: DynamicDisplayPlate) => {
    displayPlateRef.current = plate;
  }, []);

  const setIndicatorMaterials = useCallback((materials: THREE.MeshPhysicalMaterial[]) => {
    indicatorMaterialsRef.current = materials;
  }, []);

  const setIsSpinning = useCallback((spinning: boolean) => {
    isSpinningRef.current = spinning;
    if (!spinning) {
      knobMaterialRef.current?.setPaused(false);
    }
  }, []);

  // Stop a single reel
  const stopReel = useCallback((index: number) => {
    reelStatesRef.current[index].phase = 'decelerating';
  }, []);

  // Calculate final result when all reels stop
  const calculateFinalResult = useCallback(() => {
    if (!reelManagersRef.current) return;

    const managers = reelManagersRef.current;
    const results: Technology[] = [];

    reelStatesRef.current.forEach((state, i) => {
      const faceIndex = getFrontFaceIndex(state.angle);
      results.push(managers[i].currentTechs[faceIndex]);
    });

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

    // Update display plate with score
    displayPlateRef.current?.showScore(
      score.score,
      score.label,
      score.color,
      score.emoji,
    );
  }, []);

  // Start the game
  const startGame = useCallback(() => {
    const anyReelActive = reelStatesRef.current.some((state) => state.phase !== 'stopped');
    if (anyReelActive || !reelManagersRef.current) return;

    // Clear existing timers and result
    stopTimers.current.forEach(clearTimeout);
    stopTimers.current = [];
    setLastResult(null);

    // Shuffle reels before starting
    reelManagersRef.current.forEach((manager) => shuffleReel(manager));

    // Mark as spinning and pause knob glow
    isSpinningRef.current = true;
    knobMaterialRef.current?.setPaused(true);

    // Update display to show spinning
    displayPlateRef.current?.showSpinning();

    // Reset swap timers
    swapTimersRef.current = [0, 0, 0];

    // Start all reels
    reelStatesRef.current.forEach((state) => {
      state.velocity = SPIN_SPEED + secureRandom() * 3;
      state.phase = 'spinning';
      state.lastSwappedFace = -1;
    });

    // Schedule staggered stops
    const spinDuration = 2000 + secureRandom() * 1500;
    [0, 1, 2].forEach((reelIndex) => {
      const delay = spinDuration + reelIndex * STOP_DELAY * 1000;
      const timer = setTimeout(() => stopReel(reelIndex), delay);
      stopTimers.current.push(timer);
    });
  }, [stopReel]);

  // Initialize on mount
  useEffect(() => {
    initializeReels();
  }, [initializeReels]);

  const value = useMemo<SlotMachineContextValue>(() => ({
    handlePivotRef,
    spinnersRef,
    knobMaterialRef,
    displayPlateRef,
    indicatorMaterialsRef,
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
    initializeReels,
    calculateFinalResult,
    setIsSpinning,
  }), [
    isInitialized,
    lastResult,
    startGame,
    setHandlePivot,
    setSpinners,
    setKnobMaterial,
    setDisplayPlate,
    setIndicatorMaterials,
    initializeReels,
    calculateFinalResult,
    setIsSpinning,
  ]);

  return (
    <SlotMachineContext.Provider value={value}>
      {children}
    </SlotMachineContext.Provider>
  );
};
