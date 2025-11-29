import {
  FC,
  useRef,
  useCallback,
} from 'react';
import { Group } from 'three';
import { useFrame, ThreeElements } from '@react-three/fiber';
import SlotMachineModel from './slot-machine-model';
import { useSlotMachineHandle } from './useSlotMachineHandle';
import { useSlotMachineGame } from './useSlotMachineGame';

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
  const { startGame, onSpinnersRef } = useSlotMachineGame();

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
  });

  // Rumble animation
  useFrame((_, delta) => {
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
      {...props}
    >
      <SlotMachineModel onHandleRef={onHandleRef} onSpinnersRef={onSpinnersRef} />
    </group>
  );
};

export default InteractiveSlotMachine;
