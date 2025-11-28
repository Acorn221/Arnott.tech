/* eslint-disable no-param-reassign */
import { FC, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GroupProps, useFrame } from '@react-three/fiber';

interface SlotMachineModelProps extends GroupProps {
  isXray: boolean;
}

const createMaterials = () => ({
  // Yellowish - Lights/Accents -> Rich Gold with strong glow
  '0.980392_0.713725_0.003922_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FFD700'),
      metalness: 1.0,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: new THREE.Color('#FFD700'),
      emissiveIntensity: 0.3,
    }),
  // White/Grey - Main Body -> Deep Cherry Red (classic slot machine)
  '0.917647_0.917647_0.917647_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#8B0000'),
      metalness: 0.3,
      roughness: 0.4,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    }),
  // Grey - Metal Frame -> Polished Chrome
  '0.498039_0.498039_0.498039_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#C0C0C0'),
      metalness: 1.0,
      roughness: 0.15,
      clearcoat: 0.5,
    }),
  // Light Blue - Glass/Screen -> Tinted Glass Display
  '0.615686_0.811765_0.929412_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1a1a2e'),
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.85,
      thickness: 0.5,
      transparent: true,
      opacity: 0.6,
      emissive: new THREE.Color('#00ff88'),
      emissiveIntensity: 0.15,
    }),
  // Blue - Buttons/Accents -> Neon Blue Buttons
  '0.231373_0.380392_0.705882_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#00BFFF'),
      metalness: 0.2,
      roughness: 0.1,
      emissive: new THREE.Color('#00BFFF'),
      emissiveIntensity: 0.8,
      clearcoat: 1.0,
    }),
  // Very Light Blue -> Brushed Steel Trim
  '0.768627_0.886275_0.952941_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#B8C4CE'),
      metalness: 0.95,
      roughness: 0.25,
    }),
  // Grey -> Dark Base/Stand
  '0.647059_0.647059_0.647059_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2a2a2a'),
      metalness: 0.6,
      roughness: 0.5,
    }),
  // Orange - Lights/Accents -> Bright Casino Orange Glow
  '0.972549_0.529412_0.003922_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FF4500'),
      metalness: 0.1,
      roughness: 0.1,
      emissive: new THREE.Color('#FF4500'),
      emissiveIntensity: 1.2,
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
