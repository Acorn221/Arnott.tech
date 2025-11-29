import * as THREE from 'three';

export interface GlowBorderConfig {
  color?: string;
  pulseSpeed?: number;
  minIntensity?: number;
  maxIntensity?: number;
  minOpacity?: number;
  maxOpacity?: number;
}

const defaultConfig: Required<GlowBorderConfig> = {
  color: '#00FF88',
  pulseSpeed: 2,
  minIntensity: 0.8,
  maxIntensity: 3.0,
  minOpacity: 1.0,
  maxOpacity: 1.0,
};

export class AnimatedGlowBorderMaterial {
  public material: THREE.MeshPhysicalMaterial;
  private config: Required<GlowBorderConfig>;
  private animationId: number | null = null;
  private startTime: number = 0;
  private isPaused: boolean = false;

  constructor(config: Partial<GlowBorderConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    const needsTransparency = this.config.minOpacity < 1.0 || this.config.maxOpacity < 1.0;

    // Dark base color, strong emissive glow
    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#050505'), // Very dark base - glow comes from emissive
      emissive: new THREE.Color(this.config.color),
      emissiveIntensity: this.config.maxIntensity,
      metalness: 0.1,
      roughness: 0.3,
      transparent: needsTransparency,
      opacity: this.config.maxOpacity,
    });

    this.startTime = performance.now() / 1000;
    this.startAnimation();
  }

  setColor(color: string): void {
    this.config.color = color;
    this.material.color = new THREE.Color(color);
    this.material.emissive = new THREE.Color(color);
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      // Fade to zero glow when paused
      this.material.emissiveIntensity = 0;
      this.material.opacity = this.config.minOpacity;
    }
  }

  private animate = (): void => {
    if (!this.isPaused) {
      const elapsed = performance.now() / 1000 - this.startTime;
      const {
        pulseSpeed, minIntensity, maxIntensity, minOpacity, maxOpacity,
      } = this.config;

      // Smooth sine wave pulse
      const pulse = (Math.sin(elapsed * pulseSpeed * Math.PI) + 1) / 2;
      const intensity = minIntensity + pulse * (maxIntensity - minIntensity);
      const opacity = minOpacity + pulse * (maxOpacity - minOpacity);

      this.material.emissiveIntensity = intensity;
      this.material.opacity = opacity;
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  startAnimation(): void {
    if (this.animationId === null) {
      this.startTime = performance.now() / 1000;
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
    this.material.dispose();
  }
}

export const createAnimatedGlowBorder = (config: Partial<GlowBorderConfig> = {}): AnimatedGlowBorderMaterial => new AnimatedGlowBorderMaterial(config);
