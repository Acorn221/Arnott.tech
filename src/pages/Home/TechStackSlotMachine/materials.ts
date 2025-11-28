import * as THREE from 'three';

export const createMaterials = () => ({
  '0.980392_0.713725_0.003922_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#B8860B'),
    metalness: 1.0,
    roughness: 0.2,
    clearcoat: 0.3,
  }),
  '0.917647_0.917647_0.917647_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F5F5DC'),
    metalness: 0.0,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  }),
  '0.498039_0.498039_0.498039_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#C0C0C0'),
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.5,
  }),
  '0.615686_0.811765_0.929412_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E8F4F8'),
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.9,
    thickness: 0.3,
    transparent: true,
    opacity: 0.4,
  }),
  '0.231373_0.380392_0.705882_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a365d'),
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 0.8,
  }),
  '0.768627_0.886275_0.952941_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D4D4D4'),
    metalness: 0.9,
    roughness: 0.3,
  }),
  '0.647059_0.647059_0.647059_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a1a1a'),
    metalness: 0.9,
    roughness: 0.3,
    clearcoat: 0.4,
  }),
  '0.972549_0.529412_0.003922_0.000000_0.000000': new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#8B4513'),
    metalness: 0.0,
    roughness: 0.4,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  }),
});

export const createTextureMaterial = (icons: string[]) => {
  const numSegments = icons.length;
  const segmentSize = 1024;
  const canvasWidth = numSegments * segmentSize;
  const canvasHeight = segmentSize;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;

  if (context) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    let imagesLoaded = 0;

    icons.forEach((_, i) => {
      const x = i * segmentSize;
      context.fillStyle = i % 2 === 0 ? '#f8f9fa' : '#e9ecef';
      context.fillRect(x, 0, segmentSize, canvasHeight);
      context.strokeStyle = '#dee2e6';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
      context.stroke();
    });

    icons.forEach((iconUrl, i) => {
      const img = new Image();
      img.src = iconUrl;
      img.onload = () => {
        const x = i * segmentSize;
        const iconSize = segmentSize * 0.8;
        const xOffset = (segmentSize - iconSize) / 2;
        const yOffset = (canvasHeight - iconSize) / 2;

        context.save();
        context.translate(x + xOffset + iconSize / 2, yOffset + iconSize / 2);
        context.rotate(-Math.PI / 2);
        context.filter = 'grayscale(100%) brightness(0)';
        context.drawImage(img, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
        context.restore();

        imagesLoaded++;
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
