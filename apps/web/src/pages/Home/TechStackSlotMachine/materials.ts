import * as THREE from "three";

// Material keys from the GLTF model (based on vertex colors)
export type GltfMaterialKey =
  | "0.980392_0.713725_0.003922_0.000000_0.000000" // Gold/brass
  | "0.917647_0.917647_0.917647_0.000000_0.000000" // Off-white
  | "0.498039_0.498039_0.498039_0.000000_0.000000" // Silver
  | "0.615686_0.811765_0.929412_0.000000_0.000000" // Glass/transparent
  | "0.231373_0.380392_0.705882_0.000000_0.000000" // Dark blue
  | "0.768627_0.886275_0.952941_0.000000_0.000000" // Light gray
  | "0.647059_0.647059_0.647059_0.000000_0.000000" // Dark gray
  | "0.972549_0.529412_0.003922_0.000000_0.000000"; // Brown/wood

export type MaterialMap = Record<GltfMaterialKey, THREE.Material>;

/** Creates materials mapped to GLTF vertex color keys */
export const createMaterials = (): MaterialMap => ({
  // Gold/brass accent
  "0.980392_0.713725_0.003922_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#B8860B"),
      metalness: 1.0,
      roughness: 0.2,
      clearcoat: 0.3,
    }),
  // Off-white/cream (top casing) - less reflective
  "0.917647_0.917647_0.917647_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#E8E8E8"),
      metalness: 0.0,
      roughness: 0.6, // Higher = more matte
      clearcoat: 0.15, // Lower = less shiny top layer
      clearcoatRoughness: 0.4,
    }),
  // Silver metal
  "0.498039_0.498039_0.498039_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#C0C0C0"),
      metalness: 1.0,
      roughness: 0.15,
      clearcoat: 0.5,
    }),
  // Glass panel - transparent with reflections
  "0.615686_0.811765_0.929412_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#555555"),
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.5, // See through
      thickness: 0.1,
      transparent: true,
      ior: 1.5, // Glass refraction
      reflectivity: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.0,
    }),
  // Dark blue
  "0.231373_0.380392_0.705882_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#1a365d"),
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 0.8,
    }),
  // Light gray metal
  "0.768627_0.886275_0.952941_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#D4D4D4"),
      metalness: 0.9,
      roughness: 0.3,
    }),
  // Dark gray/charcoal
  "0.647059_0.647059_0.647059_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#1a1a1a"),
      metalness: 0.9,
      roughness: 0.3,
      clearcoat: 0.4,
    }),
  // Brown/wood
  "0.972549_0.529412_0.003922_0.000000_0.000000":
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#8B4513"),
      metalness: 0.0,
      roughness: 0.4,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    }),
});
