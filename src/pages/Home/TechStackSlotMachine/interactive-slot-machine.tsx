import {
  FC,
  useRef,
  useCallback,
} from 'react';
import { Group } from 'three';
import { useFrame, ThreeElements, useThree } from '@react-three/fiber';
import SlotMachineModel from './slot-machine-model';
import { useSlotMachineHandle } from './useSlotMachineHandle';
import { useSlotMachineGame } from './useSlotMachineGame';
import { getHandleKnobAnimatedMaterial } from './reel-config';

// Rumble configuration
const RUMBLE_DURATION = 0.5; // Duration in seconds
const RUMBLE_INTENSITY = 0.02; // Maximum displacement
const RUMBLE_FREQUENCY = 6; // Shake frequency

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
  const { startGame, onSpinnersRef, isSpinningRef } = useSlotMachineGame();
  const { gl } = useThree();
  const prevSpinningState = useRef(false);

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

  const { onHandleRef, handlePointerDown } = useSlotMachineHandle({
    onTrigger: handleTrigger,
    isDisabledRef: isSpinningRef,
  });

  // Handle pointer over for cursor
  const handlePointerOver = useCallback((event: { object: { name: string; parent: { name: string; parent: unknown } | null } }) => {
    if (isSpinningRef.current) return;

    let current: { name: string; parent: unknown } | null = event.object;

    while (current) {
      if (current.name === 'handle-knob' || current.name === 'handle-body') {
        gl.domElement.style.cursor = 'grab';
        return;
      }
      current = current.parent as { name: string; parent: unknown } | null;
    }
  }, [gl, isSpinningRef]);

  const handlePointerOut = useCallback(() => {
    gl.domElement.style.cursor = 'auto';
  }, [gl]);

  // Rumble animation and knob glow control
  useFrame((_, delta) => {
    // Control knob glow based on spinning state changes
    const knobMaterial = getHandleKnobAnimatedMaterial();
    if (knobMaterial && prevSpinningState.current !== isSpinningRef.current) {
      knobMaterial.setPaused(isSpinningRef.current);
      prevSpinningState.current = isSpinningRef.current;
    }

    // Reset cursor to auto if spinning and cursor is grab
    if (isSpinningRef.current && gl.domElement.style.cursor === 'grab') {
      gl.domElement.style.cursor = 'auto';
    }

    // Rumble animation
    if (!groupRef.current || !isRumblingRef.current) return;

    rumbleTimeRef.current += delta;

    if (rumbleTimeRef.current >= RUMBLE_DURATION) {
      // Stop rumbling and reset position
      isRumblingRef.current = false;
      groupRef.current.position.set(...basePosition.current);
      groupRef.current.rotation.set(0, 0, 0);
      return;
    }

    // Calculate intensity with slow -> fast -> slow curve (bell curve)
    const progress = rumbleTimeRef.current / RUMBLE_DURATION;

    // Sin curve: 0 -> 1 -> 0 over the duration (peaks at 50%)
    const bellCurve = Math.sin(progress * Math.PI);

    // High-frequency shake with bell curve intensity
    const time = rumbleTimeRef.current * RUMBLE_FREQUENCY;
    const intensity = RUMBLE_INTENSITY * bellCurve;

    // Offset position with smooth shake pattern
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
      <SlotMachineModel
        onHandleRef={onHandleRef}
        onSpinnersRef={onSpinnersRef}
      />
    </group>
  );
};

export default InteractiveSlotMachine;
