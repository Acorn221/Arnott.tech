import {
  createContext,
  useContext,
  useRef,
  useCallback,
  FC,
  ReactNode,
  useMemo,
} from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AnimatedGlowBorderMaterial } from './display-border-material';

// Reel state types
type ReelPhase = 'stopped' | 'spinning' | 'decelerating' | 'settling';

interface ReelState {
  angle: number;
  velocity: number;
  phase: ReelPhase;
}

// Slot machine configuration
const SPIN_SPEED = 12;
const STOP_DELAY = 0.6;
const GEOMETRY_FACES = 8;
const FRICTION = 0.92;
const MIN_VELOCITY = 0.5;

const SPINNER_NAMES = ['slot-spinner-1', 'slot-spinner-2', 'slot-spinner-3'] as const;

// Cryptographically secure random
const secureRandom = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xFFFFFFFF + 1);
};

// Context shape
interface SlotMachineContextValue {
  // Refs for 3D objects
  handlePivotRef: React.MutableRefObject<THREE.Object3D | null>;
  spinnersRef: React.MutableRefObject<Record<string, THREE.Object3D>>;
  knobMaterialRef: React.MutableRefObject<AnimatedGlowBorderMaterial | null>;

  // State
  isSpinningRef: React.MutableRefObject<boolean>;

  // Actions
  startGame: () => void;
  setHandlePivot: (pivot: THREE.Object3D | null) => void;
  setSpinners: (spinners: Record<string, THREE.Object3D>) => void;
  setKnobMaterial: (material: AnimatedGlowBorderMaterial) => void;
}

const SlotMachineContext = createContext<SlotMachineContextValue | null>(null);

// Hook to use the context
export const useSlotMachine = (): SlotMachineContextValue => {
  const context = useContext(SlotMachineContext);
  if (!context) {
    throw new Error('useSlotMachine must be used within SlotMachineProvider');
  }
  return context;
};

// Provider component
interface SlotMachineProviderProps {
  children: ReactNode;
}

export const SlotMachineProvider: FC<SlotMachineProviderProps> = ({ children }) => {
  // 3D object refs
  const handlePivotRef = useRef<THREE.Object3D | null>(null);
  const spinnersRef = useRef<Record<string, THREE.Object3D>>({});
  const knobMaterialRef = useRef<AnimatedGlowBorderMaterial | null>(null);

  // Game state
  const isSpinningRef = useRef(false);
  const stopTimers = useRef<NodeJS.Timeout[]>([]);
  const reelStates = useRef<ReelState[]>([
    { angle: 0, velocity: 0, phase: 'stopped' },
    { angle: 0, velocity: 0, phase: 'stopped' },
    { angle: 0, velocity: 0, phase: 'stopped' },
  ]);

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

  // Stop a single reel
  const stopReel = useCallback((index: number) => {
    reelStates.current[index].phase = 'decelerating';
  }, []);

  // Start the game
  const startGame = useCallback(() => {
    const anyReelActive = reelStates.current.some((state) => state.phase !== 'stopped');
    if (anyReelActive) return;

    // Clear existing timers
    stopTimers.current.forEach(clearTimeout);
    stopTimers.current = [];

    // Mark as spinning and pause knob glow
    isSpinningRef.current = true;
    knobMaterialRef.current?.setPaused(true);

    // Start all reels
    reelStates.current.forEach((state) => {
      state.velocity = SPIN_SPEED + secureRandom() * 3;
      state.phase = 'spinning';
    });

    // Schedule staggered stops
    const spinDuration = 2000 + secureRandom() * 1500;
    [0, 1, 2].forEach((reelIndex) => {
      const delay = spinDuration + reelIndex * STOP_DELAY * 1000;
      const timer = setTimeout(() => stopReel(reelIndex), delay);
      stopTimers.current.push(timer);
    });
  }, [stopReel]);

  // Animation loop for reels
  useFrame((_, delta) => {
    reelStates.current.forEach((state, i) => {
      const spinner = spinnersRef.current[SPINNER_NAMES[i]];
      if (!spinner) return;

      if (state.phase === 'spinning') {
        state.angle += state.velocity * delta;
      } else if (state.phase === 'decelerating') {
        state.velocity *= FRICTION;
        state.angle += state.velocity * delta;
        if (state.velocity < MIN_VELOCITY) {
          state.phase = 'settling';
        }
      } else if (state.phase === 'settling') {
        const radiansPerFace = (Math.PI * 2) / GEOMETRY_FACES;
        const nearestSlot = Math.round(state.angle / radiansPerFace) * radiansPerFace;
        const diff = state.angle - nearestSlot;

        if (Math.abs(diff) > 0.005) {
          state.angle -= diff * 0.2;
        } else {
          state.angle = nearestSlot;
          state.velocity = 0;
          state.phase = 'stopped';
        }
      }

      spinner.rotation.x = -state.angle;
    });

    // Check if all reels stopped
    if (isSpinningRef.current) {
      const allStopped = reelStates.current.every((state) => state.phase === 'stopped');
      if (allStopped) {
        isSpinningRef.current = false;
        knobMaterialRef.current?.setPaused(false);
      }
    }
  });

  const value = useMemo<SlotMachineContextValue>(() => ({
    handlePivotRef,
    spinnersRef,
    knobMaterialRef,
    isSpinningRef,
    startGame,
    setHandlePivot,
    setSpinners,
    setKnobMaterial,
  }), [startGame, setHandlePivot, setSpinners, setKnobMaterial]);

  return (
    <SlotMachineContext.Provider value={value}>
      {children}
    </SlotMachineContext.Provider>
  );
};

