import * as THREE from 'three';
import { createAnimatedDisplayPlate, type DynamicDisplayPlate } from './display-plate';
import { createAnimatedGlowBorder, type AnimatedGlowBorderMaterial } from './display-border-material';

// ============================================================================
// Types
// ============================================================================

/** Part names for static (non-spinner) parts */
export type StaticPartName =
  | 'display-plate'
  | 'display-border'
  | 'faceplate'
  | 'spinner-housing'
  | 'handle-knob'
  | 'screw-1'
  | 'screw-2'
  | 'screw-3'
  | 'screw-4'
  | 'slot-indicator-1'
  | 'slot-indicator-2'
  | 'slot-indicator-3'
  | 'slot-indicator-4';

export type StaticPartOverrideMap = Record<StaticPartName, THREE.Material>;

export interface StaticPartOverridesResult {
  overrides: StaticPartOverrideMap;
  knobMaterial: AnimatedGlowBorderMaterial;
  displayPlate: DynamicDisplayPlate;
  indicatorMaterials: THREE.MeshPhysicalMaterial[];
}

// ============================================================================
// Materials
// ============================================================================

/** Creates a shiny metallic material for screws */
const createScrewMaterial = (): THREE.MeshPhysicalMaterial => new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#C0C0C0'),
  metalness: 1.0,
  roughness: 0.15,
  clearcoat: 0.8,
  clearcoatRoughness: 0.1,
});

/** Creates a glowing indicator material */
const createIndicatorMaterial = (): THREE.MeshPhysicalMaterial => new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#FF6B00'),
  emissive: new THREE.Color('#FF6B00'),
  emissiveIntensity: 0.8,
  metalness: 0.3,
  roughness: 0.4,
  transparent: true,
  opacity: 0.9,
});

/**
 * Creates materials for all static parts (everything except spinners).
 * Spinners get their materials from the dynamic reel texture system.
 */
export const createStaticPartOverrides = (): StaticPartOverridesResult => {
  // Animated materials
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

  const displayPlate = createAnimatedDisplayPlate({
    text: 'SPIN TO WIN!',
    textColor: '#FFFFFF',
    backgroundColor: '#020202',
    fontSize: 42,
  });

  // Create indicator materials (can be animated later)
  const indicatorMaterials = [
    createIndicatorMaterial(),
    createIndicatorMaterial(),
    createIndicatorMaterial(),
    createIndicatorMaterial(),
  ];

  const overrides: StaticPartOverrideMap = {
    'display-plate': displayPlate.material,
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
    'screw-1': createScrewMaterial(),
    'screw-2': createScrewMaterial(),
    'screw-3': createScrewMaterial(),
    'screw-4': createScrewMaterial(),
    'slot-indicator-1': indicatorMaterials[0],
    'slot-indicator-2': indicatorMaterials[1],
    'slot-indicator-3': indicatorMaterials[2],
    'slot-indicator-4': indicatorMaterials[3],
  };

  return { overrides, knobMaterial, displayPlate, indicatorMaterials };
};
