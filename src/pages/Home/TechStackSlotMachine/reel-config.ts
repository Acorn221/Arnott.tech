import * as THREE from 'three';
import { createAnimatedDisplayPlate, DynamicDisplayPlate } from './display-plate';
import { createAnimatedGlowBorder, AnimatedGlowBorderMaterial } from './display-border-material';

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
  | 'screw-4';

export type StaticPartOverrideMap = Record<StaticPartName, THREE.Material>;

export interface StaticPartOverridesResult {
  overrides: StaticPartOverrideMap;
  knobMaterial: AnimatedGlowBorderMaterial;
  displayPlate: DynamicDisplayPlate;
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
  };

  return { overrides, knobMaterial, displayPlate };
};
