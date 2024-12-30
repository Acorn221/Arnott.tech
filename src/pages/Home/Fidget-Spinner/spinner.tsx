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
  onLoad?: () => void;
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

const FULL_ROTATION = Math.PI * 2;
const MIN_SPEED_FOR_CLICK = 1;
const MAX_ANGULAR_VELOCITY = 100; // Increased max velocity
const DRAG_MULTIPLIER = 0.05; // How much mouse movement affects spin
const FRICTION_BASE = 0.999; // Base friction coefficient
const MIN_DRAG_THRESHOLD = 3; // Minimum pixels of movement before drag is registered

const Spinner: FC<FidgetSpinnerProps> = ({ setSpinCount, onLoad, ...props }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const hasInitializedDrag = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const materials = useRef(createMaterials());
  const [isXray, setIsXray] = useState(false);
  const angularVelocity = useRef(10);
  const lastDragTime = useRef(0);
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const lastRotation = useRef(0);
  const accumulatedRotation = useRef(0);
  const { scene } = useGLTF('/fidget-spinner.gltf');

  const resetCursor = () => {
    document.body.style.cursor = '';
    isDragging.current = false;
    hasInitializedDrag.current = false;
  };

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.set(Math.PI, 0, -Math.PI / 2);
      lastRotation.current = groupRef.current.rotation.y;
    }

    return () => {
      resetCursor();
    };
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

    const handleWindowMouseUp = () => {
      if (isDragging.current) {
        resetCursor();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('mouseleave', resetCursor);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('mouseleave', resetCursor);
    };
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (!isDragging.current && angularVelocity.current !== 0) {
      const speed = Math.abs(angularVelocity.current);

      const frictionFactor = Math.max(
        FRICTION_BASE - (speed * 0.0001),
        0.995,
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

      // Stop the spinner's movement
      angularVelocity.current = 0;
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (hasInitializedDrag.current) {
      document.body.style.cursor = 'grab'; // Reset to grab cursor after dragging
      isDragging.current = false;
      hasInitializedDrag.current = false;
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || !hasInitializedDrag.current || !groupRef.current) return;
    const currentTime = performance.now();
    const deltaX = e.clientX - previousMousePosition.current.x;
    const totalDragX = Math.abs(e.clientX - dragStartPosition.current.x);

    if (totalDragX > MIN_DRAG_THRESHOLD) {
      const timeDelta = (currentTime - lastDragTime.current) / 1000;
      groupRef.current.rotation.y -= deltaX * DRAG_MULTIPLIER;

      if (timeDelta > 0) {
        const instantVelocity = deltaX / timeDelta;
        angularVelocity.current = THREE.MathUtils.lerp(
          angularVelocity.current,
          instantVelocity * DRAG_MULTIPLIER,
          0.5,
        );
      }
    }

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    lastDragTime.current = currentTime;
  };

  const handlePointerEnter = () => {
    document.body.style.cursor = 'grab';
  };

  const handlePointerLeave = () => {
    if (!isDragging.current) {
      document.body.style.cursor = '';
    }
    handlePointerUp({} as ThreeEvent<PointerEvent>);
  };

  return (
    <group
      ref={groupRef}
      {...props}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <primitive object={scene} />
    </group>
  );
};

export default Spinner;
