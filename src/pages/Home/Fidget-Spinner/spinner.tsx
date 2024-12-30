/* eslint-disable no-param-reassign */
import { FC, useRef, useEffect } from 'react';
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
    // metalness: 0.9,
    // roughness: 0.15,
    // envMapIntensity: 1.0,
    // clearcoat: 1.0,
    // clearcoatRoughness: 0.1,
  }),
  // Bearing casing
  '0.898039_0.898039_0.898039_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    // color: new THREE.Color('#FF0000'),
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
    // metalness: 0.7,
    roughness: 0.3,
    envMapIntensity: 0.8,
  }),
  // Main body of the spinner
  '1.000000_0.000000_0.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FF0000'),
    metalness: 0.7,
    roughness: 0.3,
    // envMapIntensity: 1.2,
    // clearcoat: 0.8,
    // clearcoatRoughness: 0.1,
  }),
});

const Spinner: FC<FidgetSpinnerProps> = (props) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const materials = useRef(createMaterials());

  const { scene } = useGLTF('/fidget-spinner.gltf');

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.set(Math.PI, 0, -Math.PI / 2);
    }
  }, []);

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const materialName = object.material?.name;
    // @ts-ignore yeet
    const mappedMaterial = materials.current[materialName] as THREE.Material;

    if (mappedMaterial) {
      object.material = mappedMaterial;
    }

    // Enable shadows
    object.castShadow = true;
    object.receiveShadow = true;
  });

  const rotationSpeed = useRef(0);
  const targetSpeed = useRef(0);

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
