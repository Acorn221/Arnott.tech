import * as THREE from 'three';
import { createTextureMaterial } from './materials';

import amplifyIcon from '../Carousel/Slides/util/Icons/assets/ampliify.svg';
import discordIcon from '../Carousel/Slides/util/Icons/assets/discord.svg';
import dynamoIcon from '../Carousel/Slides/util/Icons/assets/dynamoDB.svg';
import eslintIcon from '../Carousel/Slides/util/Icons/assets/eslint.svg';
import gitkrakenIcon from '../Carousel/Slides/util/Icons/assets/gitkraken.svg';
import lambdaIcon from '../Carousel/Slides/util/Icons/assets/lambda.svg';
import postmanIcon from '../Carousel/Slides/util/Icons/assets/postman.svg';
import viteIcon from '../Carousel/Slides/util/Icons/assets/vite.svg';

// Must have exactly 8 icons per reel to match octagonal geometry
const reel1Icons = [viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon, viteIcon, eslintIcon];
const reel2Icons = [amplifyIcon, lambdaIcon, postmanIcon, amplifyIcon, lambdaIcon, postmanIcon, amplifyIcon, lambdaIcon];
const reel3Icons = [dynamoIcon, gitkrakenIcon, discordIcon, dynamoIcon, gitkrakenIcon, discordIcon, dynamoIcon, gitkrakenIcon];

export const createPartOverrides = () => ({
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
});
