import * as THREE from 'three';

export interface DisplayPlateConfig {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  padding?: number;
}

const defaultConfig: Required<DisplayPlateConfig> = {
  text: 'SPIN TO WIN!',
  fontSize: 64,
  fontFamily: '"Impact", "Arial Black", sans-serif',
  textColor: '#FFD700',
  backgroundColor: '#1a1a1a',
  padding: 20,
};

export const createDisplayPlateMaterial = (config: Partial<DisplayPlateConfig> = {}): THREE.MeshPhysicalMaterial => {
  const {
    text,
    fontSize,
    fontFamily,
    textColor,
    backgroundColor,
    padding,
  } = { ...defaultConfig, ...config };

  const canvas = document.createElement('canvas');
  const canvasWidth = 512;
  const canvasHeight = 128;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;

  if (context) {
    // Background
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Optional gradient overlay for depth
    const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Text
    context.font = `bold ${fontSize}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Text shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.5)';
    context.shadowBlur = 4;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;

    // Gold gradient for text
    const textGradient = context.createLinearGradient(
      canvasWidth / 2 - 100,
      0,
      canvasWidth / 2 + 100,
      canvasHeight,
    );
    textGradient.addColorStop(0, '#FFD700');
    textGradient.addColorStop(0.5, '#FFF8DC');
    textGradient.addColorStop(1, '#DAA520');

    context.fillStyle = textGradient;
    context.fillText(text, canvasWidth / 2, canvasHeight / 2);

    // Outline for text
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = '#8B4513';
    context.lineWidth = 2;
    context.strokeText(text, canvasWidth / 2, canvasHeight / 2);

    texture.needsUpdate = true;
  }

  return new THREE.MeshPhysicalMaterial({
    map: texture,
    metalness: 0.3,
    roughness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });
};

// Create an updatable display plate that can change text dynamically
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
      metalness: 0.3,
      roughness: 0.4,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
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

    const {
      text,
      fontSize,
      fontFamily,
      textColor,
      backgroundColor,
    } = this.config;

    const { width, height } = this.canvas;

    // Clear and fill background
    this.context.fillStyle = backgroundColor;
    this.context.fillRect(0, 0, width, height);

    // Gradient overlay
    const gradient = this.context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);

    // Text setup
    this.context.font = `bold ${fontSize}px ${fontFamily}`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    // Shadow
    this.context.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.context.shadowBlur = 4;
    this.context.shadowOffsetX = 2;
    this.context.shadowOffsetY = 2;

    // Text gradient
    const textGradient = this.context.createLinearGradient(
      width / 2 - 100,
      0,
      width / 2 + 100,
      height,
    );
    textGradient.addColorStop(0, '#FFD700');
    textGradient.addColorStop(0.5, '#FFF8DC');
    textGradient.addColorStop(1, '#DAA520');

    this.context.fillStyle = textGradient;
    this.context.fillText(text, width / 2, height / 2);

    // Outline
    this.context.shadowBlur = 0;
    this.context.shadowOffsetX = 0;
    this.context.shadowOffsetY = 0;
    this.context.strokeStyle = '#8B4513';
    this.context.lineWidth = 2;
    this.context.strokeText(text, width / 2, height / 2);

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}

