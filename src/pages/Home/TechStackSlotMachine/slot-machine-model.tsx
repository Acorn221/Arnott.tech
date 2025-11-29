/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { type FC, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { useSlotMachine } from './SlotMachineContext';
import { createMaterials, type MaterialMap, type GltfMaterialKey } from './materials';
import { createStaticPartOverrides, type StaticPartOverrideMap, type StaticPartName, type StaticPartOverridesResult } from './reel-config';
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

/** Checks if a string is a valid static part name */
const isStaticPartName = (name: string, overrides: StaticPartOverrideMap): name is StaticPartName => name in overrides;

/** Spinner part names */
const SPINNER_PART_NAMES = ['slot-spinner-1', 'slot-spinner-2', 'slot-spinner-3'];

const SlotMachineModel: FC = () => {
  const {
    setHandlePivot,
    setSpinners,
    setKnobMaterial,
    setDisplayPlate,
    setIndicatorMaterials,
    reelManagersRef,
    isInitialized,
  } = useSlotMachine();

  const materialsRef = useRef<MaterialMap | null>(null);
  const staticOverridesRef = useRef<StaticPartOverridesResult | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const handlePivotRef = useRef<THREE.Group | null>(null);
  const spinnerPivotsRef = useRef<Record<string, THREE.Object3D> | null>(null);
  const hasInitializedMaterials = useRef(false);

  const { scene } = useGLTF('/tech-stack-slot-machine.gltf');

  // Initialize static materials (non-spinner parts)
  useEffect(() => {
    if (hasInitializedMaterials.current) return;

    // Create materials once
    if (!materialsRef.current) {
      materialsRef.current = createMaterials();
    }
    if (!staticOverridesRef.current) {
      staticOverridesRef.current = createStaticPartOverrides();
      setKnobMaterial(staticOverridesRef.current.knobMaterial);
      setDisplayPlate(staticOverridesRef.current.displayPlate);
      setIndicatorMaterials(staticOverridesRef.current.indicatorMaterials);
    }

    const materials = materialsRef.current;
    const { overrides: staticOverrides } = staticOverridesRef.current;

    // Apply materials to non-spinner meshes
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const materialKey = object.material.name as GltfMaterialKey;
      const partName = getPartName(object);

      object.userData.materialKey = materialKey;
      object.userData.partName = partName;

      // Skip spinner parts - they get dynamic textures
      if (partName && SPINNER_PART_NAMES.includes(partName)) {
        return;
      }

      // Apply static override or base material
      if (partName && isStaticPartName(partName, staticOverrides)) {
        object.material = staticOverrides[partName];
      } else if (isGltfMaterialKey(materialKey, materials)) {
        object.material = materials[materialKey];
      }

      object.castShadow = true;
      object.receiveShadow = true;
    });

    hasInitializedMaterials.current = true;
  }, [scene, setKnobMaterial, setDisplayPlate, setIndicatorMaterials]);

  // Apply dynamic reel textures when initialized
  useEffect(() => {
    if (!isInitialized || !reelManagersRef.current) return;

    const managers = reelManagersRef.current;

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const partName = getPartName(object);

      // Apply dynamic textures to spinners
      if (partName === 'slot-spinner-1' && managers[0]) {
        object.material = managers[0].material;
      } else if (partName === 'slot-spinner-2' && managers[1]) {
        object.material = managers[1].material;
      } else if (partName === 'slot-spinner-3' && managers[2]) {
        object.material = managers[2].material;
      }
    });
  }, [scene, isInitialized, reelManagersRef]);

  // Create handle pivot
  useEffect(() => {
    if (handlePivotRef.current) {
      setHandlePivot(handlePivotRef.current);
      return;
    }

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

    const pivot = createHandlePivot(scene);
    if (pivot) {
      handlePivotRef.current = pivot;
      setHandlePivot(pivot);
    }
  }, [scene, setHandlePivot]);

  // Create spinner pivots
  useEffect(() => {
    if (spinnerPivotsRef.current) {
      setSpinners(spinnerPivotsRef.current);
      return;
    }

    const existingPivots: Record<string, THREE.Object3D> = {};
    scene.traverse((obj) => {
      if (/^slot-spinner-\d+-pivot$/.exec(obj.name)) {
        const spinnerName = obj.name.replace('-pivot', '');
        existingPivots[spinnerName] = obj;
      }
    });

    if (Object.keys(existingPivots).length > 0) {
      spinnerPivotsRef.current = existingPivots;
      setSpinners(existingPivots);
      return;
    }

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
