import { type FC, useRef, useCallback, Suspense, useEffect } from "react";
import * as THREE from "three";
import { type Group } from "three";
import { useFrame, type ThreeElements, useThree } from "@react-three/fiber";

import { useSlotMachine } from "./SlotMachineContext";
import SlotMachineModel from "./slot-machine-model";
import { useSlotMachineHandle } from "./useSlotMachineHandle";
import TechLabels from "./TechLabels";
import {
  getHiddenFaces,
  getRandomUnusedTech,
  updateReelFace,
} from "./config/reel-textures";
import { soundManager } from "./sounds";

// Rumble configuration
const RUMBLE_DURATION = 0.5;
const RUMBLE_INTENSITY = 0.02;
const RUMBLE_FREQUENCY = 6;

// Reel animation constants
const GEOMETRY_FACES = 8;
const FRICTION = 0.92;
const MIN_VELOCITY = 0.5;
const SWAP_INTERVAL = 0.3;
// Offset to center faces (360/8/2 = 22.5 degrees = π/8 radians)
const FACE_ALIGNMENT_OFFSET = Math.PI / 8;

// Share button animation
const SHARE_BUTTON_PRESS_DEPTH = 0.0002;
const SHARE_BUTTON_PRESS_DURATION = 0.1;

const SPINNER_NAMES = [
  "slot-spinner-1",
  "slot-spinner-2",
  "slot-spinner-3",
] as const;

type InteractiveSlotMachineProps = ThreeElements["group"] & {
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
    shareButtonRef,
    shareButtonMaterialRef,
    shareResult,
  } = useSlotMachine();
  const { gl } = useThree();

  // Rumble state
  const rumbleTimeRef = useRef(0);
  const isRumblingRef = useRef(false);
  const basePosition = useRef<[number, number, number]>(position);

  // Indicator animation state
  const indicatorTimeRef = useRef(0);

  // Share button state
  const shareButtonBaseZ = useRef<number | null>(null);
  const shareButtonPressProgress = useRef(0);
  const isShareButtonPressed = useRef(false);
  const shareButtonGlowTime = useRef(0);

  // Sound effect state
  const prevPhasesRef = useRef<string[]>(["stopped", "stopped", "stopped"]);
  const clickTimerRef = useRef(0);
  const CLICK_INTERVAL = 0.08; // Time between clicks during spin

  const triggerRumble = useCallback(() => {
    isRumblingRef.current = true;
    rumbleTimeRef.current = 0;
    basePosition.current = position;
  }, [position]);

  const handleTrigger = useCallback(() => {
    soundManager.playHandlePull();
    triggerRumble();
    startGame();
  }, [triggerRumble, startGame]);

  const { handlePointerDown, handlePointerOver, handlePointerOut } =
    useSlotMachineHandle({ onTrigger: handleTrigger });

  // Activate/deactivate share button glow based on result availability
  useEffect(() => {
    const material = shareButtonMaterialRef.current;
    if (material) {
      material.setActive(lastResult !== null);
    }
  }, [lastResult, shareButtonMaterialRef]);

  // Check if an object is the share button or its child
  const isShareButton = useCallback((object: THREE.Object3D | null): boolean => {
    let current = object;
    while (current) {
      if (current.name === "button-2-body") {
        return true;
      }
      current = current.parent;
    }
    return false;
  }, []);

  // Share button click handler
  const handleShareButtonClick = useCallback(() => {
    if (!lastResult) return;
    
    // Trigger button press animation
    isShareButtonPressed.current = true;
    shareButtonPressProgress.current = 0;
    
    // Execute share after a small delay for visual feedback
    setTimeout(() => {
      shareResult();
    }, 100);
  }, [lastResult, shareResult]);

  // Combined pointer down handler - handle + share button
  const combinedPointerDown = useCallback(
    (event: { object: THREE.Object3D; stopPropagation: () => void }) => {
      // Check for share button first
      if (isShareButton(event.object)) {
        if (lastResult) {
          handleShareButtonClick();
          event.stopPropagation();
        }
        return;
      }
      // Otherwise delegate to handle
      handlePointerDown(event);
    },
    [isShareButton, lastResult, handleShareButtonClick, handlePointerDown],
  );

  // Combined pointer over handler
  const combinedPointerOver = useCallback(
    (event: { object: THREE.Object3D }) => {
      if (isShareButton(event.object)) {
        if (lastResult) {
          gl.domElement.style.cursor = "pointer";
        }
        return;
      }
      handlePointerOver(event);
    },
    [isShareButton, lastResult, gl, handlePointerOver],
  );

  // Combined pointer out handler
  const combinedPointerOut = useCallback(() => {
    handlePointerOut();
  }, [handlePointerOut]);

  // Main animation loop - handles reels, rumble, and cursor
  useFrame((_, delta) => {
    const managers = reelManagersRef.current;
    const reelStates = reelStatesRef.current;

    // Reset cursor if spinning
    if (isSpinningRef.current && gl.domElement.style.cursor === "grab") {
      gl.domElement.style.cursor = "auto";
    }

    // Reel animation
    reelStates.forEach((state, i) => {
      const spinner = spinnersRef.current[SPINNER_NAMES[i]];
      if (!spinner) return;

      // Dynamic face swapping during spin
      if (managers && state.phase === "spinning") {
        swapTimersRef.current[i] += delta;

        if (swapTimersRef.current[i] >= SWAP_INTERVAL) {
          swapTimersRef.current[i] = 0;

          const hiddenFaces = getHiddenFaces(state.angle);
          if (hiddenFaces.length > 0) {
            const faceToSwap =
              hiddenFaces[Math.floor(Math.random() * hiddenFaces.length)];
            if (faceToSwap !== state.lastSwappedFace) {
              const newTech = getRandomUnusedTech(managers[i]);
              updateReelFace(managers[i], faceToSwap, newTech);
              state.lastSwappedFace = faceToSwap;
            }
          }
        }
      }

      // Physics
      if (state.phase === "spinning") {
        state.angle += state.velocity * delta;
      } else if (state.phase === "decelerating") {
        state.velocity *= FRICTION;
        state.angle += state.velocity * delta;
        if (state.velocity < MIN_VELOCITY) {
          state.phase = "settling";
        }
      } else if (state.phase === "settling") {
        const radiansPerFace = (Math.PI * 2) / GEOMETRY_FACES;
        const nearestSlot =
          Math.round(state.angle / radiansPerFace) * radiansPerFace;
        const diff = state.angle - nearestSlot;

        if (Math.abs(diff) > 0.005) {
          state.angle -= diff * 0.2;
        } else {
          state.angle = nearestSlot;
          state.velocity = 0;
          state.phase = "stopped";
        }
      }

      spinner.rotation.x = -state.angle + FACE_ALIGNMENT_OFFSET;

      // Play stop sound when reel transitions to stopped
      if (state.phase === "stopped" && prevPhasesRef.current[i] !== "stopped") {
        soundManager.playReelStop();
      }
      prevPhasesRef.current[i] = state.phase;
    });

    // Play clicking sounds during spin
    if (isSpinningRef.current) {
      clickTimerRef.current += delta;
      if (clickTimerRef.current >= CLICK_INTERVAL) {
        clickTimerRef.current = 0;
        soundManager.playReelClick();
      }
    }

    // Check if all reels stopped
    if (isSpinningRef.current) {
      const allStopped = reelStates.every((state) => state.phase === "stopped");
      if (allStopped) {
        setIsSpinning(false);
        calculateFinalResult();
      }
    }

    // Indicator animation
    // Note: Keep emissiveIntensity above bloom threshold (0.3) to prevent flash
    const indicators = indicatorMaterialsRef.current;
    if (indicators.length > 0) {
      indicatorTimeRef.current += delta;
      const t = indicatorTimeRef.current;

      if (isSpinningRef.current) {
        // Fast pulsing during spin - rainbow chase effect
        indicators.forEach((mat, i) => {
          const phase = t * 6 + i * 0.5;
          const intensity = 0.6 + Math.sin(phase) * 0.2; // Range: 0.4-0.8
          mat.emissiveIntensity = intensity;
          // Cycle through colors
          const hue = (t * 0.3 + i * 0.25) % 1;
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
          const pulse = 0.5 + Math.sin(t * 1.2) * 0.15; // Range: 0.35-0.65
          mat.emissiveIntensity = pulse;
          mat.emissive.setHSL(hue, 1, 0.5);
          mat.color.setHSL(hue, 1, 0.6);
        });
      } else {
        // Idle state - gentle orange pulse
        indicators.forEach((mat, i) => {
          const phase = t * 0.8 + i * 0.4;
          const intensity = 0.5 + Math.sin(phase) * 0.1; // Range: 0.4-0.6
          mat.emissiveIntensity = intensity;
          mat.emissive.setHSL(0.08, 1, 0.5); // Orange
          mat.color.setHSL(0.08, 1, 0.5);
        });
      }
    }

    // Share button animation
    const shareButton = shareButtonRef.current;
    const shareButtonMaterial = shareButtonMaterialRef.current;
    if (shareButton && shareButtonMaterial) {
      // Store base Z position (model is rotated -90° on X, so Z is the "forward" axis)
      if (shareButtonBaseZ.current === null) {
        shareButtonBaseZ.current = shareButton.position.z;
      }

      // Glow pulsing when active (has result)
      if (lastResult) {
        shareButtonGlowTime.current += delta;
        const pulse = 1.0 + Math.sin(shareButtonGlowTime.current * 3) * 0.5;
        shareButtonMaterial.material.emissiveIntensity = pulse;
      }

      // Button press animation (move on Z axis - into the machine)
      if (isShareButtonPressed.current) {
        shareButtonPressProgress.current += delta / SHARE_BUTTON_PRESS_DURATION;
        
        if (shareButtonPressProgress.current >= 2) {
          // Animation complete (press down + release)
          isShareButtonPressed.current = false;
          shareButtonPressProgress.current = 0;
          shareButton.position.z = shareButtonBaseZ.current;
        } else if (shareButtonPressProgress.current >= 1) {
          // Release phase - move back out, brighten
          const releaseProgress = shareButtonPressProgress.current - 1;
          const eased = 1 - Math.pow(1 - releaseProgress, 2);
          shareButton.position.z = shareButtonBaseZ.current + SHARE_BUTTON_PRESS_DEPTH * (1 - eased);
          // Brighten back up
          const darkenAmount = 0.4 * (1 - eased);
          shareButtonMaterial.material.color.setRGB(0, 0.67 * (1 - darkenAmount), 1 * (1 - darkenAmount));
        } else {
          // Press phase - move in, darken
          const pressProgress = shareButtonPressProgress.current;
          const eased = 1 - Math.pow(1 - pressProgress, 2);
          shareButton.position.z = shareButtonBaseZ.current + SHARE_BUTTON_PRESS_DEPTH * eased;
          // Darken the color
          const darkenAmount = 0.4 * eased;
          shareButtonMaterial.material.color.setRGB(0, 0.67 * (1 - darkenAmount), 1 * (1 - darkenAmount));
        }
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
      onPointerDown={combinedPointerDown}
      onPointerOver={combinedPointerOver}
      onPointerOut={combinedPointerOut}
      {...props}
    >
      <SlotMachineModel />
      {/* Suspense boundary prevents Text3D font loading from flashing the whole scene */}
      <Suspense fallback={null}>
        <TechLabels />
      </Suspense>
    </group>
  );
};

export default InteractiveSlotMachine;
