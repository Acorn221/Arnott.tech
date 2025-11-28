/* eslint-disable no-param-reassign */
import { FC, useRef, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GroupProps, useFrame } from '@react-three/fiber';

interface SpinnerModelProps extends GroupProps {
  isXray: boolean;
}

const createMaterials = () => ({
  // Amoungi + Text
  '0.000000_0.000000_0.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFFFFF'),
  }),
  // Bearing casing
  '0.647059_0.647059_0.647059_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8e8e8'),
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  }),
  // Bearing Seal
  '0.000000_0.000000_1.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0000FF'),
    roughness: 0.3,
    envMapIntensity: 0.8,
  }),
  // Main body of the spinner
  '1.000000_0.000000_0.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FF0000'),
    metalness: 0.7,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  }),
});

// Find the rotation center by looking at the spinner body (red part)
// The spinner body's geometric center in the XZ plane should be the bearing location
// We take X and Z from the spinner body center, but Y from the bearing parts
const findRotationCenter = (scene: THREE.Object3D): THREE.Vector3 => {
  // Force update all matrices to get accurate world positions
  scene.updateMatrixWorld(true);

  const spinnerBodyKey = '1.000000_0.000000_0.000000_0.000000_0.000000'; // Red spinner body
  const bearingSealKey = '0.000000_0.000000_1.000000_0.000000_0.000000'; // Blue bearing seal
  const bearingCasingKey = '0.647059_0.647059_0.647059_0.000000_0.000000'; // Gray bearing casing

  let spinnerBodyBox: THREE.Box3 | null = null;
  let bearingBox: THREE.Box3 | null = null;

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const materialKeys = materials.map((m) => m?.name).filter(Boolean);

      object.updateMatrixWorld(true);
      const meshBox = new THREE.Box3().setFromObject(object);

      // Check for spinner body
      if (materialKeys.some((key) => key === spinnerBodyKey)) {
        if (!spinnerBodyBox) {
          spinnerBodyBox = meshBox.clone();
        } else {
          spinnerBodyBox.union(meshBox);
        }
      }

      // Check for bearing parts
      if (materialKeys.some((key) => key === bearingSealKey || key === bearingCasingKey)) {
        if (!bearingBox) {
          bearingBox = meshBox.clone();
        } else {
          bearingBox.union(meshBox);
        }
      }
    }
  });

  // Use spinner body center for XZ, bearing center for Y (along rotation axis)
  const center = new THREE.Vector3();

  if (spinnerBodyBox) {
    const bodyCenter = new THREE.Vector3();
    spinnerBodyBox.getCenter(bodyCenter);
    console.log('Spinner body center:', bodyCenter);
    center.x = bodyCenter.x;
    center.z = bodyCenter.z;
    center.y = bodyCenter.y; // Default to body center Y
  }

  if (bearingBox) {
    const bearingCenter = new THREE.Vector3();
    bearingBox.getCenter(bearingCenter);
    console.log('Bearing center:', bearingCenter);
    // Use bearing Y for the rotation axis position
    center.y = bearingCenter.y;
  }

  // If we didn't find the spinner body, fall back to scene center
  if (!spinnerBodyBox) {
    console.log('Spinner body not found, using scene center');
    const sceneBox = new THREE.Box3().setFromObject(scene);
    sceneBox.getCenter(center);
  }

  console.log('Final rotation center:', center);
  return center;
};

const SpinnerModel: FC<SpinnerModelProps> = ({ isXray, ...props }) => {
  const materials = useRef(createMaterials());
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/fidget-spinner.gltf');

  // Calculate the rotation center offset once
  const rotationCenter = useMemo(() => {
    // Also log the overall scene bounds for comparison
    scene.updateMatrixWorld(true);
    const sceneBox = new THREE.Box3().setFromObject(scene);
    console.log('Full scene bounding box min:', sceneBox.min);
    console.log('Full scene bounding box max:', sceneBox.max);
    const sceneCenter = new THREE.Vector3();
    sceneBox.getCenter(sceneCenter);
    console.log('Full scene center:', sceneCenter);

    const center = findRotationCenter(scene);
    console.log('Rotation center to use:', center);
    console.log('Offset to apply:', -center.x, -center.y, -center.z);
    return center;
  }, [scene]);

  // Initialize materials
  useEffect(() => {
    const customMaterials = createMaterials();
    materials.current = customMaterials;
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
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
      {/* Offset the scene by the bearing center so rotation happens around the bearing */}
      <group position={[-bearingOffset.x, -bearingOffset.y, -bearingOffset.z]}>
        <primitive object={scene} {...props} />
      </group>
    </group>
  );
};

export default SpinnerModel;

useGLTF.preload('/fidget-spinner.gltf');
