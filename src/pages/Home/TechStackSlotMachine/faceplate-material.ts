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

  // Animation
  animationSpeed?: number; // Speed of stripe movement when spinning (default: 0.5)
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

  // Animation
  animationSpeed: 0.5,
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

/**
 * Creates a seamlessly tileable diagonal stripe pattern
 * For 45° stripes, we draw horizontal stripes then rotate the entire texture
 */
const createStripeTextures = (
  config: Required<BarberPoleFaceplateConfig>,
): {
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
} => {
  const {
    stripeWidth,
    whiteColor,
    blackColor,
    whiteRoughness,
    whiteMetalness,
    blackRoughness,
    blackMetalness,
  } = config;

  // For seamless tiling: create a small tileable pattern then tile it
  // Stripe pattern repeats every (stripeWidth * 2) pixels
  const stripeSpacing = stripeWidth * 2;

  // Make texture size a multiple of stripe spacing for perfect tiling
  // Use a reasonably large size that tiles well
  const tilesPerTexture = 16;
  const size = stripeSpacing * tilesPerTexture;

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

  // Draw diagonal stripes using a different technique:
  // Draw lines from corner to corner for perfect seamless tiling
  [colorCtx, roughnessCtx, metalnessCtx].forEach((ctx, mapIndex) => {
    // Fill with base color (black stripe)
    if (mapIndex === 0) {
      ctx.fillStyle = blackColor;
    } else if (mapIndex === 1) {
      ctx.fillStyle = toGray(blackRoughness);
    } else {
      ctx.fillStyle = toGray(blackMetalness);
    }
    ctx.fillRect(0, 0, size, size);

    // Set white stripe color
    if (mapIndex === 0) {
      ctx.fillStyle = whiteColor;
    } else if (mapIndex === 1) {
      ctx.fillStyle = toGray(whiteRoughness);
    } else {
      ctx.fillStyle = toGray(whiteMetalness);
    }

    // Draw diagonal stripes that tile seamlessly
    // For seamless 45° tiling, we draw stripes that wrap around
    const numStripes = tilesPerTexture * 2 + 2; // Extra to cover edges

    for (let i = -numStripes; i < numStripes; i++) {
      // Draw parallelogram for each stripe
      const startX = i * stripeSpacing;

      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + stripeWidth, 0);
      ctx.lineTo(startX + stripeWidth + size, size);
      ctx.lineTo(startX + size, size);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Create textures
  const colorMap = new THREE.CanvasTexture(colorCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  const metalnessMap = new THREE.CanvasTexture(metalnessCanvas);

  // Enable seamless repeat wrapping
  [colorMap, roughnessMap, metalnessMap].forEach((tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 16;
  });

  return { colorMap, roughnessMap, metalnessMap };
};

/** Smooth ease-in-out function (smoothstep) */
const easeInOut = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
};

// Animation timing constants
const EASE_IN_DURATION = 0.4; // Seconds to reach full speed
const EASE_OUT_DURATION = 0.4; // Quick stop to match reel stop

/**
 * Barber pole striped faceplate material
 * White stripes: metallic & reflective
 * Black stripes: matte
 * Animates stripes when spinning with smooth ease in/out!
 */
export class AnimatedFaceplateMaterial {
  public material: THREE.MeshPhysicalMaterial;

  private config: Required<BarberPoleFaceplateConfig>;

  private textures: THREE.CanvasTexture[] = [];

  private animationId: number | null = null;

  private isSpinning = false;

  private lastTime = 0;

  private offset = 0;

  // Easing state
  private spinStartTime = 0;

  private spinStopTime = 0;

  private currentSpeed = 0; // 0-1 multiplier for easing

  private wasSpinning = false;

  constructor(config: Partial<BarberPoleFaceplateConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    const { colorMap, roughnessMap, metalnessMap } = createStripeTextures(
      this.config,
    );

    // Store texture refs for animation
    this.textures = [colorMap, roughnessMap, metalnessMap];

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

    // Start animation loop (always running, but only moves when spinning)
    this.startAnimation();
  }

  /** Set spinning state - stripes animate when true */
  setSpinning(spinning: boolean): void {
    const now = performance.now() / 1000;

    if (spinning && !this.isSpinning) {
      // Starting to spin - begin ease in
      this.spinStartTime = now;
    } else if (!spinning && this.isSpinning) {
      // Stopping spin - begin ease out
      this.spinStopTime = now;
    }

    this.wasSpinning = this.isSpinning;
    this.isSpinning = spinning;
  }

  private animate = (): void => {
    const now = performance.now() / 1000;
    const delta = now - this.lastTime;
    this.lastTime = now;

    // Calculate eased speed multiplier
    if (this.isSpinning) {
      // Ease in
      const timeSinceStart = now - this.spinStartTime;
      const easeInProgress = Math.min(timeSinceStart / EASE_IN_DURATION, 1);
      this.currentSpeed = easeInOut(easeInProgress);
    } else if (this.currentSpeed > 0) {
      // Ease out (only if we were moving)
      const timeSinceStop = now - this.spinStopTime;
      const easeOutProgress = Math.min(timeSinceStop / EASE_OUT_DURATION, 1);
      this.currentSpeed = 1 - easeInOut(easeOutProgress);
    }

    // Apply movement with eased speed
    if (this.currentSpeed > 0.001) {
      const { animationSpeed } = this.config;

      // Move stripes diagonally (along the stripe direction for barber pole effect)
      this.offset += delta * animationSpeed * this.currentSpeed;

      // Keep offset in reasonable range to prevent floating point issues
      this.offset = this.offset % 1;

      // For 45° stripes, offset both U and V equally
      this.textures.forEach((tex) => {
        tex.offset.set(this.offset, this.offset);
      });
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  startAnimation(): void {
    if (this.animationId === null) {
      this.lastTime = performance.now() / 1000;
      this.animate();
    }
  }

  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  dispose(): void {
    this.stopAnimation();
    this.textures.forEach((tex) => tex.dispose());
    this.material.dispose();
  }
}

export const createAnimatedFaceplate = (
  config: Partial<BarberPoleFaceplateConfig> = {},
): AnimatedFaceplateMaterial => new AnimatedFaceplateMaterial(config);
