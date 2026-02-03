import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect,useRef } from "react";
import * as THREE from "three";

interface SpinnerModelProps {
  isXray: boolean;
  rgbLevel?: number;
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

export const SpinnerModel = ({
  isXray,
  rgbLevel = 0,
  ...props
}: SpinnerModelProps) => {
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
  }, [isXray, scene]);

  // Apply slight offset animation (synced across tabs via Date.now)
  useFrame(() => {
    if (groupRef.current) {
      const time = Date.now() / 1000; // Convert ms to seconds for sync across tabs
      const offsetX = Math.sin(time * WOBBLE_FREQUENCY) * MAX_WOBBLE_OFFSET;
      const offsetY = -Math.cos(time * WOBBLE_FREQUENCY) * MAX_WOBBLE_OFFSET;

      groupRef.current.rotation.z = offsetY;
      groupRef.current.rotation.x = offsetX;
    }

    // RGB mode animation
    const mainBodyMaterial = materials.current["1.000000_0.000000_0.000000_0.000000_0.000000"];
    if (mainBodyMaterial && !isXray) {
      if (rgbLevel > 0) {
        const speed = rgbLevel * 0.5; // Speed increases with level
        const hue = (Date.now() / 1000 * speed) % 1;
        mainBodyMaterial.color.setHSL(hue, 1, 0.5);
      } else {
        // Reset to original red when RGB is off
        mainBodyMaterial.color.setHex(0xff0000);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} {...props} />
    </group>
  );
};

useGLTF.preload("/fidget-spinner.gltf");
