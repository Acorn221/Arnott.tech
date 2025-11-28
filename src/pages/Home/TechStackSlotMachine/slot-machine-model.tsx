/* eslint-disable no-param-reassign */
import {
  FC,
  useRef,
  useEffect,
  useState,
} from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GroupProps } from '@react-three/fiber';

interface SlotMachineModelProps extends GroupProps {
  onHandleRef?: (pivot: THREE.Object3D | null) => void;
}

// Part name mapping - you'll fill this in!
// Format: 'Part X' -> 'descriptive name'
const PART_NAMES: Record<string, string> = {
  // Fill these in as you identify each part
  // e.g., 'Part 1': 'glass_front',
};

const createMaterials = () => ({
  // Yellowish - Screws/Bolts -> Polished Brass
  '0.980392_0.713725_0.003922_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#B8860B'),
      metalness: 1.0,
      roughness: 0.2,
      clearcoat: 0.3,
    }),
  // White/Grey - Main Body -> Classic Cream/Off-White
  '0.917647_0.917647_0.917647_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#F5F5DC'),
      metalness: 0.0,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    }),
  // Grey - Metal Frame -> Polished Chrome
  '0.498039_0.498039_0.498039_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#C0C0C0'),
      metalness: 1.0,
      roughness: 0.15,
      clearcoat: 0.5,
    }),
  // Light Blue - Glass/Screen -> Clear Glass Display
  '0.615686_0.811765_0.929412_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#E8F4F8'),
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.9,
      thickness: 0.3,
      transparent: true,
      opacity: 0.4,
    }),
  // Blue - Buttons/Accents -> Deep Navy Button
  '0.231373_0.380392_0.705882_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1a365d'),
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 0.8,
    }),
  // Very Light Blue -> Brushed Steel Trim
  '0.768627_0.886275_0.952941_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#D4D4D4'),
      metalness: 0.9,
      roughness: 0.3,
    }),
  // Grey -> Corner Screws - Dark metallic
  '0.647059_0.647059_0.647059_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1a1a1a'),
      metalness: 0.9,
      roughness: 0.3,
      clearcoat: 0.4,
    }),
  // Orange - Trim/Accents -> Rich Mahogany Wood Trim
  '0.972549_0.529412_0.003922_0.000000_0.000000':
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#8B4513'),
      metalness: 0.0,
      roughness: 0.4,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    }),
});

// Special materials for specific parts (by node name)
const createPartOverrides = () => ({
  'spinner-housing': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a1a1a'),
    metalness: 0.8,
    roughness: 0.2,
    clearcoat: 0.6,
  }),
  'handle-knob': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ff3333'),
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.95,
    thickness: 0.3,
    transparent: true,
    opacity: 0.4,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    ior: 1.5,
  }),
});

const SlotMachineModel: FC<SlotMachineModelProps> = ({ onHandleRef, ...props }) => {
  const materials = useRef(createMaterials());
  const partOverrides = useRef(createPartOverrides());
  const groupRef = useRef<THREE.Group>(null);
  const handlePivotRef = useRef<THREE.Group | null>(null);
  const { scene } = useGLTF('/tech-stack-slot-machine.gltf');
  const [highlightedPart, setHighlightedPart] = useState<number>(-1);
  const [partsList, setPartsList] = useState<string[]>([]);

  // Collect all parts on mount
  useEffect(() => {
    const parts: string[] = [];
    scene.traverse((object) => {
      // Look for nodes that have "Part" in the name (from the gltf hierarchy)
      if (object.name.includes('Part') && object.name.match(/Part \d+$/)) {
        parts.push(object.name);
      }
    });
    // Sort by part number
    parts.sort((a, b): number => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
    setPartsList(parts);
    console.log('=== ALL PARTS ===');
    parts.forEach((p, i) => console.log(`${i}: ${p}`));
  }, [scene]);

  // Create pivot group for handle and expose it
  useEffect(() => {
    if (handlePivotRef.current) {
      // Already set up
      if (onHandleRef) onHandleRef(handlePivotRef.current);
      return;
    }

    let handleKnob: THREE.Object3D | undefined;
    let handleBody: THREE.Object3D | undefined;

    scene.traverse((object) => {
      if (object.name === 'handle-knob') {
        handleKnob = object;
      } else if (object.name === 'handle-body') {
        handleBody = object;
      }
    });

    if (!handleKnob || !handleBody) return;

    const bodyParent = handleBody.parent;
    const knobParent = handleKnob.parent;
    if (!bodyParent || !knobParent) return;

    // Create pivot at body's current position
    const pivot = new THREE.Group();
    pivot.name = 'handle-pivot';
    pivot.position.copy(handleBody.position);

    // Offset pivot to the exact rotation axis (from ROTATION-AXIS marker in model)
    pivot.position.x = 0.01969;
    pivot.position.y = 0;
    pivot.position.z = -0.01572;

    bodyParent.add(pivot);

    // Move handle parts into pivot, adjusting their positions
    const bodyOffset = handleBody.position.clone().sub(pivot.position);
    const knobOffset = handleKnob.position.clone().sub(pivot.position);

    bodyParent.remove(handleBody);
    knobParent.remove(handleKnob);

    pivot.add(handleBody);
    pivot.add(handleKnob);

    handleBody.position.copy(bodyOffset);
    handleKnob.position.copy(knobOffset);

    handlePivotRef.current = pivot;

    if (onHandleRef) {
      onHandleRef(pivot);
    }
  }, [scene, onHandleRef]);

  // Keyboard navigation for debugging parts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'n') {
        setHighlightedPart((prev) => {
          const next = prev + 1;
          return next >= partsList.length ? -1 : next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        setHighlightedPart((prev) => {
          const next = prev - 1;
          return next < -1 ? partsList.length - 1 : next;
        });
      } else if (e.key === 'Escape') {
        setHighlightedPart(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [partsList.length]);

  // Log current highlighted part
  useEffect(() => {
    if (highlightedPart >= 0 && partsList[highlightedPart]) {
      console.log(`\n🎯 HIGHLIGHTED: ${partsList[highlightedPart]} (index ${highlightedPart})`);
      console.log('Press \'n\' or → for next, \'p\' or ← for previous, Esc to show all');
    } else {
      console.log('\n📦 Showing all parts. Press n/→ to start highlighting individual parts.');
    }
  }, [highlightedPart, partsList]);

  // Helper to find the part name for a mesh by traversing up the hierarchy
  const getPartName = (object: THREE.Object3D): string | null => {
    let current: THREE.Object3D | null = object;
    while (current) {
      // Skip mesh names (like mesh159_mesh) and Part names, look for actual part names
      if (current.name
          && !current.name.includes('Part')
          && !current.name.startsWith('mesh')
          && !current.name.includes('occurrence')) {
        return current.name;
      }
      current = current.parent;
    }
    return null;
  };

  // Initialize materials
  useEffect(() => {
    const customMaterials = createMaterials();
    const overrides = createPartOverrides();
    materials.current = customMaterials;
    partOverrides.current = overrides;
    const unmappedMaterials = new Set<string>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.userData.materialKey = object.material.name;
        const materialKey = object.material.name;
        const partName = getPartName(object);

        // Store the part name for later use
        object.userData.partName = partName;

        // Check for part-specific override first
        // @ts-ignore - partName is fine
        if (partName && overrides[partName]) {
          // @ts-ignore - partName is fine
          object.material = overrides[partName];
          object.castShadow = true;
          object.receiveShadow = true;
        // @ts-ignore - materialKey is fine
        } else if (customMaterials[materialKey]) {
          // @ts-ignore - materialKey is fine
          object.material = customMaterials[materialKey];
          object.castShadow = true;
          object.receiveShadow = true;
        } else {
          unmappedMaterials.add(materialKey);
          console.warn('Unmapped material:', materialKey, 'on object:', object.name);
        }
      }
    });
    if (unmappedMaterials.size > 0) {
      console.log('=== ALL UNMAPPED MATERIALS ===');
      unmappedMaterials.forEach((m) => console.log(`'${m}'`));
    }
  }, [scene]);

  // Handle xray mode and part highlighting
  useEffect(() => {
    const highlightMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f00'),
      emissive: new THREE.Color('#f00'),
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.3,
    });

    const dimMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#333333'),
      transparent: true,
      opacity: 0.3,
      metalness: 0.0,
      roughness: 0.8,
    });

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        // Check if this mesh belongs to the highlighted part
        let belongsToHighlightedPart = false;
        if (highlightedPart >= 0 && partsList[highlightedPart]) {
          let { parent } = obj;
          while (parent) {
            if (parent.name === partsList[highlightedPart]) {
              belongsToHighlightedPart = true;
              break;
            }
            ({ parent } = parent);
          }
        }

        if (highlightedPart >= 0) {
          // Highlighting mode
          if (belongsToHighlightedPart) {
            obj.material = highlightMaterial;
          } else {
            obj.material = dimMaterial;
          }
        } else {
          // Normal mode - use original materials
          const { materialKey, partName } = obj.userData;
          // Check for part-specific override first
          // @ts-ignore - partName is fine
          const overrideMaterial = partName && partOverrides.current[partName];
          // @ts-ignore - materialKey is fine
          const originalMaterial = overrideMaterial || materials.current[materialKey];
          if (originalMaterial) {
            obj.material = originalMaterial;
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        }
      }
    });
  }, [highlightedPart, partsList, scene]);

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={scene} {...props} />
    </group>
  );
};

export default SlotMachineModel;

useGLTF.preload('/tech-stack-slot-machine.gltf');
