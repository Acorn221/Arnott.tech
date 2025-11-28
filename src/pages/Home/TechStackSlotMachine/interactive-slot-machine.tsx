import {
  FC,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import * as THREE from 'three';
import { Group } from 'three';
import { GroupProps, useFrame, useThree } from '@react-three/fiber';
import SlotMachineModel from './slot-machine-model';

interface InteractiveSlotMachineProps extends GroupProps {
  scale: number;
  position: [number, number, number];
}

// Handle rotation constants
const MAX_HANDLE_ROTATION = Math.PI * 0.4; // ~72 degrees max pull
const SPRING_BACK_SPEED = 4; // How fast it springs back

const InteractiveSlotMachine: FC<InteractiveSlotMachineProps> = ({
  scale,
  position,
  ...props
}) => {
  const groupRef = useRef<Group>(null);
  const [isXray, setIsXray] = useState(false);

  // Handle state
  const handleRef = useRef<THREE.Object3D | null>(null);
  const handleRotation = useRef(0); // Current rotation
  const targetRotation = useRef(0); // Target rotation (0 when released)
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartRotation = useRef(0);

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
        targetRotation.current = 0; // Spring back to 0
        gl.domElement.style.cursor = 'auto';
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl]);

  // X-ray toggle
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'x') {
        setIsXray((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Animation frame - apply rotation and spring back
  useFrame((_, delta) => {
    if (!handleRef.current) return;

    // Spring back when not dragging
    if (!isDragging.current && handleRotation.current > 0) {
      handleRotation.current = Math.max(
        0,
        handleRotation.current - delta * SPRING_BACK_SPEED,
      );
    }

    // Apply rotation around the pivot point (X axis in local space)
    // The handle rotates around its attachment point
    handleRef.current.rotation.x = handleRotation.current;
  });

  return (
    <group
      ref={groupRef}
      scale={scale}
      position={position}
      onPointerDown={handlePointerDown}
      {...props}
    >
      <SlotMachineModel isXray={isXray} onHandleRef={onHandleRef} />
    </group>
  );
};

export default InteractiveSlotMachine;
