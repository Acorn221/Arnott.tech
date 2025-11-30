import {
  type FC,
  useRef,
  useEffect,
  useState,
  type SetStateAction,
  type Dispatch,
} from "react";
import * as THREE from "three";
import {
  type ThreeElements,
  type ThreeEvent,
  useFrame,
} from "@react-three/fiber";
import SpinnerModel from "./spinner-model";

type InteractiveSpinnerProps = ThreeElements["group"] & {
  setSpinCount: Dispatch<SetStateAction<number>>;
  onLoad?: () => void;
};

const FULL_ROTATION = Math.PI * 2;
const MAX_ANGULAR_VELOCITY = 100;
const FRICTION_BASE = 0.999;

const InteractiveSpinner: FC<InteractiveSpinnerProps> = ({
  setSpinCount,
  onLoad: _onLoad,
  ...props
}) => {
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
        MAX_ANGULAR_VELOCITY,
      );
    }

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    lastDragTime.current = currentTime;
  };

  const resetCursor = () => {
    document.body.style.cursor = "";
    isDragging.current = false;
    hasInitializedDrag.current = false;
  };

  const handlePointerUp = () => {
    if (hasInitializedDrag.current) {
      document.body.style.cursor = "grab";
      isDragging.current = false;
      hasInitializedDrag.current = false;
    }
  };

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
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (!isDragging.current && angularVelocity.current !== 0) {
      const speed = Math.abs(angularVelocity.current);
      const frictionFactor = Math.max(FRICTION_BASE - speed * 0.0001, 0.995);
      angularVelocity.current *= frictionFactor;

      if (Math.abs(angularVelocity.current) < 0.05) {
        angularVelocity.current = 0;
      }

      groupRef.current.rotation.y -= angularVelocity.current * delta;
      const currentRotation = groupRef.current.rotation.y;
      const deltaRotation = currentRotation - lastRotation.current;
      accumulatedRotation.current += deltaRotation;

      if (Math.abs(accumulatedRotation.current) >= FULL_ROTATION) {
        const completeRotations = Math.floor(
          Math.abs(accumulatedRotation.current) / FULL_ROTATION,
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

export default InteractiveSpinner;
