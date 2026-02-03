import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { useSlotMachine } from "./SlotMachineContext";
import {
  createMaterials,
  type MaterialMap,
  type GltfMaterialKey,
} from "./materials";
import {
  createStaticPartOverrides,
  type StaticPartOverrideMap,
  type StaticPartName,
  type StaticPartOverridesResult,
} from "./reel-config";
import { createHandlePivot } from "./utils/create-handle-pivot";
import { createSpinnerPivots } from "./utils/create-spinner-pivots";

/** Walks up the scene graph to find the named part this mesh belongs to */
const getPartName = (object: THREE.Object3D): string | null => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      current.name &&
      !current.name.includes("Part") &&
      !current.name.startsWith("mesh") &&
      !current.name.includes("occurrence")
    ) {
      return current.name;
    }
    current = current.parent;
  }
  return null;
};

/** Checks if a string is a valid GLTF material key */
const isGltfMaterialKey = (
  key: string,
  materials: MaterialMap,
): key is GltfMaterialKey => key in materials;

/** Checks if a string is a valid static part name */
const isStaticPartName = (
  name: string,
  overrides: StaticPartOverrideMap,
): name is StaticPartName => name in overrides;

/** Spinner part names (old style) */
const SPINNER_PART_NAMES = [
  "slot-spinner-1",
  "slot-spinner-2",
  "slot-spinner-3",
];

/** Regex to match individual face groups: reel-[1-3]-face-[1-8] (exact match, no occurrence_ prefix) */
const REEL_FACE_REGEX = /^reel-(\d+)-face-(\d+)$/;

export const SlotMachineModel = () => {
  const {
    setHandlePivot,
    setSpinners,
    setKnobMaterial,
    setDisplayPlate,
    setIndicatorMaterials,
    setFaceplateMaterial,
    setReelFaceObjects,
    setShareButton,
    setShareButtonMaterial,
    setSpinButton,
    setSpinButtonMaterial,
    reelManagersRef,
    isInitialized,
  } = useSlotMachine();

  const materialsRef = useRef<MaterialMap | null>(null);
  const staticOverridesRef = useRef<StaticPartOverridesResult | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const handlePivotRef = useRef<THREE.Group | null>(null);
  const spinnerPivotsRef = useRef<Record<string, THREE.Object3D> | null>(null);
  const hasInitializedMaterials = useRef(false);

  const { scene } = useGLTF("/tech-stack-slot-machine.gltf");

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
      setSpinButtonMaterial(staticOverridesRef.current.spinButtonMaterial);
      setShareButtonMaterial(staticOverridesRef.current.shareButtonMaterial);
      setFaceplateMaterial(staticOverridesRef.current.faceplateMaterial);
    }

    const materials = materialsRef.current;
    const { overrides: staticOverrides } = staticOverridesRef.current;

    // Apply materials to non-spinner meshes
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const material = (
        Array.isArray(object.material) ? object.material[0] : object.material
      ) as THREE.Material | undefined;
      const materialKey = material?.name as GltfMaterialKey;
      const partName = getPartName(object);

      object.userData.materialKey = materialKey;
      object.userData.partName = partName;

      // Skip spinner parts - they get dynamic textures
      if (partName && SPINNER_PART_NAMES.includes(partName)) {
        return;
      }

      // Skip individual reel faces - they get dynamic textures
      // Check if this mesh is inside a reel face group
      let isReelFace = false;
      let parent = object.parent;
      while (parent) {
        if (REEL_FACE_REGEX.test(parent.name)) {
          isReelFace = true;
          break;
        }
        parent = parent.parent;
      }
      if (isReelFace) return;

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
  }, [
    scene,
    setKnobMaterial,
    setDisplayPlate,
    setIndicatorMaterials,
    setSpinButtonMaterial,
    setShareButtonMaterial,
    setFaceplateMaterial,
  ]);

  // Apply dynamic reel textures when initialized
  useEffect(() => {
    if (!isInitialized || !reelManagersRef.current) return;

    const managers = reelManagersRef.current;

    // Collect face objects for each reel (for position-based detection)
    const reelFaces = new Map<number, Map<number, THREE.Object3D>>();

    // Simple approach: assign materials based on face number directly
    scene.traverse((object) => {
      const match = REEL_FACE_REGEX.exec(object.name);
      if (!match) return;

      const reelIndex = parseInt(match[1], 10) - 1; // 0-indexed
      const faceNum = parseInt(match[2], 10) - 1; // 0-indexed (face-1 -> 0)
      const manager = managers[reelIndex];

      if (!manager?.faces[faceNum]) return;

      // Store reference to face object for position detection
      if (!reelFaces.has(reelIndex)) {
        reelFaces.set(reelIndex, new Map());
      }
      reelFaces.get(reelIndex)!.set(faceNum, object);

      // Apply material to child meshes
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = manager.faces[faceNum].material;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    });

    // Store face object refs in context
    reelFaces.forEach((faces, reelIndex) => {
      setReelFaceObjects(reelIndex, faces);
    });
  }, [scene, isInitialized, reelManagersRef, setReelFaceObjects]);

  // Create handle pivot and add larger hit area for mobile
  useEffect(() => {
    if (handlePivotRef.current) {
      setHandlePivot(handlePivotRef.current);
      return;
    }

    let existingPivot: THREE.Object3D | null = null;
    scene.traverse((obj) => {
      if (obj.name === "handle-pivot") {
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
      // Add invisible hit area for easier mobile dragging
      const handleKnob = pivot.getObjectByName("handle-knob");
      if (handleKnob && !handleKnob.getObjectByName("handle-hitarea")) {
        const hitGeometry = new THREE.SphereGeometry(0.022, 8, 8); // ~3x knob size - easier to grab
        const hitMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
        hitMesh.name = "handle-hitarea";
        handleKnob.add(hitMesh);
      }

      handlePivotRef.current = pivot;
      setHandlePivot(pivot);
    }
  }, [scene, setHandlePivot]);

  // Find buttons and add larger hit areas for mobile
  useEffect(() => {
    let spinButton: THREE.Object3D | null = null;
    let shareButton: THREE.Object3D | null = null;
    scene.traverse((obj) => {
      if (obj.name === "button-1-body") {
        spinButton = obj;
      } else if (obj.name === "button-2-body") {
        shareButton = obj;
      }
    });

    // Add invisible hit areas for easier mobile tapping
    const addHitArea = (button: THREE.Object3D, name: string) => {
      // Check if hit area already exists
      if (button.getObjectByName(`${name}-hitarea`)) return;

      const hitGeometry = new THREE.SphereGeometry(0.018, 8, 8); // ~4x button size - good for mobile
      const hitMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
      hitMesh.name = `${name}-hitarea`;
      button.add(hitMesh);
    };

    if (spinButton) {
      addHitArea(spinButton, "button-1");
      setSpinButton(spinButton);
    }
    if (shareButton) {
      addHitArea(shareButton, "button-2");
      setShareButton(shareButton);
    }
  }, [scene, setSpinButton, setShareButton]);

  // Create spinner pivots
  useEffect(() => {
    if (spinnerPivotsRef.current) {
      setSpinners(spinnerPivotsRef.current);
      return;
    }

    const existingPivots: Record<string, THREE.Object3D> = {};
    scene.traverse((obj) => {
      if (/^slot-spinner-\d+-pivot$/.exec(obj.name)) {
        const spinnerName = obj.name.replace("-pivot", "");
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

useGLTF.preload("/tech-stack-slot-machine.gltf");
