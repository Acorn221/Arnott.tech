import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

// Handle rotation constants
const MAX_HANDLE_ROTATION = Math.PI * 0.4; // ~72 degrees max pull
const SPRING_BACK_DURATION = 0.5; // Duration in seconds for spring back
const TRIGGER_THRESHOLD = 0.8; // 80% of max rotation triggers the game

// Ease-in-out cubic for smooth slow → fast → slow curve
const easeInOutCubic = (t: number): number => (t < 0.5
  ? 4 * t * t * t
  : 1 - (-2 * t + 2) ** 3 / 2);

interface UseSlotMachineHandleProps {
  onTrigger?: () => void;
}

export const useSlotMachineHandle = ({ onTrigger }: UseSlotMachineHandleProps = {}) => {
  const handleRef = useRef<THREE.Object3D | null>(null);
  const handleRotation = useRef(0); // Current rotation
  const targetRotation = useRef(0); // Target rotation (0 when released)
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartRotation = useRef(0);

  // Spring-back animation state
  const springBackStartRotation = useRef(0);
  const springBackProgress = useRef(0);
  const isSpringBackActive = useRef(false);

  const { gl } = useThree();

  // Callback to receive handle ref from model
  const onHandleRef = useCallback((handle: THREE.Object3D | null) => {
    handleRef.current = handle;
  }, []);

  // Pointer down - start dragging if we hit the handle
  const handlePointerDown = useCallback((event: THREE.Event) => {
    const e = event as unknown as { object: THREE.Object3D; clientY?: number; point?: THREE.Vector3 };
    let current: THREE.Object3D | null = e.object;

    // Check if we clicked on handle-knob or handle-body
    while (current) {
      if (current.name === 'handle-knob' || current.name === 'handle-body') {
        isDragging.current = true;
        // Get the Y position from the event
        const clientY = e.clientY ?? (e.point?.y ?? 0) * 100;
        dragStartY.current = clientY;
        dragStartRotation.current = handleRotation.current;
        gl.domElement.style.cursor = 'grabbing';
        event.stopPropagation(); // Prevent lower elements from catching it
        return;
      }
      current = current.parent;
    }
  }, [gl]);

  // Pointer move - update rotation while dragging
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging.current) return;

      const deltaY = event.clientY - dragStartY.current;
      // Pulling down (positive deltaY) = positive rotation
      const newRotation = dragStartRotation.current + deltaY * 0.005;
      // Clamp between 0 and max
      targetRotation.current = Math.max(0, Math.min(MAX_HANDLE_ROTATION, newRotation));
      handleRotation.current = targetRotation.current;
    };

    const onPointerUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        
        // Check trigger condition
        if (onTrigger && handleRotation.current > MAX_HANDLE_ROTATION * TRIGGER_THRESHOLD) {
          onTrigger();
        }

        targetRotation.current = 0; // Spring back to 0
        gl.domElement.style.cursor = 'auto';

        // Start spring-back animation
        if (handleRotation.current > 0) {
          springBackStartRotation.current = handleRotation.current;
          springBackProgress.current = 0;
          isSpringBackActive.current = true;
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, onTrigger]);

  // Animation frame - apply rotation and spring back
  useFrame((_, delta) => {
    if (!handleRef.current) return;

    // Spring back with ease-in-out curve when not dragging
    if (isSpringBackActive.current && !isDragging.current) {
      springBackProgress.current += delta / SPRING_BACK_DURATION;

      if (springBackProgress.current >= 1) {
        // Animation complete
        springBackProgress.current = 1;
        isSpringBackActive.current = false;
        handleRotation.current = 0;
      } else {
        // Apply eased interpolation: start → 0
        const easedProgress = easeInOutCubic(springBackProgress.current);
        handleRotation.current = springBackStartRotation.current * (1 - easedProgress);
      }
    }

    // Apply rotation around the pivot point (X axis in local space)
    // The handle rotates around its attachment point
    handleRef.current.rotation.x = handleRotation.current;
  });

  return {
    onHandleRef,
    handlePointerDown,
    isDragging: isDragging.current,
  };
};
