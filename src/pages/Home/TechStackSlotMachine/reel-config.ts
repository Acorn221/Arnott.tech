import * as THREE from 'three';
import { createReelTextureMaterial } from './materials';
import { createAnimatedDisplayPlate } from './display-plate';
import { createAnimatedGlowBorder, AnimatedGlowBorderMaterial } from './display-border-material';

// Icon imports
import amplifyIcon from '../Carousel/Slides/util/Icons/assets/ampliify.svg';
import discordIcon from '../Carousel/Slides/util/Icons/assets/discord.svg';
import dynamoIcon from '../Carousel/Slides/util/Icons/assets/dynamoDB.svg';
import eslintIcon from '../Carousel/Slides/util/Icons/assets/eslint.svg';
import gitkrakenIcon from '../Carousel/Slides/util/Icons/assets/gitkraken.svg';
import lambdaIcon from '../Carousel/Slides/util/Icons/assets/lambda.svg';
import postmanIcon from '../Carousel/Slides/util/Icons/assets/postman.svg';
import viteIcon from '../Carousel/Slides/util/Icons/assets/vite.svg';

// Part names in the GLTF model that get custom materials
export type PartName =
  | 'display-plate'
  | 'display-border'
  | 'faceplate'
  | 'spinner-housing'
  | 'handle-knob'
  | 'slot-spinner-1'
  | 'slot-spinner-2'
  | 'slot-spinner-3'
  | 'screw-1'
  | 'screw-2'
  | 'screw-3'
  | 'screw-4';

export type PartOverrideMap = Record<PartName, THREE.Material>;

// Reel icon configurations (8 icons per reel for octagonal geometry)
const REEL_1_ICONS = [viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon];
const REEL_2_ICONS = [amplifyIcon, lambdaIcon, postmanIcon, gitkrakenIcon, amplifyIcon, lambdaIcon, postmanIcon, gitkrakenIcon];
const REEL_3_ICONS = [dynamoIcon, discordIcon, dynamoIcon, discordIcon, dynamoIcon, discordIcon, dynamoIcon, discordIcon];

/** Creates a shiny metallic material for screws */
const createScrewMaterial = (): THREE.MeshPhysicalMaterial => new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#C0C0C0'),
  metalness: 1.0,
  roughness: 0.15,
  clearcoat: 0.8,
  clearcoatRoughness: 0.1,
});

/** Result of creating part overrides, includes both materials map and animated material refs */
export interface PartOverridesResult {
  materials: PartOverrideMap;
  knobMaterial: AnimatedGlowBorderMaterial;
}

/** Creates all custom materials for slot machine parts */
export const createPartOverrides = (): PartOverridesResult => {
  // Animated materials (keep references for external control)
  const knobMaterial = createAnimatedGlowBorder({
    color: '#FF3333',
    pulseSpeed: 1.2,
    minIntensity: 1.0,
    maxIntensity: 5.0,
    minOpacity: 0.4,
    maxOpacity: 0.7,
  });

  const displayBorderMaterial = createAnimatedGlowBorder({
    color: '#00FF88',
    pulseSpeed: 1,
    minIntensity: 0.5,
    maxIntensity: 1.0,
  });

  const displayPlateMaterial = createAnimatedDisplayPlate({
    text: 'SPIN TO WIN!',
    textColor: '#FFFFFF',
    backgroundColor: '#020202',
    fontSize: 42,
  });

  const materials: PartOverrideMap = {
    'display-plate': displayPlateMaterial.material,
    'display-border': displayBorderMaterial.material,
    faceplate: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0a0a0a'),
      metalness: 0.1,
      roughness: 0.8,
    }),
    'spinner-housing': new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1a1a1a'),
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 0.6,
    }),
    'handle-knob': knobMaterial.material,
    'slot-spinner-1': createReelTextureMaterial(REEL_1_ICONS),
    'slot-spinner-2': createReelTextureMaterial(REEL_2_ICONS),
    'slot-spinner-3': createReelTextureMaterial(REEL_3_ICONS),
    'screw-1': createScrewMaterial(),
    'screw-2': createScrewMaterial(),
    'screw-3': createScrewMaterial(),
    'screw-4': createScrewMaterial(),
  };

  return { materials, knobMaterial };
};
