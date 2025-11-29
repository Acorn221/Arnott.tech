import * as THREE from 'three';
import { createTextureMaterial } from './materials';
import { createAnimatedDisplayPlate } from './display-plate';
import { createAnimatedGlowBorder, AnimatedGlowBorderMaterial } from './display-border-material';

import amplifyIcon from '../Carousel/Slides/util/Icons/assets/ampliify.svg';
import discordIcon from '../Carousel/Slides/util/Icons/assets/discord.svg';
import dynamoIcon from '../Carousel/Slides/util/Icons/assets/dynamoDB.svg';
import eslintIcon from '../Carousel/Slides/util/Icons/assets/eslint.svg';
import gitkrakenIcon from '../Carousel/Slides/util/Icons/assets/gitkraken.svg';
import lambdaIcon from '../Carousel/Slides/util/Icons/assets/lambda.svg';
import postmanIcon from '../Carousel/Slides/util/Icons/assets/postman.svg';
import viteIcon from '../Carousel/Slides/util/Icons/assets/vite.svg';

// Must have exactly 8 icons per reel to match 8-face cylinder geometry
const reel1Icons = [viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon];
const reel2Icons = [amplifyIcon, lambdaIcon, postmanIcon, gitkrakenIcon, amplifyIcon, lambdaIcon, postmanIcon, gitkrakenIcon];
const reel3Icons = [dynamoIcon, discordIcon, dynamoIcon, discordIcon, dynamoIcon, discordIcon, dynamoIcon, discordIcon];

// Shared metallic material for screw parts
const screwMetalMaterial = () => new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#C0C0C0'),
  metalness: 1.0,
  roughness: 0.15,
  clearcoat: 0.8,
  clearcoatRoughness: 0.1,
});

// Store handle knob animated material for external control
let handleKnobAnimatedMaterial: AnimatedGlowBorderMaterial | null = null;

export const getHandleKnobAnimatedMaterial = () => handleKnobAnimatedMaterial;

export const createPartOverrides = () => {
  // Create handle knob material and store reference
  handleKnobAnimatedMaterial = createAnimatedGlowBorder({
    color: '#FF3333',
    pulseSpeed: 1.2,
    minIntensity: 1.0,
    maxIntensity: 5.0,
    minOpacity: 0.4,
    maxOpacity: 0.7,
  });

  return {
  // Display plate for text - very dark background
  'display-plate': createAnimatedDisplayPlate({
    text: 'SPIN TO WIN!',
    textColor: '#FFFFFF',
    backgroundColor: '#020202', // Much darker
    fontSize: 42,
  }).material,

  // Animated glowing border - dark base with strong emissive glow
  'display-border': createAnimatedGlowBorder({
    color: '#00FF88',
    pulseSpeed: 1,
    minIntensity: 0.5,
    maxIntensity: 1.0, // Stronger glow
  }).material,

  // Faceplate - dark matte surface
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
  // Red glowing handle knob - pulses to attract attention!
  'handle-knob': handleKnobAnimatedMaterial!.material,
  'slot-spinner-1': createTextureMaterial(reel1Icons),
  'slot-spinner-2': createTextureMaterial(reel2Icons),
  'slot-spinner-3': createTextureMaterial(reel3Icons),

  // Screw parts - shiny metallic finish
  'screw-1': screwMetalMaterial(),
  'screw-2': screwMetalMaterial(),
  'screw-3': screwMetalMaterial(),
  'screw-4': screwMetalMaterial(),
};
};
