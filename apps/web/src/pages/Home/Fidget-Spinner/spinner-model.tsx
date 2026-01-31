/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { type FC, useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { type GltfMaterialKey } from "../TechStackSlotMachine/materials";

interface SpinnerModelProps {
  isXray: boolean;
}

const createMaterials = () => ({
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
        object.userData.materialKey = object.material.name as GltfMaterialKey;
        const materialKey = object.material.name as GltfMaterialKey;
        // @ts-expect-error - materialKey is fine
        if (customMaterials[materialKey]) {
          // @ts-expect-error - materialKey is fine
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
          const { materialKey } = object.userData;
          // @ts-expect-error - materialKey is fine
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const originalMaterial = materials.current[materialKey];
          if (originalMaterial) {
            object.material = originalMaterial as THREE.MeshPhysicalMaterial;
            object.castShadow = true;
            object.receiveShadow = true;
          }
        }
      }
    });
  }, [isXray]);

  // Apply slight offset animation
  useFrame((state) => {
    if (groupRef.current) {
      const maxOffset = 0.01; // Maximum offset in radians (about 3 degrees)
      const offsetX = Math.sin(state.clock.elapsedTime * 2) * maxOffset;
      const offsetY = -Math.cos(state.clock.elapsedTime * 2) * maxOffset;

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
