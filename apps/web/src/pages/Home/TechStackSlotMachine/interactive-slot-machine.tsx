import { type FC, useRef, useCallback, Suspense } from "react";
import type * as THREE from "three";
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
const SHARE_BUTTON_PRESS_DEPTH = 0.0006; // Deeper press for more satisfying click
const SHARE_BUTTON_PRESS_DURATION = 0.08; // Snappier press

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
    spinButtonRef,
    spinButtonMaterialRef,
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

  // Button animation state (both buttons RGB cycle)
  const buttonGlowTime = useRef(0);
  const spinButtonBaseZ = useRef<number | null>(null);
  const spinButtonPressProgress = useRef(0);
  const isSpinButtonPressed = useRef(false);
  const shareButtonBaseZ = useRef<number | null>(null);
  const shareButtonPressProgress = useRef(0);
  const isShareButtonPressed = useRef(false);

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
    console.log("[slot-machine] handleTrigger called");
    const started = startGame();
    console.log("[slot-machine] startGame returned:", started);
    if (started) {
      soundManager.playHandlePull();
      triggerRumble();
    }
  }, [triggerRumble, startGame]);

  const { handlePointerDown, handlePointerOver, handlePointerOut } =
    useSlotMachineHandle({ onTrigger: handleTrigger });

  // Check if object is either share button (walk up parent chain)
  const isShareButton = useCallback(
    (object: THREE.Object3D | null): "left" | "right" | null => {
      let current: THREE.Object3D | null = object;
      while (current) {
        const name = current.name.toLowerCase();
        if (name === "button-1-body" || name.includes("button-1"))
          return "left";
        if (name === "button-2-body" || name.includes("button-2"))
          return "right";
        current = current.parent;
      }
      return null;
    },
    [],
  );

  // Share button click handler (works for both buttons)
  const handleShareButtonClick = useCallback(
    (which: "left" | "right") => {
      if (!lastResult) return;

      soundManager.playButtonClick();
      if (which === "left") {
        isSpinButtonPressed.current = true;
        spinButtonPressProgress.current = 0;
      } else {
        isShareButtonPressed.current = true;
        shareButtonPressProgress.current = 0;
      }

      setTimeout(() => {
        void shareResult();
      }, 120);
    },
    [lastResult, shareResult],
  );

  // Combined pointer down handler
  const combinedPointerDown = useCallback(
    (event: { object: THREE.Object3D; stopPropagation: () => void }) => {
      const buttonType = isShareButton(event.object);

      if (buttonType && lastResult) {
        handleShareButtonClick(buttonType);
        event.stopPropagation();
        return;
      }

      handlePointerDown(event);
    },
    [isShareButton, lastResult, handleShareButtonClick, handlePointerDown],
  );

  // Combined pointer over handler
  const combinedPointerOver = useCallback(
    (event: { object: THREE.Object3D }) => {
      const buttonType = isShareButton(event.object);

      // Show pointer cursor for buttons when there's a result to share
      if (buttonType) {
        if (lastResult) {
          gl.domElement.style.cursor = "pointer";
        }
        return; // Don't pass to handle hover
      }

      handlePointerOver(event);
    },
    [isShareButton, lastResult, gl, handlePointerOver],
  );

  // Combined pointer out handler
  const combinedPointerOut = useCallback(() => {
    gl.domElement.style.cursor = "auto";
    handlePointerOut();
  }, [gl, handlePointerOut]);

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

    // RGB button animations - BOTH are share buttons, only glow when there's a result
    buttonGlowTime.current += delta;
    const rgbTime = buttonGlowTime.current;
    const hasResult = lastResult !== null;

    // LEFT SHARE BUTTON - RGB cycle
    const spinButton = spinButtonRef.current;
    const spinButtonMaterial = spinButtonMaterialRef.current;
    if (spinButton && spinButtonMaterial) {
      if (spinButtonBaseZ.current === null) {
        spinButtonBaseZ.current = spinButton.position.z;
      }

      if (hasResult && !isSpinButtonPressed.current) {
        // RGB rainbow cycle (toned down)
        const hue = (rgbTime * 0.3) % 1;
        const pulse = 0.8 + Math.sin(rgbTime * 4) * 0.4;
        spinButtonMaterial.material.emissive.setHSL(hue, 0.9, 0.4);
        spinButtonMaterial.material.color.setHSL(hue, 0.7, 0.3);
        spinButtonMaterial.material.emissiveIntensity = pulse;
      } else if (!hasResult) {
        // Dim when no result
        spinButtonMaterial.material.emissiveIntensity = 0;
        spinButtonMaterial.material.color.set("#1a1a1a");
      }

      // Press animation
      if (isSpinButtonPressed.current) {
        spinButtonPressProgress.current += delta / SHARE_BUTTON_PRESS_DURATION;
        if (spinButtonPressProgress.current >= 1.5) {
          isSpinButtonPressed.current = false;
          spinButtonPressProgress.current = 0;
          spinButton.position.z = spinButtonBaseZ.current;
        } else {
          const press = Math.min(spinButtonPressProgress.current, 1);
          const release = Math.max(0, spinButtonPressProgress.current - 1) * 2;
          const depth = press * (1 - release);
          spinButton.position.z =
            spinButtonBaseZ.current + SHARE_BUTTON_PRESS_DEPTH * depth;
          spinButtonMaterial.material.emissiveIntensity = 1.8;
        }
      }
    }

    // RIGHT SHARE BUTTON - RGB cycle offset by 0.5 (opposite colors)
    const shareButton = shareButtonRef.current;
    const shareButtonMaterial = shareButtonMaterialRef.current;
    if (shareButton && shareButtonMaterial) {
      if (shareButtonBaseZ.current === null) {
        shareButtonBaseZ.current = shareButton.position.z;
      }

      if (hasResult && !isShareButtonPressed.current) {
        // RGB rainbow cycle - offset by 0.5 for opposite colors (toned down)
        const hue = (rgbTime * 0.3 + 0.5) % 1;
        const pulse = 0.8 + Math.sin(rgbTime * 4) * 0.4;
        shareButtonMaterial.material.emissive.setHSL(hue, 0.9, 0.4);
        shareButtonMaterial.material.color.setHSL(hue, 0.7, 0.3);
        shareButtonMaterial.material.emissiveIntensity = pulse;
      } else if (!hasResult) {
        // Dim when no result
        shareButtonMaterial.material.emissiveIntensity = 0;
        shareButtonMaterial.material.color.set("#1a1a1a");
      }

      // Press animation
      if (isShareButtonPressed.current) {
        shareButtonPressProgress.current += delta / SHARE_BUTTON_PRESS_DURATION;
        if (shareButtonPressProgress.current >= 1.5) {
          isShareButtonPressed.current = false;
          shareButtonPressProgress.current = 0;
          shareButton.position.z = shareButtonBaseZ.current;
        } else {
          const press = Math.min(shareButtonPressProgress.current, 1);
          const release = Math.max(0, shareButtonPressProgress.current - 1) * 2;
          const depth = press * (1 - release);
          shareButton.position.z =
            shareButtonBaseZ.current + SHARE_BUTTON_PRESS_DEPTH * depth;
          shareButtonMaterial.material.emissiveIntensity = 1.8;
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
