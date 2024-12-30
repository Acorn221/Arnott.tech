/* eslint-disable no-param-reassign */
import {
  FC, useRef, useEffect, useState,
} from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, GroupProps, ThreeEvent } from '@react-three/fiber';

interface FidgetSpinnerProps extends GroupProps {
  scale?: number | [number, number, number];
  position?: [number, number, number];
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

const Spinner: FC<FidgetSpinnerProps> = (props) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const materials = useRef(createMaterials());
  const [isXray, setIsXray] = useState(false);

  const { scene } = useGLTF('/fidget-spinner.gltf');

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.set(Math.PI, 0, -Math.PI / 2);
    }
  }, []);

  // Store initial material setup
  useEffect(() => {
    const customMaterials = createMaterials();
    materials.current = customMaterials;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Store the material name as a custom property
        // @ts-ignore
        object.userData.materialKey = object.material.name;

        // Apply our custom materials initially
        const materialKey = object.material.name;
        // @ts-ignore - materialKey is a custom property
        if (customMaterials[materialKey]) {
          // @ts-ignore - materialKey is a custom property
          object.material = customMaterials[materialKey];
          object.castShadow = true;
          object.receiveShadow = true;
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    console.log('isXray changed to:', isXray);
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
          // Use the stored material key to restore the correct material
          const { materialKey } = object.userData;
          // @ts-ignore - materialKey is a custom property
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

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'x') {
        setIsXray((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const rotationSpeed = useRef(0);
  const targetSpeed = useRef(30);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (!isDragging.current) {
      targetSpeed.current *= 0.99;
    }

    rotationSpeed.current = THREE.MathUtils.lerp(
      rotationSpeed.current,
      targetSpeed.current,
      0.1,
    );

    groupRef.current.rotation.y -= rotationSpeed.current * delta;
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = 'grabbing';
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    document.body.style.cursor = 'grab';
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - previousMousePosition.current.x;
    targetSpeed.current = deltaX * 0.01;

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = () => {
    targetSpeed.current += 5 + Math.random() * 10;
  };

  return (
    <group
      ref={groupRef}
      {...props}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
    >
      <primitive object={scene} />
    </group>
  );
};

export default Spinner;
