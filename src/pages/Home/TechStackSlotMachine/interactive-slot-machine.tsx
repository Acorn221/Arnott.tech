import {
  FC,
  useRef,
  useCallback,
} from 'react';
import { Group } from 'three';
import { GroupProps, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SlotMachineModel from './slot-machine-model';
import { useSlotMachineHandle } from './useSlotMachineHandle';

interface InteractiveSlotMachineProps extends GroupProps {
  scale: number;
  position: [number, number, number];
}

const InteractiveSlotMachine: FC<InteractiveSlotMachineProps> = ({
  scale,
  position,
  ...props
}) => {
  const groupRef = useRef<Group>(null);
  const { onHandleRef, handlePointerDown, isDragging } = useSlotMachineHandle();
  const spinnersRef = useRef<Record<string, THREE.Object3D>>({});

  const onSpinnersRef = useCallback((spinners: Record<string, THREE.Object3D>) => {
    spinnersRef.current = spinners;
  }, []);

  useFrame((state, delta) => {
    Object.values(spinnersRef.current).forEach((spinner, i) => {
      // Spin along X axis (since we set up pivots)
      // eslint-disable-next-line no-param-reassign
      spinner.rotation.x -= delta * (2 + i * 0.5);
    });
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
