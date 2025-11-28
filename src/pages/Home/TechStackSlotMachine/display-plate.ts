import * as THREE from 'three';

export interface DisplayPlateConfig {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
}

const defaultConfig: Required<DisplayPlateConfig> = {
  text: 'SPIN TO WIN!',
  fontSize: 42,
  fontFamily: '"Arial Black", "Impact", sans-serif',
  textColor: '#FFFFFF',
  backgroundColor: '#0a0a0a',
};

// Draw simple, readable text
const drawSimpleText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
  fontFamily: string,
) => {
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Main text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
};

// Static display plate material - just text on dark background
export const createDisplayPlateMaterial = (config: Partial<DisplayPlateConfig> = {}): THREE.MeshPhysicalMaterial => {
  const mergedConfig = { ...defaultConfig, ...config };
  const {
    text,
    fontSize,
    fontFamily,
    textColor,
    backgroundColor,
  } = mergedConfig;

  const canvas = document.createElement('canvas');
  const canvasWidth = 512;
  const canvasHeight = 128;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;

  if (ctx) {
    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Simple readable text
    drawSimpleText(ctx, text, canvasWidth / 2, canvasHeight / 2, textColor, fontSize, fontFamily);

    texture.needsUpdate = true;
  }

  return new THREE.MeshPhysicalMaterial({
    map: texture,
    metalness: 0.1,
    roughness: 0.5,
  });
};

// Dynamic display plate for runtime text updates
export class DynamicDisplayPlate {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  public material: THREE.MeshPhysicalMaterial;
  private config: Required<DisplayPlateConfig>;

  constructor(config: Partial<DisplayPlateConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 128;
    this.context = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 16;

    this.material = new THREE.MeshPhysicalMaterial({
      map: this.texture,
      metalness: 0.1,
      roughness: 0.5,
    });

    this.render();
  }

  setText(text: string): void {
    this.config.text = text;
    this.render();
  }

  setConfig(config: Partial<DisplayPlateConfig>): void {
    this.config = { ...this.config, ...config };
    this.render();
  }

  private render(): void {
    if (!this.context) return;

    const ctx = this.context;
    const {
      text,
      fontSize,
      fontFamily,
      textColor,
      backgroundColor,
    } = this.config;

    const { width, height } = this.canvas;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Simple readable text
    drawSimpleText(ctx, text, width / 2, height / 2, textColor, fontSize, fontFamily);

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}

// Factory functions
export const createAnimatedDisplayPlate = (config: Partial<DisplayPlateConfig> = {}): DynamicDisplayPlate => new DynamicDisplayPlate(config);
