import {
  type ThreeElements,
  type ThreeEvent,
  useFrame,
} from "@react-three/fiber";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import {
  FIXED_DT,
  FRICTION_BASE,
  FULL_ROTATION,
  MAX_ANGULAR_VELOCITY,
  VELOCITY_THRESHOLD,
} from "@/lib/physics";

import { AutoSpinEffect } from "./AutoSpinEffect";
import type { SpinnerState } from "./spinner-codec";
import { SpinnerModel } from "./SpinnerModel";

/** Helper to track rotation and count complete spins */
const trackRotationAndCountSpins = (
  currentRotation: number,
  lastRotation: { current: number },
  accumulatedRotation: { current: number },
  setSpinCount: Dispatch<SetStateAction<number>>
): void => {
  const deltaRotation = currentRotation - lastRotation.current;
  accumulatedRotation.current += deltaRotation;

  if (Math.abs(accumulatedRotation.current) >= FULL_ROTATION) {
    const completeRotations = Math.floor(
      Math.abs(accumulatedRotation.current) / FULL_ROTATION
    );
    setSpinCount((prev) => prev + completeRotations);
    accumulatedRotation.current %= FULL_ROTATION;
  }
  lastRotation.current = currentRotation;
};

export type InteractiveSpinnerProps = ThreeElements["group"] & {
  setSpinCount: Dispatch<SetStateAction<number>>;
  /** When synced, this function computes current state from CRDT */
  computeState?: (now: number) => SpinnerState;
  /** Called when user grabs the spinner */
  onGrab?: (rotation: number) => void;
  /** Called when user drags the spinner */
  onDrag?: (rotation: number, velocity: number) => void;
  /** Called when user releases the spinner */
  onRelease?: (rotation: number, velocity: number) => void;
  /** Whether we're synced with remote peers */
  isSynced?: boolean;
  /** Multiplier for spin velocity from upgrades */
  speedMultiplier?: number;
  /** RGB mode level (0 = off, 1+ = on with increasing speed) */
  rgbLevel?: number;
  /** External ref to track dragging state (for auto-spin) */
  isDraggingRef?: MutableRefObject<boolean>;
  /** Visual pulse when auto-spin triggers */
  autoSpinPulse?: boolean;
  /** Callback to report current velocity (for high-speed renderer) */
  onVelocityChange?: (velocity: number) => void;
};

export const InteractiveSpinner = ({
  setSpinCount,
  computeState,
  onGrab,
  onDrag,
  onRelease,
  isSynced = false,
  speedMultiplier = 1,
  rgbLevel = 0,
  isDraggingRef,
  autoSpinPulse = false,
  onVelocityChange,
  ...props
}: InteractiveSpinnerProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const frameCount = useRef(0);

  // Sync internal dragging state with external ref
  const setDragging = (value: boolean) => {
    isDragging.current = value;
    if (isDraggingRef) {
      isDraggingRef.current = value;
    }
  };
  const hasInitializedDrag = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const angularVelocity = useRef(5);
  const lastDragTime = useRef(0);
  const lastRotation = useRef(0);
  const accumulatedRotation = useRef(0);
  const lastDragEmitTime = useRef(0);
  const DRAG_EMIT_INTERVAL = 16; // ~60 events/sec for smooth streaming
  const [isXray, setIsXray] = useState(false);

  const getMouseAngle = (event: ThreeEvent<PointerEvent>): number => {
    if (!groupRef.current || !event.target) return 0;

    const center = new THREE.Vector3();
    groupRef.current.getWorldPosition(center);
    center.project(event.camera);

    const target = event.nativeEvent.target;
    if (!(target instanceof HTMLElement)) return 0;

    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return Math.atan2(y - center.y, x - center.x);
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();

    if (e.buttons > 0) {
      setDragging(true);
      hasInitializedDrag.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
      lastDragTime.current = performance.now();
      document.body.style.cursor = "grabbing";
      angularVelocity.current = 0;

      // Emit grab event for CRDT (also when computeState provided for auto-spin)
      if (groupRef.current && (isSynced || computeState)) {
        onGrab?.(groupRef.current.rotation.y);
      }
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || !hasInitializedDrag.current || !groupRef.current)
      return;

    const currentAngle = getMouseAngle(e);
    const previousAngle = getMouseAngle({
      ...e,
      clientX: previousMousePosition.current.x,
      clientY: previousMousePosition.current.y,
    } as ThreeEvent<PointerEvent>);
    const deltaAngle = currentAngle - previousAngle;

    groupRef.current.rotation.y -= deltaAngle;

    const currentTime = performance.now();
    const timeDelta = (currentTime - lastDragTime.current) / 1000;
    if (timeDelta > 0) {
      const baseVelocity = deltaAngle / timeDelta;
      const DEAD_ZONE = 0.1;
      const BOOST_SCALE = 0.3;
      const EXPONENT = 1.2;

      const speedFactor = Math.max(0, Math.abs(baseVelocity) - DEAD_ZONE);
      const boost = speedFactor ** EXPONENT * BOOST_SCALE;
      const boostedVelocity =
        speedFactor > 0 ? baseVelocity * (1 + boost) : baseVelocity;

      const maxVelocity = MAX_ANGULAR_VELOCITY * speedMultiplier;
      angularVelocity.current = THREE.MathUtils.clamp(
        boostedVelocity * speedMultiplier,
        -maxVelocity,
        maxVelocity
      );
    }

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    lastDragTime.current = currentTime;

    // Stream drag events directly on pointer move for responsive sync
    if ((isSynced || computeState) && currentTime - lastDragEmitTime.current >= DRAG_EMIT_INTERVAL) {
      onDrag?.(groupRef.current.rotation.y, angularVelocity.current);
      lastDragEmitTime.current = currentTime;
    }
  };

  const emitRelease = useCallback(() => {
    if (groupRef.current && (isSynced || computeState)) {
      try {
        onRelease?.(groupRef.current.rotation.y, angularVelocity.current);
      } catch {
        // Prevent callback errors from crashing the spinner
      }
    }
  }, [isSynced, computeState, onRelease]);

  const resetCursor = useCallback(() => {
    document.body.style.cursor = "";
    if (isDragging.current || hasInitializedDrag.current) {
      emitRelease();
    }
    setDragging(false);
    hasInitializedDrag.current = false;
  }, [emitRelease]);

  const handlePointerUp = useCallback(() => {
    if (hasInitializedDrag.current) {
      document.body.style.cursor = "grab";
      emitRelease();
      setDragging(false);
      hasInitializedDrag.current = false;
    }
  }, [emitRelease]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.set(Math.PI, 0, -Math.PI / 2);
      lastRotation.current = groupRef.current.rotation.y;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "x") {
        setIsXray((prev) => !prev);
      }
    };

    const handleWindowMouseUp = () => {
      if (isDragging.current) {
        resetCursor();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("mouseleave", resetCursor);

    return () => {
      resetCursor();
      window.removeEventListener("keydown", handleKeyPress);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("mouseleave", resetCursor);
    };
  }, [resetCursor]);

  useFrame(() => {
    if (!groupRef.current) return;

    frameCount.current++;

    // At high velocities, skip frames to reduce CPU load
    // This is imperceptible since the spinner is a blur anyway
    const speed = Math.abs(angularVelocity.current);
    const skipFrames = speed > 50 ? 3 : speed > 30 ? 2 : 1;
    const shouldUpdate = frameCount.current % skipFrames === 0;

    // When computeState is provided and not dragging, use CRDT state
    if (!isDragging.current && computeState) {
      const state = computeState(Date.now());

      // Always update rotation for smooth visuals
      groupRef.current.rotation.y = state.rotation;
      angularVelocity.current = state.velocity;

      // Only track spin count on update frames to reduce React updates
      if (shouldUpdate) {
        trackRotationAndCountSpins(
          state.rotation,
          lastRotation,
          accumulatedRotation,
          setSpinCount
        );
      }
      return;
    }

    // Local physics when computeState not provided or dragging
    if (!isDragging.current && angularVelocity.current !== 0) {
      const frictionFactor = Math.max(FRICTION_BASE - speed * 0.0001, 0.995);
      angularVelocity.current *= frictionFactor;

      if (Math.abs(angularVelocity.current) < VELOCITY_THRESHOLD) {
        angularVelocity.current = 0;
      }

      // Use fixed timestep for consistency
      groupRef.current.rotation.y -= angularVelocity.current * FIXED_DT;

      // Only track spin count on update frames to reduce React updates
      if (shouldUpdate) {
        trackRotationAndCountSpins(
          groupRef.current.rotation.y,
          lastRotation,
          accumulatedRotation,
          setSpinCount
        );
      }
    }

    // Report velocity to parent for high-speed renderer
    onVelocityChange?.(angularVelocity.current);
  });

  return (
    <group
      ref={groupRef}
      {...props}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <SpinnerModel isXray={isXray} rgbLevel={rgbLevel} />
      {/* Auto-spin wind burst effect - counter-rotates to stay fixed in world space */}
      <AutoSpinEffect active={autoSpinPulse} parentRef={groupRef} />
    </group>
  );
};

InteractiveSpinner.displayName = "InteractiveSpinner";
