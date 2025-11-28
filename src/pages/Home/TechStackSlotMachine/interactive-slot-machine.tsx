import {
  FC,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Group } from 'three';
import { GroupProps } from '@react-three/fiber';
import SlotMachineModel from './slot-machine-model';

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
  const [isXray, setIsXray] = useState(false);

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

  return (
    <group
      ref={groupRef}
      scale={scale}
      position={position}
      {...props}
    >
      <SlotMachineModel isXray={isXray} />
    </group>
  );
};

export default InteractiveSlotMachine;
