import {
  useRef,
  useEffect,
  useState,
  type SetStateAction,
  type Dispatch,
  useCallback,
} from "react";
import * as THREE from "three";
import {
  type ThreeElements,
  type ThreeEvent,
  useFrame,
} from "@react-three/fiber";
import SpinnerModel from "./spinner-model";
import type { SpinnerState } from "@/hooks/useSpinnerCRDT";

export type InteractiveSpinnerProps = ThreeElements["group"] & {
  setSpinCount: Dispatch<SetStateAction<number>>;
  onLoad?: () => void;
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
};

const FULL_ROTATION = Math.PI * 2;
const MAX_ANGULAR_VELOCITY = 100;
const FRICTION_BASE = 0.999;

const InteractiveSpinner = ({
  setSpinCount,
  onLoad: _onLoad,
  computeState,
  onGrab,
  onDrag,
  onRelease,
  isSynced = false,
  ...props
}: InteractiveSpinnerProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const hasInitializedDrag = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const angularVelocity = useRef(5);
  const lastDragTime = useRef(0);
  const lastRotation = useRef(0);
  const accumulatedRotation = useRef(0);
  const [isXray, setIsXray] = useState(false);

  const getMouseAngle = (event: ThreeEvent<PointerEvent>): number => {
    if (!groupRef.current || !event.target) return 0;

    const center = new THREE.Vector3();
    groupRef.current.getWorldPosition(center);
    center.project(event.camera);

    const rect = (
      event.nativeEvent.target as HTMLElement
    ).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return Math.atan2(y - center.y, x - center.x);
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();

    if (e.buttons > 0) {
      isDragging.current = true;
      hasInitializedDrag.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
      lastDragTime.current = performance.now();
      document.body.style.cursor = "grabbing";
      angularVelocity.current = 0;

      // Emit grab event for CRDT
      if (groupRef.current && isSynced) {
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

      angularVelocity.current = THREE.MathUtils.clamp(
        boostedVelocity,
        -MAX_ANGULAR_VELOCITY,
        MAX_ANGULAR_VELOCITY
      );
    }

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    lastDragTime.current = currentTime;

    // Emit drag event for CRDT sync
    if (isSynced) {
      onDrag?.(groupRef.current.rotation.y, angularVelocity.current);
    }
  };

  const emitRelease = useCallback(() => {
    if (groupRef.current && isSynced) {
      onRelease?.(groupRef.current.rotation.y, angularVelocity.current);
    }
  }, [isSynced, onRelease]);

  const resetCursor = useCallback(() => {
    document.body.style.cursor = "";
    if (isDragging.current || hasInitializedDrag.current) {
      emitRelease();
    }
    isDragging.current = false;
    hasInitializedDrag.current = false;
  }, [emitRelease]);

  const handlePointerUp = useCallback(() => {
    if (hasInitializedDrag.current) {
      document.body.style.cursor = "grab";
      emitRelease();
      isDragging.current = false;
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

    // When synced and not dragging, use CRDT state
    if (isSynced && !isDragging.current && computeState) {
      const state = computeState(performance.now());
      groupRef.current.rotation.y = state.rotation;
      angularVelocity.current = state.velocity;

      // Track rotation for spin count
      const currentRotation = state.rotation;
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
      return;
    }

    // Local physics when not synced or dragging
    if (!isDragging.current && angularVelocity.current !== 0) {
      const speed = Math.abs(angularVelocity.current);
      const frictionFactor = Math.max(FRICTION_BASE - speed * 0.0001, 0.995);
      angularVelocity.current *= frictionFactor;

      if (Math.abs(angularVelocity.current) < 0.05) {
        angularVelocity.current = 0;
      }

      // Use fixed timestep for consistency
      const delta = 1 / 60;
      groupRef.current.rotation.y -= angularVelocity.current * delta;

      const currentRotation = groupRef.current.rotation.y;
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
    }
  });

  return (
    <group
      ref={groupRef}
      {...props}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <SpinnerModel isXray={isXray} />
    </group>
  );
};

InteractiveSpinner.displayName = "InteractiveSpinner";

export default InteractiveSpinner;
