/* eslint-disable no-param-reassign */
import {
  FC, useRef, useEffect, useState, SetStateAction, Dispatch,
} from 'react';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, GroupProps, ThreeEvent } from '@react-three/fiber';

interface FidgetSpinnerProps extends GroupProps {
  scale?: number | [number, number, number];
  position?: [number, number, number];
  setSpinCount: Dispatch<SetStateAction<number>>;
}

const createMaterials = () => ({
  '0.000000_0.000000_0.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFFFFF'),
  }),
  '0.647059_0.647059_0.647059_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8e8e8'),
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  }),
  '0.000000_0.000000_1.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0000FF'),
    roughness: 0.3,
    envMapIntensity: 0.8,
  }),
  '1.000000_0.000000_0.000000_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FF0000'),
    metalness: 0.7,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  }),
});

const FULL_ROTATION = Math.PI * 2;
const MIN_SPEED_FOR_CLICK = 1;
const MAX_ANGULAR_VELOCITY = 100; // Increased max velocity
const DRAG_MULTIPLIER = 0.05; // How much mouse movement affects spin
const FRICTION_BASE = 0.999; // Base friction coefficient
const MIN_DRAG_THRESHOLD = 3; // Minimum pixels of movement before drag is registered

const Spinner: FC<FidgetSpinnerProps> = ({ setSpinCount, ...props }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const hasInitializedDrag = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const materials = useRef(createMaterials());
  const [isXray, setIsXray] = useState(false);
  const angularVelocity = useRef(0);
  const lastDragTime = useRef(0);
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const lastRotation = useRef(0);
  const accumulatedRotation = useRef(0);
  const { scene } = useGLTF('/fidget-spinner.gltf');

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.set(Math.PI, 0, -Math.PI / 2);
      lastRotation.current = groupRef.current.rotation.y;
    }
  }, []);

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

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'x') {
        setIsXray((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (!isDragging.current && angularVelocity.current !== 0) {
      const speed = Math.abs(angularVelocity.current);

      // More gradual friction that scales with speed
      const frictionFactor = Math.max(
        FRICTION_BASE - (speed * 0.0001), // Higher speeds get more friction
        0.995, // Minimum friction coefficient
      );

      angularVelocity.current *= frictionFactor;

      // Stop if very slow
      if (Math.abs(angularVelocity.current) < 0.05) {
        angularVelocity.current = 0;
      }

      groupRef.current.rotation.y -= angularVelocity.current * delta;
      const currentRotation = groupRef.current.rotation.y;
      const deltaRotation = currentRotation - lastRotation.current;
      accumulatedRotation.current += deltaRotation;

      if (Math.abs(accumulatedRotation.current) >= FULL_ROTATION) {
        const completeRotations = Math.floor(Math.abs(accumulatedRotation.current) / FULL_ROTATION);
        setSpinCount((prev) => prev + completeRotations);
        accumulatedRotation.current %= FULL_ROTATION;
      }
      lastRotation.current = currentRotation;
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.buttons > 0) {
      isDragging.current = true;
      hasInitializedDrag.current = true;
      dragStartPosition.current = { x: e.clientX, y: e.clientY };
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
      lastDragTime.current = performance.now();
      document.body.style.cursor = 'grabbing';
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (hasInitializedDrag.current) {
      isDragging.current = false;
      hasInitializedDrag.current = false;
      document.body.style.cursor = 'grab';

      // More modest velocity boost on release
      angularVelocity.current *= 2;

      // Ensure we don't exceed max velocity
      angularVelocity.current = Math.min(Math.abs(angularVelocity.current), MAX_ANGULAR_VELOCITY)
        * Math.sign(angularVelocity.current);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || !hasInitializedDrag.current || !groupRef.current) return;
    const currentTime = performance.now();
    const deltaX = e.clientX - previousMousePosition.current.x;
    const totalDragX = Math.abs(e.clientX - dragStartPosition.current.x);

    // Only process movement if total drag distance exceeds threshold
    if (totalDragX > MIN_DRAG_THRESHOLD) {
      // Calculate mouse movement speed
      const timeDelta = (currentTime - lastDragTime.current) / 1000;
      const mouseMoveSpeed = timeDelta > 0 ? Math.abs(deltaX / timeDelta) : 0;

      // Threshold for considering the mouse "still" (in pixels per second)
      const MOUSE_STILL_THRESHOLD = 50;

      if (mouseMoveSpeed < MOUSE_STILL_THRESHOLD) {
        // If mouse is moving very slowly or is still, stop the spinner
        angularVelocity.current = 0;
      } else {
        // Apply movement to rotation
        groupRef.current.rotation.y -= deltaX * DRAG_MULTIPLIER;

        if (timeDelta > 0) {
          const instantVelocity = deltaX / timeDelta;
          // Smooth velocity changes
          angularVelocity.current = THREE.MathUtils.lerp(
            angularVelocity.current,
            instantVelocity * DRAG_MULTIPLIER,
            0.5,
          );
        }
      }
    }

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    lastDragTime.current = currentTime;
  };

  const handleClick = () => {
    const currentSpeed = Math.abs(angularVelocity.current);
    if (currentSpeed < MIN_SPEED_FOR_CLICK) {
      const boost = (1 + Math.random() * 2) * 0.1;
      angularVelocity.current += boost;
    }
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
