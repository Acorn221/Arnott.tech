/* eslint-disable no-param-reassign */
import { FC, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GroupProps, useFrame } from '@react-three/fiber';

interface SlotMachineModelProps extends GroupProps {
  isXray: boolean;
}

const createMaterials = () => ({
  // Yellowish - Lights/Accents -> Gold/Brass
  '0.980392_0.713725_0.003922_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FFD700'),
      metalness: 1.0,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    }),
  // White/Grey - Casing? -> Sleek White/Silver
  '0.917647_0.917647_0.917647_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#F5F5F5'),
      metalness: 0.5,
      roughness: 0.2,
      clearcoat: 0.5,
    }),
  // Grey - Metal parts? -> Darker Metal
  '0.498039_0.498039_0.498039_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#4a4a4a'),
      metalness: 0.8,
      roughness: 0.4,
    }),
  // Light Blue - Glass/Screen? -> Clear Glass
  '0.615686_0.811765_0.929412_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.95, // High transmission for glass
      thickness: 0.5, // Refraction
      transparent: true,
      opacity: 0.3,
    }),
  // Blue - Buttons/Accents -> Emissive Blue
  '0.231373_0.380392_0.705882_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#4169E1'),
      metalness: 0.1,
      roughness: 0.2,
      emissive: new THREE.Color('#4169E1'),
      emissiveIntensity: 0.5,
    }),
  // Very Light Blue -> Chrome/Silver details
  '0.768627_0.886275_0.952941_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#E0F7FA'),
      metalness: 0.9,
      roughness: 0.1,
    }),
  // Grey -> Matte Grey
  '0.647059_0.647059_0.647059_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#A9A9A9'),
      metalness: 0.4,
      roughness: 0.7,
    }),
  // Orange - Lights/Accents -> Emissive Orange
  '0.972549_0.529412_0.003922_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FFA500'),
      metalness: 0.1,
      roughness: 0.2,
      emissive: new THREE.Color('#FFA500'),
      emissiveIntensity: 0.8,
    }),
});

const SlotMachineModel: FC<SlotMachineModelProps> = ({ isXray, ...props }) => {
  const materials = useRef(createMaterials());
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/tech-stack-slot-machine.gltf');

  // Initialize materials
  useEffect(() => {
    const customMaterials = createMaterials();
    materials.current = customMaterials;
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // console.log('Material Name:', object.material.name);
        object.userData.materialKey = object.material.name;
        const materialKey = object.material.name;
        // @ts-ignore - materialKey is fine
        if (customMaterials[materialKey]) {
          // @ts-ignore - materialKey is fine
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
            color: new THREE.Color('#bdc5c3'),
            transparent: true,
            opacity: 0.7,
          });
        } else {
          const { materialKey } = object.userData;
          // @ts-ignore - materialKey is fine
          const originalMaterial = materials.current[materialKey];
          if (originalMaterial) {
            object.material = originalMaterial;
            object.castShadow = true;
            object.receiveShadow = true;
          }
        }
      }
    });
  }, [isXray]);

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={scene} {...props} />
    </group>
  );
};

export default SlotMachineModel;

useGLTF.preload('/tech-stack-slot-machine.gltf');
