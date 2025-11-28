/* eslint-disable no-param-reassign */
import {
  FC,
  useRef,
  useEffect,
} from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GroupProps } from '@react-three/fiber';

// Import SVG icons for reel textures
import amplifyIcon from '../Carousel/Slides/util/Icons/assets/ampliify.svg';
import discordIcon from '../Carousel/Slides/util/Icons/assets/discord.svg';
import dynamoIcon from '../Carousel/Slides/util/Icons/assets/dynamoDB.svg';
import eslintIcon from '../Carousel/Slides/util/Icons/assets/eslint.svg';
import gitkrakenIcon from '../Carousel/Slides/util/Icons/assets/gitkraken.svg';
import lambdaIcon from '../Carousel/Slides/util/Icons/assets/lambda.svg';
import postmanIcon from '../Carousel/Slides/util/Icons/assets/postman.svg';
import viteIcon from '../Carousel/Slides/util/Icons/assets/vite.svg';

interface SlotMachineModelProps extends GroupProps {
  onHandleRef?: (pivot: THREE.Object3D | null) => void;
  onSpinnersRef?: (spinners: Record<string, THREE.Object3D>) => void;
}

// Spinner pivot axis coordinates (from model's SPINNER-PIVOT-POINT node)
const SPINNER_AXIS_Y = -0.0038093519397079945;
const SPINNER_AXIS_Z = 0.0;

const createMaterials = () => ({
  // Screws/Bolts - Polished Brass
  '0.980392_0.713725_0.003922_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#B8860B'),
    metalness: 1.0,
    roughness: 0.2,
    clearcoat: 0.3,
  }),
  // Main Body - Classic Cream
  '0.917647_0.917647_0.917647_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F5F5DC'),
    metalness: 0.0,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  }),
  // Metal Frame - Polished Chrome
  '0.498039_0.498039_0.498039_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#C0C0C0'),
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.5,
  }),
  // Glass/Screen - Clear Glass
  '0.615686_0.811765_0.929412_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E8F4F8'),
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.9,
    thickness: 0.3,
    transparent: true,
    opacity: 0.4,
  }),
  // Buttons/Accents - Deep Navy
  '0.231373_0.380392_0.705882_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a365d'),
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 0.8,
  }),
  // Brushed Steel Trim
  '0.768627_0.886275_0.952941_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D4D4D4'),
    metalness: 0.9,
    roughness: 0.3,
  }),
  // Corner Screws - Dark metallic
  '0.647059_0.647059_0.647059_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a1a1a'),
    metalness: 0.9,
    roughness: 0.3,
    clearcoat: 0.4,
  }),
  // Trim/Accents - Mahogany Wood
  '0.972549_0.529412_0.003922_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#8B4513'),
    metalness: 0.0,
    roughness: 0.4,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  }),
});

const createTextureMaterial = (icons: string[]) => {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  if (context) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);

    const segmentWidth = size / 8;
    let imagesLoaded = 0;

    // Draw alternating background segments
    icons.forEach((_, i) => {
      const x = i * segmentWidth;
      context.fillStyle = i % 2 === 0 ? '#f8f9fa' : '#e9ecef';
      context.fillRect(x, 0, segmentWidth, size);

      context.strokeStyle = '#dee2e6';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, size);
      context.stroke();
    });

    // Load and draw icons
    icons.forEach((iconUrl, i) => {
      const img = new Image();
      img.src = iconUrl;
      img.onload = () => {
        const x = i * segmentWidth;
        const iconWidth = segmentWidth * 0.95;
        const iconHeight = size * 0.5;
        const xOffset = (segmentWidth - iconWidth) / 2;
        const yOffset = (size - iconHeight) / 2;

        context.save();
        context.translate(x + xOffset + iconWidth / 2, yOffset + iconHeight / 2);
        context.rotate(-Math.PI / 2);
        context.filter = 'grayscale(100%) brightness(0)';
        context.drawImage(img, -iconHeight / 2, -iconWidth / 2, iconHeight, iconWidth);
        context.restore();

        imagesLoaded++;
        if (imagesLoaded === icons.length) {
          texture.needsUpdate = true;
        }
      };
    });
  }

  return new THREE.MeshPhysicalMaterial({
    map: texture,
    metalness: 0.1,
    roughness: 0.4,
    color: 0xffffff,
  });
};

const createPartOverrides = () => {
  // Icon sets for each reel
  const reel1Icons = [viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon];
  const reel2Icons = [amplifyIcon, lambdaIcon, postmanIcon, amplifyIcon, lambdaIcon, postmanIcon, amplifyIcon, lambdaIcon];
  const reel3Icons = [dynamoIcon, gitkrakenIcon, discordIcon, dynamoIcon, gitkrakenIcon, discordIcon, dynamoIcon, gitkrakenIcon];

  return {
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
    'slot-spinner-1': createTextureMaterial(reel1Icons),
    'slot-spinner-2': createTextureMaterial(reel2Icons),
    'slot-spinner-3': createTextureMaterial(reel3Icons),
  };
};

const SlotMachineModel: FC<SlotMachineModelProps> = ({ onHandleRef, onSpinnersRef, ...props }) => {
  const materials = useRef(createMaterials());
  const partOverrides = useRef(createPartOverrides());
  const groupRef = useRef<THREE.Group>(null);
  const handlePivotRef = useRef<THREE.Group | null>(null);
  const spinnerPivotsRef = useRef<Record<string, THREE.Object3D>>({});
  const { scene } = useGLTF('/tech-stack-slot-machine.gltf');

  // Helper to find the part name for a mesh
  const getPartName = (object: THREE.Object3D): string | null => {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.name && !current.name.includes('Part') && !current.name.startsWith('mesh') && !current.name.includes('occurrence')) {
        return current.name;
      }
      current = current.parent;
    }
    return null;
  };

  // Initialize materials
  useEffect(() => {
    const customMaterials = materials.current;
    const overrides = partOverrides.current;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materialKey = object.material.name;
        const partName = getPartName(object);

        object.userData.materialKey = materialKey;
        object.userData.partName = partName;

        // @ts-ignore
        if (partName && overrides[partName]) {
          // @ts-ignore
          object.material = overrides[partName];
        // @ts-ignore
        } else if (customMaterials[materialKey]) {
          // @ts-ignore
          object.material = customMaterials[materialKey];
        }

        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  // Create pivot group for handle
  useEffect(() => {
    if (handlePivotRef.current) {
      if (onHandleRef) onHandleRef(handlePivotRef.current);
      return;
    }

    let handleKnob: THREE.Object3D | undefined;
    let handleBody: THREE.Object3D | undefined;

    scene.traverse((object) => {
      if (object.name === 'handle-knob') handleKnob = object;
      else if (object.name === 'handle-body') handleBody = object;
    });

    if (!handleKnob || !handleBody) return;

    const bodyParent = handleBody.parent;
    const knobParent = handleKnob.parent;
    if (!bodyParent || !knobParent) return;

    const pivot = new THREE.Group();
    pivot.name = 'handle-pivot';
    pivot.position.set(0.01969, 0, -0.01572);
    bodyParent.add(pivot);

    const bodyOffset = handleBody.position.clone().sub(pivot.position);
    const knobOffset = handleKnob.position.clone().sub(pivot.position);

    bodyParent.remove(handleBody);
    knobParent.remove(handleKnob);

    pivot.add(handleBody);
    pivot.add(handleKnob);

    handleBody.position.copy(bodyOffset);
    handleKnob.position.copy(knobOffset);

    handlePivotRef.current = pivot;
    if (onHandleRef) onHandleRef(pivot);
  }, [scene, onHandleRef]);

  // Create pivot groups for spinners
  useEffect(() => {
    if (Object.keys(spinnerPivotsRef.current).length > 0) {
      if (onSpinnersRef) onSpinnersRef(spinnerPivotsRef.current);
      return;
    }

    const foundSpinners: Record<string, THREE.Object3D> = {};
    scene.traverse((object) => {
      if (object.name.match(/^slot-spinner-\d+$/)) {
        foundSpinners[object.name] = object;
      }
    });

    const newPivots: Record<string, THREE.Object3D> = {};

    Object.entries(foundSpinners).forEach(([name, spinner]) => {
      const { parent } = spinner;
      if (!parent) return;

      if (parent.name === `${name}-pivot`) {
        newPivots[name] = parent;
        return;
      }

      // Get spinner position and create pivot at axle coordinates
      const spinnerWorldPos = new THREE.Vector3();
      spinner.getWorldPosition(spinnerWorldPos);

      const spinnerModelPos = spinnerWorldPos.clone();
      scene.worldToLocal(spinnerModelPos);

      const pivotModelPos = new THREE.Vector3(spinnerModelPos.x, SPINNER_AXIS_Y, SPINNER_AXIS_Z);
      const pivotWorldPos = pivotModelPos.clone();
      scene.localToWorld(pivotWorldPos);

      const pivotParentPos = pivotWorldPos.clone();
      parent.worldToLocal(pivotParentPos);

      const pivot = new THREE.Group();
      pivot.name = `${name}-pivot`;
      pivot.position.copy(pivotParentPos);
      parent.add(pivot);

      const offset = spinner.position.clone().sub(pivotParentPos);
      parent.remove(spinner);
      pivot.add(spinner);
      spinner.position.copy(offset);

      newPivots[name] = pivot;
    });

    spinnerPivotsRef.current = newPivots;
    if (onSpinnersRef) onSpinnersRef(newPivots);
  }, [scene, onSpinnersRef]);

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={scene} {...props} />
    </group>
  );
};

export default SlotMachineModel;

useGLTF.preload('/tech-stack-slot-machine.gltf');
