import {
  FC,
  useRef,
} from 'react';
import { Group } from 'three';
import { GroupProps } from '@react-three/fiber';
import SlotMachineModel from './slot-machine-model';
import { useSlotMachineHandle } from './useSlotMachineHandle';
import { useSlotMachineGame } from './useSlotMachineGame';

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
  const { startGame, onSpinnersRef } = useSlotMachineGame();
  const { onHandleRef, handlePointerDown } = useSlotMachineHandle({
    onTrigger: startGame,
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
