import { FC, useRef, useCallback } from 'react';
import { Group } from 'three';
import { useFrame, ThreeElements, useThree } from '@react-three/fiber';

import { useSlotMachine } from './SlotMachineContext';
import SlotMachineModel from './slot-machine-model';
import { useSlotMachineHandle } from './useSlotMachineHandle';
import TechLabels from './TechLabels';
import {
  getHiddenFaces,
  getRandomUnusedTech,
  updateReelFace,
} from './config/reel-textures';

// Rumble configuration
const RUMBLE_DURATION = 0.5;
const RUMBLE_INTENSITY = 0.02;
const RUMBLE_FREQUENCY = 6;

// Reel animation constants
const GEOMETRY_FACES = 8;
const FRICTION = 0.92;
const MIN_VELOCITY = 0.5;
const SWAP_INTERVAL = 0.3;

const SPINNER_NAMES = ['slot-spinner-1', 'slot-spinner-2', 'slot-spinner-3'] as const;

type InteractiveSlotMachineProps = ThreeElements['group'] & {
  scale: number;
  position: [number, number, number];
};

const InteractiveSlotMachine: FC<InteractiveSlotMachineProps> = ({
  scale,
  position,
  ...props
}) => {
  const groupRef = useRef<Group>(null);
  const {
    startGame,
    isSpinningRef,
    spinnersRef,
    reelManagersRef,
    reelStatesRef,
    swapTimersRef,
    indicatorMaterialsRef,
    calculateFinalResult,
    setIsSpinning,
    lastResult,
  } = useSlotMachine();
  const { gl } = useThree();

  // Rumble state
  const rumbleTimeRef = useRef(0);
  const isRumblingRef = useRef(false);
  const basePosition = useRef<[number, number, number]>(position);

  // Indicator animation state
  const indicatorTimeRef = useRef(0);

  const triggerRumble = useCallback(() => {
    isRumblingRef.current = true;
    rumbleTimeRef.current = 0;
    basePosition.current = position;
  }, [position]);

  const handleTrigger = useCallback(() => {
    triggerRumble();
    startGame();
  }, [triggerRumble, startGame]);

  const {
    handlePointerDown,
    handlePointerOver,
    handlePointerOut,
  } = useSlotMachineHandle({ onTrigger: handleTrigger });

  // Main animation loop - handles reels, rumble, and cursor
  useFrame((_, delta) => {
    const managers = reelManagersRef.current;
    const reelStates = reelStatesRef.current;

    // Reset cursor if spinning
    if (isSpinningRef.current && gl.domElement.style.cursor === 'grab') {
      gl.domElement.style.cursor = 'auto';
    }

    // Reel animation
    reelStates.forEach((state, i) => {
      const spinner = spinnersRef.current[SPINNER_NAMES[i]];
      if (!spinner) return;

      // Dynamic face swapping during spin
      if (managers && state.phase === 'spinning') {
        swapTimersRef.current[i] += delta;

        if (swapTimersRef.current[i] >= SWAP_INTERVAL) {
          swapTimersRef.current[i] = 0;

          const hiddenFaces = getHiddenFaces(state.angle);
          if (hiddenFaces.length > 0) {
            const faceToSwap = hiddenFaces[Math.floor(Math.random() * hiddenFaces.length)];
            if (faceToSwap !== state.lastSwappedFace) {
              const newTech = getRandomUnusedTech(managers[i]);
              updateReelFace(managers[i], faceToSwap, newTech);
              state.lastSwappedFace = faceToSwap;
            }
          }
        }
      }

      // Physics
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
      const allStopped = reelStates.every((state) => state.phase === 'stopped');
      if (allStopped) {
        setIsSpinning(false);
        calculateFinalResult();
      }
    }

    // Indicator animation
    const indicators = indicatorMaterialsRef.current;
    if (indicators.length > 0) {
      indicatorTimeRef.current += delta;
      const t = indicatorTimeRef.current;

      if (isSpinningRef.current) {
        // Fast pulsing during spin - rainbow chase effect
        indicators.forEach((mat, i) => {
          const phase = t * 8 + i * 0.5;
          const intensity = 0.5 + Math.sin(phase) * 0.5;
          mat.emissiveIntensity = intensity * 2;
          // Cycle through colors
          const hue = (t * 0.5 + i * 0.25) % 1;
          mat.emissive.setHSL(hue, 1, 0.5);
          mat.color.setHSL(hue, 1, 0.5);
        });
      } else if (lastResult) {
        // Settled state - glow based on score
        const { score } = lastResult.score;
        let hue = 0; // Red (low score)
        if (score > 70) {
          hue = 0.33; // Green
        } else if (score > 40) {
          hue = 0.12; // Orange
        }
        indicators.forEach((mat) => {
          const pulse = 0.6 + Math.sin(t * 2) * 0.4;
          mat.emissiveIntensity = pulse;
          mat.emissive.setHSL(hue, 1, 0.5);
          mat.color.setHSL(hue, 1, 0.6);
        });
      } else {
        // Idle state - gentle orange pulse
        indicators.forEach((mat, i) => {
          const phase = t * 1.5 + i * 0.3;
          const intensity = 0.3 + Math.sin(phase) * 0.2;
          mat.emissiveIntensity = intensity;
          mat.emissive.setHSL(0.08, 1, 0.5); // Orange
          mat.color.setHSL(0.08, 1, 0.5);
        });
      }
    }

    // Rumble animation
    if (!groupRef.current || !isRumblingRef.current) return;

    rumbleTimeRef.current += delta;

    if (rumbleTimeRef.current >= RUMBLE_DURATION) {
      isRumblingRef.current = false;
      groupRef.current.position.set(...basePosition.current);
      groupRef.current.rotation.set(0, 0, 0);
      return;
    }

    // Bell curve intensity (slow -> fast -> slow)
    const progress = rumbleTimeRef.current / RUMBLE_DURATION;
    const bellCurve = Math.sin(progress * Math.PI);
    const time = rumbleTimeRef.current * RUMBLE_FREQUENCY;
    const intensity = RUMBLE_INTENSITY * bellCurve;

    // Apply shake
    const offsetX = Math.sin(time * 4.7) * intensity;
    const offsetZ = Math.cos(time * 3.9) * intensity;
    const rotationY = Math.sin(time * 4.1) * intensity * 0.8;
    const rotationZ = Math.sin(time * 5.3) * intensity * 1.5;

    groupRef.current.position.set(
      basePosition.current[0] + offsetX,
      basePosition.current[1],
      basePosition.current[2] + offsetZ,
    );
    groupRef.current.rotation.y = rotationY;
    groupRef.current.rotation.z = rotationZ;
  });

  return (
    <group
      ref={groupRef}
      scale={scale}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      {...props}
    >
      <SlotMachineModel />
      <TechLabels />
    </group>
  );
};

export default InteractiveSlotMachine;
