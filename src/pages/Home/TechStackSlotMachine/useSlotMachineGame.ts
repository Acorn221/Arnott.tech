import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

type ReelPhase = 'stopped' | 'spinning' | 'decelerating' | 'settling';

interface ReelState {
  angle: number;
  velocity: number;
  phase: ReelPhase;
}

// Slot machine configuration
const SPIN_SPEED = 12;
const STOP_DELAY = 0.6;
const SYMBOLS_COUNT = 8;
const RADIANS_PER_SYMBOL = (Math.PI * 2) / SYMBOLS_COUNT;

// Physics constants
const FRICTION = 0.92;
const MIN_VELOCITY = 0.5;

// Cryptographically secure random number generator
const secureRandom = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xFFFFFFFF + 1);
};

// Spinner names for consistent ordering
const SPINNER_NAMES = ['slot-spinner-1', 'slot-spinner-2', 'slot-spinner-3'] as const;

export const useSlotMachineGame = () => {
  const spinnersRef = useRef<Record<string, THREE.Object3D>>({});
  const stopTimers = useRef<NodeJS.Timeout[]>([]);

  const reelStates = useRef<ReelState[]>([
    { angle: 0, velocity: 0, phase: 'stopped' },
    { angle: 0, velocity: 0, phase: 'stopped' },
    { angle: 0, velocity: 0, phase: 'stopped' },
  ]);

  const onSpinnersRef = useCallback((spinners: Record<string, THREE.Object3D>) => {
    spinnersRef.current = spinners;
  }, []);

  const stopReel = (index: number) => {
    const state = reelStates.current[index];
    state.phase = 'decelerating';
  };

  const startGame = useCallback(() => {
    const anyReelActive = reelStates.current.some(
      (state) => state.phase !== 'stopped',
    );

    if (anyReelActive) {
      return;
    }

    // Clear any existing timers
    stopTimers.current.forEach(clearTimeout);
    stopTimers.current = [];

    // Start all reels with slight velocity variation
    reelStates.current.forEach((state) => {
      state.velocity = SPIN_SPEED + secureRandom() * 3;
      state.phase = 'spinning';
    });

    // Schedule staggered stopping sequence
    const spinDuration = 2000 + secureRandom() * 1500;

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

      if (state.phase === 'spinning') {
        // Free spinning - constant velocity
        state.angle += state.velocity * delta;
      } else if (state.phase === 'decelerating') {
        // Apply friction to slow down
        state.velocity *= FRICTION;
        state.angle += state.velocity * delta;

        // Transition to settling when velocity is low enough
        if (state.velocity < MIN_VELOCITY) {
          state.phase = 'settling';
        }
      } else if (state.phase === 'settling') {
        // Find nearest slot BEHIND current position (round down)
        const targetSlot = Math.floor(state.angle / RADIANS_PER_SYMBOL) * RADIANS_PER_SYMBOL;
        const diff = state.angle - targetSlot; // Always positive (we're past it)

        if (diff > 0.005) {
          // Ease backward toward the slot
          state.angle -= diff * 0.2;
        } else {
          // Snap to slot and stop
          state.angle = targetSlot;
          state.velocity = 0;
          state.phase = 'stopped';
        }
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
