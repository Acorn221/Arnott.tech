import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import type * as THREE from "three";

import { useSlotMachine } from "./SlotMachineContext";

// Handle rotation constants
const MAX_HANDLE_ROTATION = Math.PI * 0.4; // ~72 degrees max pull
const SPRING_BACK_DURATION = 0.6;
const TRIGGER_THRESHOLD = 0.8; // 80% of max rotation triggers

// Sensitivity settings - touch needs higher values due to lag causing fewer events
const MOUSE_SENSITIVITY = 0.008;
const TOUCH_SENSITIVITY = 0.015; // ~2x higher for touch
const VELOCITY_BOOST_THRESHOLD = 50; // pixels/sec to start boosting
const MAX_VELOCITY_BOOST = 2.5; // max multiplier when moving fast

// Overshoot easing - goes past target then bounces back
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface UseSlotMachineHandleOptions {
  onTrigger?: () => void;
}

export const useSlotMachineHandle = ({
  onTrigger,
}: UseSlotMachineHandleOptions = {}) => {
  const { handlePivotRef, isSpinningRef } = useSlotMachine();
  const { gl } = useThree();

  // Handle state
  const handleRotation = useRef(0);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartRotation = useRef(0);

  // Spring-back animation state
  const springBackStartRotation = useRef(0);
  const springBackProgress = useRef(0);
  const isSpringBackActive = useRef(false);

  // Pointer down handler
  const handlePointerDown = useCallback(
    (event: { object: THREE.Object3D; stopPropagation: () => void }) => {
      if (isSpinningRef.current) return;

      let current: THREE.Object3D | null = event.object;
      while (current) {
        if (current.name === "handle-knob" || current.name === "handle-body") {
          isDragging.current = true;
          dragStartY.current = 0; // Will be set on first move
          dragStartRotation.current = handleRotation.current;
          gl.domElement.style.cursor = "grabbing";
          event.stopPropagation();
          return;
        }
        current = current.parent;
      }
    },
    [gl, isSpinningRef],
  );

  // Global pointer events
  useEffect(() => {
    let lastY = 0;
    let lastTime = 0;
    let hasFirstMove = false;

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging.current) return;

      const now = performance.now();

      if (!hasFirstMove) {
        lastY = event.clientY;
        lastTime = now;
        hasFirstMove = true;
        return;
      }

      const deltaY = event.clientY - lastY;
      const deltaTime = Math.max(1, now - lastTime); // ms, avoid divide by zero
      lastY = event.clientY;
      lastTime = now;

      // Use higher sensitivity for touch
      const isTouch = event.pointerType === "touch";
      const baseSensitivity = isTouch ? TOUCH_SENSITIVITY : MOUSE_SENSITIVITY;

      // Calculate velocity and apply boost for fast movements
      // This compensates for lag by amplifying fast swipes
      const velocity = Math.abs(deltaY) / deltaTime * 1000; // pixels/sec
      let velocityBoost = 1;
      if (velocity > VELOCITY_BOOST_THRESHOLD) {
        const boostFactor = Math.min(
          (velocity - VELOCITY_BOOST_THRESHOLD) / 500,
          MAX_VELOCITY_BOOST - 1,
        );
        velocityBoost = 1 + boostFactor;
      }

      const newRotation =
        handleRotation.current + deltaY * baseSensitivity * velocityBoost;
      handleRotation.current = Math.max(
        0,
        Math.min(MAX_HANDLE_ROTATION, newRotation),
      );
    };

    const onPointerUp = () => {
      if (!isDragging.current) return;

      isDragging.current = false;
      hasFirstMove = false;
      lastTime = 0;
      gl.domElement.style.cursor = "auto";

      // Check trigger
      if (
        onTrigger &&
        handleRotation.current > MAX_HANDLE_ROTATION * TRIGGER_THRESHOLD
      ) {
        onTrigger();
      }

      // Start spring-back
      if (handleRotation.current > 0) {
        springBackStartRotation.current = handleRotation.current;
        springBackProgress.current = 0;
        isSpringBackActive.current = true;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [gl, onTrigger]);

  // Animation frame
  useFrame((_, delta) => {
    const pivot = handlePivotRef.current;
    if (!pivot) return;

    // Spring back animation with overshoot
    if (isSpringBackActive.current && !isDragging.current) {
      springBackProgress.current += delta / SPRING_BACK_DURATION;

      if (springBackProgress.current >= 1) {
        springBackProgress.current = 1;
        isSpringBackActive.current = false;
        handleRotation.current = 0;
      } else {
        // easeOutBack overshoots past 1, so rotation goes negative (past 0) then back
        const eased = easeOutBack(springBackProgress.current);
        handleRotation.current = springBackStartRotation.current * (1 - eased);
      }
    }

    pivot.rotation.x = handleRotation.current;
  });

  // Pointer over/out for cursor
  const handlePointerOver = useCallback(
    (event: { object: THREE.Object3D }) => {
      if (isSpinningRef.current) return;

      let current: THREE.Object3D | null = event.object;
      while (current) {
        if (current.name === "handle-knob" || current.name === "handle-body") {
          gl.domElement.style.cursor = "grab";
          return;
        }
        current = current.parent;
      }
    },
    [gl, isSpinningRef],
  );

  const handlePointerOut = useCallback(() => {
    if (!isDragging.current) {
      gl.domElement.style.cursor = "auto";
    }
  }, [gl]);

  return {
    handlePointerDown,
    handlePointerOver,
    handlePointerOut,
  };
};
