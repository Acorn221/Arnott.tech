/* eslint-disable no-param-reassign */
import { FC, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GroupProps } from '@react-three/fiber';

import { createMaterials } from './materials';
import { createPartOverrides } from './reel-config';
import { createHandlePivot } from './utils/create-handle-pivot';
import { createSpinnerPivots } from './utils/create-spinner-pivots';

interface SlotMachineModelProps extends GroupProps {
  onHandleRef?: (pivot: THREE.Object3D | null) => void;
  onSpinnersRef?: (spinners: Record<string, THREE.Object3D>) => void;
}

const getPartName = (object: THREE.Object3D): string | null => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      current.name
      && !current.name.includes('Part')
      && !current.name.startsWith('mesh')
      && !current.name.includes('occurrence')
    ) {
      return current.name;
    }
    current = current.parent;
  }
  return null;
};

const SlotMachineModel: FC<SlotMachineModelProps> = ({ onHandleRef, onSpinnersRef, ...props }) => {
  const materials = useRef(createMaterials());
  const partOverrides = useRef(createPartOverrides());
  const groupRef = useRef<THREE.Group>(null);
  const handlePivotRef = useRef<THREE.Group | null>(null);
  const spinnerPivotsRef = useRef<Record<string, THREE.Object3D>>({});
  const { scene } = useGLTF('/tech-stack-slot-machine.gltf');

  useEffect(() => {
    const customMaterials = materials.current;
    const overrides = partOverrides.current;

    // Debug: Log all part names to help identify display plate
    const partNames = new Set<string>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const name = getPartName(object);
        if (name) partNames.add(name);
      }
    });
    console.log('Slot Machine Parts:', Array.from(partNames));

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materialKey = object.material.name;
        const partName = getPartName(object);

        object.userData.materialKey = materialKey;
        object.userData.partName = partName;

        // @ts-ignore
        if (partName && overrides[partName]) {
          // @ts-ignore
          object.material = overrides[partName];
        // @ts-ignore
        } else if (customMaterials[materialKey]) {
          // @ts-ignore
          object.material = customMaterials[materialKey];
        }

        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (handlePivotRef.current) {
      if (onHandleRef) onHandleRef(handlePivotRef.current);
      return;
    }

    const pivot = createHandlePivot(scene);
    if (pivot) {
      handlePivotRef.current = pivot;
      if (onHandleRef) onHandleRef(pivot);
    }
  }, [scene, onHandleRef]);

  useEffect(() => {
    if (Object.keys(spinnerPivotsRef.current).length > 0) {
      if (onSpinnersRef) onSpinnersRef(spinnerPivotsRef.current);
      return;
    }

    const pivots = createSpinnerPivots(scene);
    spinnerPivotsRef.current = pivots;
    if (onSpinnersRef) onSpinnersRef(pivots);
  }, [scene, onSpinnersRef]);

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={scene} {...props} />
    </group>
  );
};

export default SlotMachineModel;

useGLTF.preload('/tech-stack-slot-machine.gltf');
