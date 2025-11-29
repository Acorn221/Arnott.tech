import { FC, useRef, useCallback } from 'react';
import { Group } from 'three';
import { useFrame, ThreeElements, useThree } from '@react-three/fiber';

import { SlotMachineProvider, useSlotMachine } from './SlotMachineContext';
import SlotMachineModel from './slot-machine-model';
import { useSlotMachineHandle } from './useSlotMachineHandle';

// Rumble configuration
const RUMBLE_DURATION = 0.5;
const RUMBLE_INTENSITY = 0.02;
const RUMBLE_FREQUENCY = 6;

type SlotMachineSceneProps = {
  scale: number;
  position: [number, number, number];
};

/** Inner component that uses the context */
const SlotMachineScene: FC<SlotMachineSceneProps> = ({ scale, position }) => {
  const groupRef = useRef<Group>(null);
  const { startGame, isSpinningRef } = useSlotMachine();
  const { gl } = useThree();

  // Rumble state
  const rumbleTimeRef = useRef(0);
  const isRumblingRef = useRef(false);
  const basePosition = useRef<[number, number, number]>(position);

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

  // Rumble animation and cursor management
  useFrame((_, delta) => {
    // Reset cursor if spinning
    if (isSpinningRef.current && gl.domElement.style.cursor === 'grab') {
      gl.domElement.style.cursor = 'auto';
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
    >
      <SlotMachineModel />
    </group>
  );
};

/** Main exported component with provider wrapper */
type InteractiveSlotMachineProps = ThreeElements['group'] & {
  scale: number;
  position: [number, number, number];
};

const InteractiveSlotMachine: FC<InteractiveSlotMachineProps> = ({
  scale,
  position,
  ...props
}) => (
  <SlotMachineProvider>
    <SlotMachineScene scale={scale} position={position} {...props} />
  </SlotMachineProvider>
);

export default InteractiveSlotMachine;
