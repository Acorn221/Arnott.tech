import * as THREE from 'three';
import {
  Technology,
  BACKEND_TECHNOLOGIES,
  FRONTEND_TECHNOLOGIES,
  DATABASE_TECHNOLOGIES,
  ReelCategory,
} from './technologies';

// ============================================================================
// Types
// ============================================================================

export interface ReelTextureManager {
  material: THREE.MeshPhysicalMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  currentTechs: Technology[];
  allTechs: Technology[];
  loadedImages: Map<string, HTMLImageElement>;
}

export interface ReelState {
  /** Currently displayed technologies (8 faces) */
  displayedTechs: Technology[];
  /** Current rotation angle in radians */
  angle: number;
  /** The final selected technology (after spin stops) */
  selectedTech: Technology | null;
}

// ============================================================================
// Constants
// ============================================================================

const SEGMENT_SIZE = 1024;
const FACES_PER_REEL = 8;
const CANVAS_HEIGHT = SEGMENT_SIZE;
const CANVAS_WIDTH = FACES_PER_REEL * SEGMENT_SIZE;

// ============================================================================
// Texture Creation
// ============================================================================

/** Preload all images for a set of technologies */
const preloadImages = async (techs: Technology[]): Promise<Map<string, HTMLImageElement>> => {
  const loadedImages = new Map<string, HTMLImageElement>();

  await Promise.all(
    techs.map(
      (tech) => new Promise<void>((resolve) => {
        const img = new Image();
        img.src = tech.icon;
        img.onload = () => {
          loadedImages.set(tech.id, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load icon for ${tech.name}`);
          resolve();
        };
      }),
    ),
  );

  return loadedImages;
};

/** Draw a single technology face on the canvas */
const drawFace = (
  ctx: CanvasRenderingContext2D,
  faceIndex: number,
  tech: Technology,
  loadedImages: Map<string, HTMLImageElement>,
) => {
  const x = faceIndex * SEGMENT_SIZE;

  // Background (alternating for visibility)
  ctx.fillStyle = faceIndex % 2 === 0 ? '#f8f9fa' : '#e9ecef';
  ctx.fillRect(x, 0, SEGMENT_SIZE, CANVAS_HEIGHT);

  // Border
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, CANVAS_HEIGHT);
  ctx.stroke();

  // Icon
  const img = loadedImages.get(tech.id);
  if (img) {
    const iconSize = SEGMENT_SIZE * 0.7;
    const xOffset = (SEGMENT_SIZE - iconSize) / 2;
    const yOffset = (CANVAS_HEIGHT - iconSize) / 2;

    ctx.save();
    ctx.translate(x + xOffset + iconSize / 2, yOffset + iconSize / 2);
    ctx.rotate(-Math.PI / 2); // Rotate for cylinder orientation
    ctx.filter = 'grayscale(100%) brightness(0)'; // Black silhouette
    ctx.drawImage(img, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
    ctx.restore();
  }

  // Tech name at bottom
  ctx.save();
  ctx.translate(x + SEGMENT_SIZE / 2, CANVAS_HEIGHT - 80);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#333';
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tech.shortName, 0, 0);
  ctx.restore();
};

/** Create a reel texture manager for a category */
export const createReelTextureManager = async (
  category: ReelCategory,
): Promise<ReelTextureManager> => {
  // Get all techs for this category
  let allTechs: Technology[];
  switch (category) {
    case 'backend':
      allTechs = [...BACKEND_TECHNOLOGIES];
      break;
    case 'frontend':
      allTechs = [...FRONTEND_TECHNOLOGIES];
      break;
    case 'database':
      allTechs = [...DATABASE_TECHNOLOGIES];
      break;
    default:
      throw new Error(`Unknown category: ${category}`);
  }

  // Shuffle and pick initial 8
  const shuffled = [...allTechs].sort(() => Math.random() - 0.5);
  const currentTechs = shuffled.slice(0, FACES_PER_REEL);

  // Preload images
  const loadedImages = await preloadImages(allTechs);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext('2d')!;

  // Create texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;

  // Draw initial faces
  currentTechs.forEach((tech, i) => {
    drawFace(context, i, tech, loadedImages);
  });
  texture.needsUpdate = true;

  // Create material
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    metalness: 0.1,
    roughness: 0.4,
    color: 0xffffff,
  });

  return {
    material,
    texture,
    canvas,
    context,
    currentTechs,
    allTechs,
    loadedImages,
  };
};

/** Update a single face on the reel */
export const updateReelFace = (
  manager: ReelTextureManager,
  faceIndex: number,
  tech: Technology,
) => {
  drawFace(manager.context, faceIndex, tech, manager.loadedImages);
  manager.currentTechs[faceIndex] = tech;
  manager.texture.needsUpdate = true;
};

/** Get a random tech that's not currently displayed */
export const getRandomUnusedTech = (manager: ReelTextureManager): Technology => {
  const usedIds = new Set(manager.currentTechs.map((t) => t.id));
  const unused = manager.allTechs.filter((t) => !usedIds.has(t.id));

  if (unused.length === 0) {
    // All techs are displayed, just return a random one
    return manager.allTechs[Math.floor(Math.random() * manager.allTechs.length)];
  }

  return unused[Math.floor(Math.random() * unused.length)];
};

/** Shuffle all faces with new random techs */
export const shuffleReel = (manager: ReelTextureManager) => {
  const shuffled = [...manager.allTechs].sort(() => Math.random() - 0.5);
  const newTechs = shuffled.slice(0, FACES_PER_REEL);

  newTechs.forEach((tech, i) => {
    drawFace(manager.context, i, tech, manager.loadedImages);
    manager.currentTechs[i] = tech;
  });

  manager.texture.needsUpdate = true;
};

/** Get the technology at a specific face index */
export const getTechAtFace = (manager: ReelTextureManager, faceIndex: number): Technology => manager.currentTechs[faceIndex % FACES_PER_REEL];

/** Calculate which face is currently at the front based on rotation angle */
export const getFrontFaceIndex = (angle: number): number => {
  const radiansPerFace = (Math.PI * 2) / FACES_PER_REEL;
  // Normalize angle to 0-2π range
  const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // Calculate face index (inverted because of rotation direction)
  return Math.round(normalizedAngle / radiansPerFace) % FACES_PER_REEL;
};

/** Get the faces that are hidden (safe to swap) based on current angle */
export const getHiddenFaces = (angle: number): number[] => {
  const frontFace = getFrontFaceIndex(angle);
  const hidden: number[] = [];

  // Faces 3-5 positions away from front are hidden (back of cylinder)
  for (let offset = 3; offset <= 5; offset++) {
    hidden.push((frontFace + offset) % FACES_PER_REEL);
  }

  return hidden;
};

