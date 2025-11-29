import { FC, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { useSlotMachine } from './SlotMachineContext';
import { createMaterials, MaterialMap, GltfMaterialKey } from './materials';
import { createPartOverrides, PartOverrideMap, PartName, PartOverridesResult } from './reel-config';
import { createHandlePivot } from './utils/create-handle-pivot';
import { createSpinnerPivots } from './utils/create-spinner-pivots';

/** Walks up the scene graph to find the named part this mesh belongs to */
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

/** Checks if a string is a valid GLTF material key */
const isGltfMaterialKey = (key: string, materials: MaterialMap): key is GltfMaterialKey => key in materials;

/** Checks if a string is a valid part name */
const isPartName = (name: string, overrides: PartOverrideMap): name is PartName => name in overrides;

const SlotMachineModel: FC = () => {
  const { setHandlePivot, setSpinners, setKnobMaterial } = useSlotMachine();

  const materialsRef = useRef<MaterialMap | null>(null);
  const overridesRef = useRef<PartOverridesResult | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const handlePivotRef = useRef<THREE.Group | null>(null);
  const spinnerPivotsRef = useRef<Record<string, THREE.Object3D> | null>(null);
  const hasInitializedMaterials = useRef(false);

  const { scene } = useGLTF('/tech-stack-slot-machine.gltf');

  // Initialize materials and apply to meshes (runs once)
  useEffect(() => {
    if (hasInitializedMaterials.current) return;

    // Create materials once
    if (!materialsRef.current) {
      materialsRef.current = createMaterials();
    }
    if (!overridesRef.current) {
      overridesRef.current = createPartOverrides();
      setKnobMaterial(overridesRef.current.knobMaterial);
    }

    const materials = materialsRef.current;
    const { materials: partOverrides } = overridesRef.current;

    // Apply materials to meshes
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const materialKey = object.material.name;
      const partName = getPartName(object);

      object.userData.materialKey = materialKey;
      object.userData.partName = partName;

      if (partName && isPartName(partName, partOverrides)) {
        object.material = partOverrides[partName];
      } else if (isGltfMaterialKey(materialKey, materials)) {
        object.material = materials[materialKey];
      }

      object.castShadow = true;
      object.receiveShadow = true;
    });

    hasInitializedMaterials.current = true;
  }, [scene, setKnobMaterial]);

  // Create handle pivot (runs once, with guard)
  useEffect(() => {
    // Skip if already created
    if (handlePivotRef.current) {
      setHandlePivot(handlePivotRef.current);
      return;
    }

    // Check if pivot already exists in scene (from previous render)
    let existingPivot: THREE.Object3D | null = null;
    scene.traverse((obj) => {
      if (obj.name === 'handle-pivot') {
        existingPivot = obj;
      }
    });

    if (existingPivot) {
      handlePivotRef.current = existingPivot as THREE.Group;
      setHandlePivot(existingPivot);
      return;
    }

    // Create new pivot
    const pivot = createHandlePivot(scene);
    if (pivot) {
      handlePivotRef.current = pivot;
      setHandlePivot(pivot);
    }
  }, [scene, setHandlePivot]);

  // Create spinner pivots (runs once, with guard)
  useEffect(() => {
    // Skip if already created
    if (spinnerPivotsRef.current) {
      setSpinners(spinnerPivotsRef.current);
      return;
    }

    // Check if pivots already exist
    const existingPivots: Record<string, THREE.Object3D> = {};
    scene.traverse((obj) => {
      if (obj.name.match(/^slot-spinner-\d+-pivot$/)) {
        const spinnerName = obj.name.replace('-pivot', '');
        existingPivots[spinnerName] = obj;
      }
    });

    if (Object.keys(existingPivots).length > 0) {
      spinnerPivotsRef.current = existingPivots;
      setSpinners(existingPivots);
      return;
    }

    // Create new pivots
    const pivots = createSpinnerPivots(scene);
    spinnerPivotsRef.current = pivots;
    setSpinners(pivots);
  }, [scene, setSpinners]);

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={scene} />
    </group>
  );
};

export default SlotMachineModel;

useGLTF.preload('/tech-stack-slot-machine.gltf');
