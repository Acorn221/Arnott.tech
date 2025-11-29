import * as THREE from 'three';

// Material keys from the GLTF model (based on vertex colors)
export type GltfMaterialKey =
  | '0.980392_0.713725_0.003922_0.000000_0.000000'  // Gold/brass
  | '0.917647_0.917647_0.917647_0.000000_0.000000'  // Off-white
  | '0.498039_0.498039_0.498039_0.000000_0.000000'  // Silver
  | '0.615686_0.811765_0.929412_0.000000_0.000000'  // Glass/transparent
  | '0.231373_0.380392_0.705882_0.000000_0.000000'  // Dark blue
  | '0.768627_0.886275_0.952941_0.000000_0.000000'  // Light gray
  | '0.647059_0.647059_0.647059_0.000000_0.000000'  // Dark gray
  | '0.972549_0.529412_0.003922_0.000000_0.000000'; // Brown/wood

export type MaterialMap = Record<GltfMaterialKey, THREE.Material>;

/** Creates materials mapped to GLTF vertex color keys */
export const createMaterials = (): MaterialMap => ({
  // Gold/brass accent
  '0.980392_0.713725_0.003922_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#B8860B'),
    metalness: 1.0,
    roughness: 0.2,
    clearcoat: 0.3,
  }),
  // Off-white/cream
  '0.917647_0.917647_0.917647_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F5F5DC'),
    metalness: 0.0,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  }),
  // Silver metal
  '0.498039_0.498039_0.498039_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#C0C0C0'),
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.5,
  }),
  // Glass/transparent
  '0.615686_0.811765_0.929412_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E8F4F8'),
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.9,
    thickness: 0.3,
    transparent: true,
    opacity: 0.4,
  }),
  // Dark blue
  '0.231373_0.380392_0.705882_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a365d'),
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 0.8,
  }),
  // Light gray metal
  '0.768627_0.886275_0.952941_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D4D4D4'),
    metalness: 0.9,
    roughness: 0.3,
  }),
  // Dark gray/charcoal
  '0.647059_0.647059_0.647059_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a1a1a'),
    metalness: 0.9,
    roughness: 0.3,
    clearcoat: 0.4,
  }),
  // Brown/wood
  '0.972549_0.529412_0.003922_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#8B4513'),
    metalness: 0.0,
    roughness: 0.4,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  }),
});

/** Creates a textured material for spinner reels with icons */
export const createReelTextureMaterial = (icons: string[]): THREE.MeshPhysicalMaterial => {
  const segmentSize = 1024;
  const canvasWidth = icons.length * segmentSize;
  const canvasHeight = segmentSize;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;

  if (ctx) {
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw segments
    icons.forEach((_, i) => {
      const x = i * segmentSize;
      ctx.fillStyle = i % 2 === 0 ? '#f8f9fa' : '#e9ecef';
      ctx.fillRect(x, 0, segmentSize, canvasHeight);
      ctx.strokeStyle = '#dee2e6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    });

    // Load and draw icons
    let imagesLoaded = 0;
    icons.forEach((iconUrl, i) => {
      const img = new Image();
      img.src = iconUrl;
      img.onload = () => {
        const x = i * segmentSize;
        const iconSize = segmentSize * 0.8;
        const xOffset = (segmentSize - iconSize) / 2;
        const yOffset = (canvasHeight - iconSize) / 2;

        ctx.save();
        ctx.translate(x + xOffset + iconSize / 2, yOffset + iconSize / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.filter = 'grayscale(100%) brightness(0)';
        ctx.drawImage(img, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
        ctx.restore();

        imagesLoaded += 1;
        if (imagesLoaded === icons.length) {
          texture.needsUpdate = true;
        }
      };
    });
  }

  return new THREE.MeshPhysicalMaterial({
    map: texture,
    metalness: 0.1,
    roughness: 0.4,
    color: 0xffffff,
  });
};
