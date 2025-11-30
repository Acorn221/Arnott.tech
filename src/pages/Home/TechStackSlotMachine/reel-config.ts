import * as THREE from "three";
import {
  createAnimatedDisplayPlate,
  type DynamicDisplayPlate,
} from "./display-plate";
import {
  createAnimatedGlowBorder,
  type AnimatedGlowBorderMaterial,
} from "./display-border-material";
import {
  createAnimatedFaceplate,
  type AnimatedFaceplateMaterial,
} from "./faceplate-material";
import { type ShareButtonMaterial } from "./SlotMachineContext";

// ============================================================================
// Types
// ============================================================================

/** Part names for static (non-spinner) parts */
export type StaticPartName =
  | "display-plate"
  | "display-border"
  | "faceplate"
  | "top-plate"
  | "spinner-housing"
  | "handle-knob"
  | "screw-1"
  | "screw-2"
  | "screw-3"
  | "screw-4"
  | "slot-indicator-1"
  | "slot-indicator-2"
  | "slot-indicator-3"
  | "slot-indicator-4"
  | "button-2-body";

export type StaticPartOverrideMap = Record<StaticPartName, THREE.Material>;

export interface StaticPartOverridesResult {
  overrides: StaticPartOverrideMap;
  knobMaterial: AnimatedGlowBorderMaterial;
  displayPlate: DynamicDisplayPlate;
  indicatorMaterials: THREE.MeshPhysicalMaterial[];
  shareButtonMaterial: ShareButtonMaterial;
  faceplateMaterial: AnimatedFaceplateMaterial;
}

// ============================================================================
// Materials
// ============================================================================

/** Creates a shiny metallic material for screws */
const createScrewMaterial = (): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#C0C0C0"),
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });

/** Creates an emissive indicator material for the slot machine lights */
const createIndicatorMaterial = (): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(0.08, 1, 0.5), // Orange initial color
    emissive: new THREE.Color().setHSL(0.08, 1, 0.5),
    emissiveIntensity: 0.5, // Keep above bloom threshold (0.3)
    metalness: 0.2,
    roughness: 0.3,
  });

/** Creates a share button material that glows when active */
const createShareButtonMaterial = (): ShareButtonMaterial => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#1a1a1a"), // Dark when inactive
    emissive: new THREE.Color("#00AAFF"), // Blue glow
    emissiveIntensity: 0, // Start with no glow
    metalness: 0.3,
    roughness: 0.4,
    clearcoat: 0.5,
  });

  return {
    material,
    setActive: (active: boolean) => {
      if (active) {
        material.emissiveIntensity = 1.5;
        material.color.set("#00AAFF");
      } else {
        material.emissiveIntensity = 0;
        material.color.set("#1a1a1a");
      }
    },
  };
};

/**
 * Creates materials for all static parts (everything except spinners).
 * Spinners get their materials from the dynamic reel texture system.
 */
export const createStaticPartOverrides = (): StaticPartOverridesResult => {
  // Animated materials
  const knobMaterial = createAnimatedGlowBorder({
    color: "#FF3333",
    pulseSpeed: 1.2,
    minIntensity: 1.0,
    maxIntensity: 5.0,
    minOpacity: 0.4,
    maxOpacity: 0.7,
  });

  const displayBorderMaterial = createAnimatedGlowBorder({
    color: "#00FF88",
    pulseSpeed: 1,
    minIntensity: 0.5,
    maxIntensity: 1.0,
  });

  const displayPlate = createAnimatedDisplayPlate({
    text: "SPIN TO WIN!",
    textColor: "#FFFFFF",
    backgroundColor: "#020202",
    fontSize: 42,
  });

  // Create indicator materials (can be animated later)
  const indicatorMaterials = [
    createIndicatorMaterial(),
    createIndicatorMaterial(),
    createIndicatorMaterial(),
    createIndicatorMaterial(),
  ];

  // Create share button material
  const shareButtonMaterial = createShareButtonMaterial();

  // Create barber pole striped faceplate
  // ============ TWEAK THESE VALUES ============
  const faceplateMaterial = createAnimatedFaceplate({
    // Stripe geometry
    stripeWidth: 100,
    angle: 45,

    // Stripe colors
    whiteColor: "#f0f0f0",
    blackColor: "#080808",

    // White stripes (shiny) - lower roughness = more reflective
    whiteRoughness: 0.5, // 0 = mirror, 1 = matte
    whiteMetalness: 1, // 0 = plastic, 1 = metal

    // Black stripes (matte)
    blackRoughness: 0.85, // 0 = mirror, 1 = matte
    blackMetalness: 0.15, // 0 = plastic, 1 = metal

    // Overall finish
    clearcoat: 0.25, // Glossy top layer
    envMapIntensity: 1.0, // Environment reflection strength

    // Animation (stripes move when spinning!)
    animationSpeed: 0.3, // Speed of stripe movement
  });
  // ============================================

  const overrides: StaticPartOverrideMap = {
    "display-plate": displayPlate.material,
    "display-border": displayBorderMaterial.material,
    faceplate: faceplateMaterial.material,
    // Top plate - matte finish, less reflective than faceplate
    "top-plate": new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#111111"),
      metalness: 0.15,
      roughness: 0.4, // Nice and matte
      clearcoat: 0.1,
      sheen: 0.01,
      sheenColor: new THREE.Color("#FFF"),
    }),
    "spinner-housing": new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#1a1a1a"),
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 0.6,
    }),
    "handle-knob": knobMaterial.material,
    "screw-1": createScrewMaterial(),
    "screw-2": createScrewMaterial(),
    "screw-3": createScrewMaterial(),
    "screw-4": createScrewMaterial(),
    "slot-indicator-1": indicatorMaterials[0],
    "slot-indicator-2": indicatorMaterials[1],
    "slot-indicator-3": indicatorMaterials[2],
    "slot-indicator-4": indicatorMaterials[3],
    "button-2-body": shareButtonMaterial.material,
  };

  return {
    overrides,
    knobMaterial,
    displayPlate,
    indicatorMaterials,
    shareButtonMaterial,
    faceplateMaterial,
  };
};
