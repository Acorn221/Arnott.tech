import * as THREE from 'three';

export interface DisplayPlateConfig {
  text: string;
  subText?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  subTextColor?: string;
  backgroundColor?: string;
  emoji?: string;
}

const defaultConfig: Required<DisplayPlateConfig> = {
  text: 'SPIN TO WIN!',
  subText: '',
  fontSize: 58,
  fontFamily: '"Arial Black", "Impact", sans-serif',
  textColor: '#FFFFFF',
  subTextColor: '#888888',
  backgroundColor: '#0a0a0a',
  emoji: '',
};

// Dynamic display plate for runtime text updates
export class DynamicDisplayPlate {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  public material: THREE.MeshPhysicalMaterial;
  private config: Required<DisplayPlateConfig>;
  private isScoreMode: boolean = false;
  private scoreValue: number = 0;
  private scoreLabel: string = '';

  constructor(config: Partial<DisplayPlateConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 128;
    this.context = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 16;

    // Less reflective material - reduces bloom pickup
    this.material = new THREE.MeshPhysicalMaterial({
      map: this.texture,
      metalness: 0,
      roughness: 0.8,
      emissive: new THREE.Color('#000000'),
      emissiveIntensity: 0,
    });

    this.render();
  }

  setText(text: string, subText?: string): void {
    this.isScoreMode = false;
    this.config.text = text;
    if (subText !== undefined) {
      this.config.subText = subText;
    }
    this.render();
  }

  setConfig(config: Partial<DisplayPlateConfig>): void {
    this.config = { ...this.config, ...config };
    this.render();
  }

  /** Show a score result with styling - score+emoji on left, label on right */
  showScore(score: number, label: string, color: string, emoji: string): void {
    this.isScoreMode = true;
    this.scoreValue = score;
    this.scoreLabel = label;
    this.config.textColor = color;
    this.config.emoji = emoji;

    // Subtle glow - reduced intensity to avoid bloom
    this.material.emissive = new THREE.Color(color);
    this.material.emissiveIntensity = score > 70 ? 0.15 : score > 40 ? 0.05 : 0;

    this.render();
  }

  /** Reset to default spin message */
  reset(): void {
    this.isScoreMode = false;
    this.config.text = 'SPIN TO WIN!';
    this.config.subText = '';
    this.config.textColor = '#FFFFFF';
    this.config.subTextColor = '#888888';
    this.config.fontSize = 58;
    this.config.emoji = '';
    this.material.emissiveIntensity = 0;
    this.render();
  }

  /** Show spinning state */
  showSpinning(): void {
    this.isScoreMode = false;
    this.config.text = 'SPINNING...';
    this.config.subText = '';
    this.config.textColor = '#00FF88';
    this.config.fontSize = 54;
    this.material.emissive = new THREE.Color('#00FF88');
    this.material.emissiveIntensity = 0.1;
    this.render();
  }

  private render(): void {
    if (!this.context) return;

    const ctx = this.context;
    const { width, height } = this.canvas;
    const { backgroundColor, textColor, fontFamily } = this.config;

    // Clear canvas with dark background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (this.isScoreMode) {
      // Score mode: emoji + score on left, label on right
      const emoji = this.config.emoji;
      const scoreText = `${this.scoreValue}`;

      // Left side: emoji + score
      ctx.save();
      ctx.font = `bold 72px ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = textColor;
      ctx.fillText(`${emoji} ${scoreText}`, 24, height / 2);
      ctx.restore();

      // Right side: label
      ctx.save();
      ctx.font = `bold 36px ${fontFamily}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = textColor;
      ctx.fillText(this.scoreLabel, width - 24, height / 2);
      ctx.restore();
    } else {
      // Normal mode: centered text
      const { text, fontSize } = this.config;

      ctx.save();
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = textColor;
      ctx.fillText(text, width / 2, height / 2);
      ctx.restore();
    }

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}

// Factory function
export const createAnimatedDisplayPlate = (
  config: Partial<DisplayPlateConfig> = {},
): DynamicDisplayPlate => new DynamicDisplayPlate(config);
