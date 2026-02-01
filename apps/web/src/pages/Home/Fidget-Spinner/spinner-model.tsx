import { type FC, useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface SpinnerModelProps {
  isXray: boolean;
}

/** Maximum wobble offset in radians (about 0.5 degrees) */
const MAX_WOBBLE_OFFSET = 0.01;
/** Wobble animation frequency multiplier */
const WOBBLE_FREQUENCY = 2;

/** Material keys from the fidget spinner GLTF model (based on vertex colors) */
type SpinnerMaterialKey =
  | "0.000000_0.000000_0.000000_0.000000_0.000000" // Amoungi + Text
  | "0.647059_0.647059_0.647059_0.000000_0.000000" // Bearing casing
  | "0.000000_0.000000_1.000000_0.000000_0.000000" // Bearing Seal
  | "1.000000_0.000000_0.000000_0.000000_0.000000"; // Main body

type SpinnerMaterialMap = Record<SpinnerMaterialKey, THREE.MeshPhysicalMaterial>;

const isSpinnerMaterialKey = (
  key: string,
  materials: SpinnerMaterialMap,
): key is SpinnerMaterialKey => key in materials;

/** Safely extracts material name from a mesh (handles single material only) */
const getMaterialName = (object: THREE.Object3D): string | null => {
  if (!(object instanceof THREE.Mesh)) return null;
  const material: unknown = object.material;
  if (
    material &&
    typeof material === "object" &&
    "name" in material &&
    typeof material.name === "string"
  ) {
    return material.name;
  }
  return null;
};

const createMaterials = (): SpinnerMaterialMap => ({
  // Amoungi + Text
  "0.000000_0.000000_0.000000_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#FFFFFF"),
    }),
  // Bearing casing
  "0.647059_0.647059_0.647059_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#e8e8e8"),
      metalness: 1.0,
      roughness: 0.05,
      envMapIntensity: 1.5,
      clearcoat: 1.0,

      clearcoatRoughness: 0.03,
    }),
  // Bearing Seal
  "0.000000_0.000000_1.000000_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0000FF"),
      roughness: 0.3,
      envMapIntensity: 0.8,
    }),
  // Main body of the spinner
  "1.000000_0.000000_0.000000_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#FF0000"),
      metalness: 0.7,
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    }),
});

const SpinnerModel: FC<SpinnerModelProps> = ({ isXray, ...props }) => {
  const materials = useRef(createMaterials());
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/fidget-spinner.gltf");

  // Initialize materials
  useEffect(() => {
    const customMaterials = createMaterials();
    materials.current = customMaterials;
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materialKey = getMaterialName(object);
        if (materialKey && isSpinnerMaterialKey(materialKey, customMaterials)) {
          object.userData.materialKey = materialKey;
          object.material = customMaterials[materialKey];
          object.castShadow = true;
          object.receiveShadow = true;
        }
      }
    });
  }, [scene]);

  // Handle xray mode changes
  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (isXray) {
          object.material = new THREE.MeshPhysicalMaterial({
            wireframe: true,
            color: new THREE.Color("#bdc5c3"),
            transparent: true,
            opacity: 0.7,
          });
        } else {
          const materialKey: unknown = object.userData.materialKey;
          if (
            typeof materialKey === "string" &&
            isSpinnerMaterialKey(materialKey, materials.current)
          ) {
            object.material = materials.current[materialKey];
            object.castShadow = true;
            object.receiveShadow = true;
          }
        }
      }
    });
  }, [isXray]);

  // Apply slight offset animation (synced across tabs via Date.now)
  useFrame(() => {
    if (groupRef.current) {
      const time = Date.now() / 1000; // Convert ms to seconds for sync across tabs
      const offsetX = Math.sin(time * WOBBLE_FREQUENCY) * MAX_WOBBLE_OFFSET;
      const offsetY = -Math.cos(time * WOBBLE_FREQUENCY) * MAX_WOBBLE_OFFSET;

      groupRef.current.rotation.z = offsetY;
      groupRef.current.rotation.x = offsetX;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} {...props} />
    </group>
  );
};

export default SpinnerModel;

useGLTF.preload("/fidget-spinner.gltf");
