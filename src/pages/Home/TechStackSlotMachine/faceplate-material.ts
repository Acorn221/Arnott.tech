import * as THREE from "three";

export interface BarberPoleFaceplateConfig {
  // Stripe geometry
  stripeWidth?: number;
  angle?: number; // Degrees

  // Stripe colors
  whiteColor?: string;
  blackColor?: string;

  // White stripe material properties (shiny)
  whiteRoughness?: number; // 0 = mirror, 1 = matte (default: 0.25)
  whiteMetalness?: number; // 0 = plastic, 1 = metal (default: 0.9)

  // Black stripe material properties (matte)
  blackRoughness?: number; // 0 = mirror, 1 = matte (default: 0.8)
  blackMetalness?: number; // 0 = plastic, 1 = metal (default: 0.2)

  // Overall material
  clearcoat?: number; // 0-1, glossy top layer (default: 0.4)
  envMapIntensity?: number; // Environment reflection strength (default: 1.5)
}

const defaultConfig: Required<BarberPoleFaceplateConfig> = {
  stripeWidth: 24,
  angle: 45,
  whiteColor: "#e8e8e8",
  blackColor: "#0a0a0a",

  // Shiny white stripes - slightly less reflective
  whiteRoughness: 0.35,
  whiteMetalness: 0.8,

  // Matte black stripes
  blackRoughness: 0.8,
  blackMetalness: 0.2,

  // Overall finish
  clearcoat: 0.3,
  envMapIntensity: 1.2,
};

/**
 * Creates diagonal stripe textures for barber pole effect
 * Uses a large texture with many stripes to avoid UV tiling issues
 */
/** Convert 0-1 value to hex grayscale color */
const toGray = (value: number): string => {
  const hex = Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${hex}${hex}`;
};

const createStripeTextures = (
  config: Required<BarberPoleFaceplateConfig>,
): {
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
} => {
  const size = 2048; // Large texture to avoid tiling
  const {
    stripeWidth,
    angle,
    whiteColor,
    blackColor,
    whiteRoughness,
    whiteMetalness,
    blackRoughness,
    blackMetalness,
  } = config;

  // Create canvases
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d")!;

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  const roughnessCtx = roughnessCanvas.getContext("2d")!;

  const metalnessCanvas = document.createElement("canvas");
  metalnessCanvas.width = size;
  metalnessCanvas.height = size;
  const metalnessCtx = metalnessCanvas.getContext("2d")!;

  // Calculate stripe pattern
  const angleRad = (angle * Math.PI) / 180;
  const stripeSpacing = stripeWidth * 2;

  // Draw diagonal stripes
  [colorCtx, roughnessCtx, metalnessCtx].forEach((ctx, mapIndex) => {
    ctx.save();

    // Fill with base (black stripe properties)
    if (mapIndex === 0) {
      ctx.fillStyle = blackColor;
    } else if (mapIndex === 1) {
      ctx.fillStyle = toGray(blackRoughness); // Black stripe roughness
    } else {
      ctx.fillStyle = toGray(blackMetalness); // Black stripe metalness
    }
    ctx.fillRect(0, 0, size, size);

    // Rotate around center and draw stripes
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angleRad);

    // Draw stripes covering a huge area (4x canvas size) to guarantee full coverage
    const coverage = size * 4;
    const numStripes = Math.ceil(coverage / stripeSpacing);

    for (let i = 0; i < numStripes; i++) {
      const x = -coverage / 2 + i * stripeSpacing;

      if (mapIndex === 0) {
        ctx.fillStyle = whiteColor; // White stripe color
      } else if (mapIndex === 1) {
        ctx.fillStyle = toGray(whiteRoughness); // White stripe roughness
      } else {
        ctx.fillStyle = toGray(whiteMetalness); // White stripe metalness
      }

      ctx.fillRect(x, -coverage / 2, stripeWidth, coverage);
    }

    ctx.restore();
  });

  // Create textures - NO tiling, single large texture
  const colorMap = new THREE.CanvasTexture(colorCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  const metalnessMap = new THREE.CanvasTexture(metalnessCanvas);

  // Clamp to edge to avoid any seams
  [colorMap, roughnessMap, metalnessMap].forEach((tex) => {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 16;
  });

  return { colorMap, roughnessMap, metalnessMap };
};

/**
 * Barber pole striped faceplate material
 * White stripes: metallic & reflective
 * Black stripes: matte
 */
export class AnimatedFaceplateMaterial {
  public material: THREE.MeshPhysicalMaterial;

  private config: Required<BarberPoleFaceplateConfig>;

  constructor(config: Partial<BarberPoleFaceplateConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    const { colorMap, roughnessMap, metalnessMap } = createStripeTextures(
      this.config,
    );

    this.material = new THREE.MeshPhysicalMaterial({
      map: colorMap,
      roughnessMap,
      metalnessMap,
      metalness: 1.0, // Controlled by metalnessMap
      roughness: 1.0, // Controlled by roughnessMap
      clearcoat: this.config.clearcoat,
      clearcoatRoughness: 0.2,
      envMapIntensity: this.config.envMapIntensity,
    });
  }

  // Keep interface compatible (no-op for static material)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  startAnimation(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  stopAnimation(): void {}

  dispose(): void {
    this.material.map?.dispose();
    this.material.roughnessMap?.dispose();
    this.material.metalnessMap?.dispose();
    this.material.dispose();
  }
}

export const createAnimatedFaceplate = (
  config: Partial<BarberPoleFaceplateConfig> = {},
): AnimatedFaceplateMaterial => new AnimatedFaceplateMaterial(config);
