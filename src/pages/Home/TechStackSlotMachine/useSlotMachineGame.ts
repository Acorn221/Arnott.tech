import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ReelState {
  angle: number;
  velocity: number;
  targetAngle: number | null;
  isStopping: boolean;
}

// Slot machine configuration
const SPIN_SPEED = 12;
const STOP_DELAY = 0.6;
const SYMBOLS_COUNT = 8;
const RADIANS_PER_SYMBOL = (Math.PI * 2) / SYMBOLS_COUNT;

// Physics constants
const STOPPING_FRICTION = 0.92;

// Spinner names for consistent ordering
const SPINNER_NAMES = ['slot-spinner-1', 'slot-spinner-2', 'slot-spinner-3'] as const;

export const useSlotMachineGame = () => {
  const gameState = useRef<'idle' | 'spinning' | 'stopping'>('idle');
  const spinnersRef = useRef<Record<string, THREE.Object3D>>({});
  const stopTimers = useRef<NodeJS.Timeout[]>([]);

  const reelStates = useRef<ReelState[]>([
    { angle: 0, velocity: 0, targetAngle: null, isStopping: false },
    { angle: 0, velocity: 0, targetAngle: null, isStopping: false },
    { angle: 0, velocity: 0, targetAngle: null, isStopping: false },
  ]);

  const onSpinnersRef = useCallback((spinners: Record<string, THREE.Object3D>) => {
    spinnersRef.current = spinners;
  }, []);

  const checkAllReelsStopped = () => {
    const allStopped = reelStates.current.every(
      (state) => state.velocity === 0 && !state.isStopping,
    );
    if (allStopped && gameState.current === 'stopping') {
      gameState.current = 'idle';
    }
  };

  const stopReel = (index: number) => {
    const state = reelStates.current[index];
    const currentSymbol = Math.floor(state.angle / RADIANS_PER_SYMBOL);

    // Pick a random symbol 3-8 positions ahead
    const symbolsAhead = 3 + Math.floor(Math.random() * 6);
    const targetSymbolIndex = currentSymbol + symbolsAhead;

    state.targetAngle = targetSymbolIndex * RADIANS_PER_SYMBOL;
    state.isStopping = true;

    if (index === 2) {
      gameState.current = 'stopping';
    }
  };

  const startGame = useCallback(() => {
    const anyReelActive = reelStates.current.some(
      (state) => state.velocity > 0 || state.isStopping,
    );

    if (gameState.current !== 'idle' || anyReelActive) {
      return;
    }

    gameState.current = 'spinning';

    // Clear any existing timers
    stopTimers.current.forEach(clearTimeout);
    stopTimers.current = [];

    // Start all reels with slight velocity variation
    reelStates.current.forEach((state) => {
      state.velocity = SPIN_SPEED + Math.random() * 3;
      state.targetAngle = null;
      state.isStopping = false;
    });

    // Schedule staggered stopping sequence
    const spinDuration = 2000 + Math.random() * 1500;

    [0, 1, 2].forEach((reelIndex) => {
      const delay = spinDuration + (reelIndex * STOP_DELAY * 1000);
      const timer = setTimeout(() => stopReel(reelIndex), delay);
      stopTimers.current.push(timer);
    });
  }, []);

  useFrame((_, delta) => {
    reelStates.current.forEach((state, i) => {
      const spinner = spinnersRef.current[SPINNER_NAMES[i]];
      if (!spinner) return;

      if (state.isStopping && state.targetAngle !== null) {
        // Apply heavy friction to decelerate
        state.velocity *= STOPPING_FRICTION;

        if (state.velocity > 0.5) {
          // Still have momentum - keep spinning
          state.angle += state.velocity * delta;
        } else {
          // Velocity is low - ease towards target
          const diff = state.targetAngle - state.angle;

          if (Math.abs(diff) > 0.01) {
            state.angle += diff * 0.15;
          } else {
            // Snap to target
            state.angle = state.targetAngle;
            state.velocity = 0;
            state.isStopping = false;
            state.targetAngle = null;
            checkAllReelsStopped();
          }
        }
      } else if (state.velocity > 0) {
        state.angle += state.velocity * delta;
      }

      // Apply rotation (negative for correct spin direction)
      spinner.rotation.x = -state.angle;
    });
  });

  return {
    startGame,
    onSpinnersRef,
  };
};
