import * as THREE from "three";
import {
  type Technology,
  BACKEND_TECHNOLOGIES,
  FRONTEND_TECHNOLOGIES,
  DATABASE_TECHNOLOGIES,
  type ReelCategory,
} from "./technologies";

// ============================================================================
// Types
// ============================================================================

export interface FaceMaterial {
  material: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  currentTech: Technology;
}

export interface ReelTextureManager {
  faces: FaceMaterial[];
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

const TEXTURE_SIZE = 512;
const FACES_PER_REEL = 8;

// ============================================================================
// Texture Creation
// ============================================================================

/** Preload all images for a set of technologies */
const preloadImages = async (
  techs: Technology[],
): Promise<Map<string, HTMLImageElement>> => {
  const loadedImages = new Map<string, HTMLImageElement>();

  await Promise.all(
    techs.map(
      (tech) =>
        new Promise<void>((resolve) => {
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

/** Draw a single technology on a face canvas */
const drawFaceTexture = (
  ctx: CanvasRenderingContext2D,
  tech: Technology,
  loadedImages: Map<string, HTMLImageElement>,
  faceIndex: number,
) => {
  // DEBUG: Show face numbers instead of icons
  const DEBUG_SHOW_NUMBERS = false;

  // Dark background (alternating slightly for visibility)
  ctx.fillStyle = faceIndex % 2 === 0 ? "#1a1a1a" : "#222222";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  if (DEBUG_SHOW_NUMBERS) {
    // Draw big number in center
    ctx.save();
    ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 200px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(faceIndex + 1), 0, 0);
    ctx.restore();

    // Also show tech name smaller
    ctx.save();
    ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE - 60);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tech.shortName, 0, 0);
    ctx.restore();
    return;
  }

  // Icon - draw with original colors
  const img = loadedImages.get(tech.id);
  if (img) {
    const iconSize = TEXTURE_SIZE * 0.6;

    ctx.save();
    ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    // Rotate 90 degrees for correct orientation on cylinder face
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
    ctx.restore();
  }

  // Tech name at bottom - white text
  ctx.save();
  ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE - 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tech.shortName, 0, 0);
  ctx.restore();
};

/** Create a single face material */
const createFaceMaterial = (
  tech: Technology,
  loadedImages: Map<string, HTMLImageElement>,
  faceIndex: number,
): FaceMaterial => {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d")!;

  // Draw the tech icon
  drawFaceTexture(context, tech, loadedImages, faceIndex);

  // Create texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.needsUpdate = true;

  // Create material - fully matte for readability
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    metalness: 0,
    roughness: 1,
    color: 0xffffff,
    envMapIntensity: 0,
  });

  return {
    material,
    texture,
    canvas,
    context,
    currentTech: tech,
  };
};

/** Create a reel texture manager for a category */
export const createReelTextureManager = async (
  category: ReelCategory,
): Promise<ReelTextureManager> => {
  // Get all techs for this category
  let allTechs: Technology[];
  switch (category) {
    case "backend":
      allTechs = [...BACKEND_TECHNOLOGIES];
      break;
    case "frontend":
      allTechs = [...FRONTEND_TECHNOLOGIES];
      break;
    case "database":
      allTechs = [...DATABASE_TECHNOLOGIES];
      break;
    default:
      throw new Error(`Unknown category: ${category as string}`);
  }

  // Shuffle and pick initial 8
  const shuffled = [...allTechs].sort(() => Math.random() - 0.5);
  const currentTechs = shuffled.slice(0, FACES_PER_REEL);

  // Preload images
  const loadedImages = await preloadImages(allTechs);

  // Create face materials
  const faces = currentTechs.map((tech, i) =>
    createFaceMaterial(tech, loadedImages, i),
  );

  return {
    faces,
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
  const face = manager.faces[faceIndex];
  if (!face) return;

  drawFaceTexture(face.context, tech, manager.loadedImages, faceIndex);
  face.currentTech = tech;
  face.texture.needsUpdate = true;
  manager.currentTechs[faceIndex] = tech;
};

/** Get a random tech that's not currently displayed */
export const getRandomUnusedTech = (
  manager: ReelTextureManager,
): Technology => {
  const usedIds = new Set(manager.currentTechs.map((t) => t.id));
  const unused = manager.allTechs.filter((t) => !usedIds.has(t.id));

  if (unused.length === 0) {
    // All techs are displayed, just return a random one
    return manager.allTechs[
      Math.floor(Math.random() * manager.allTechs.length)
    ];
  }

  return unused[Math.floor(Math.random() * unused.length)];
};

/** Shuffle all faces with new random techs */
export const shuffleReel = (manager: ReelTextureManager) => {
  const shuffled = [...manager.allTechs].sort(() => Math.random() - 0.5);
  const newTechs = shuffled.slice(0, FACES_PER_REEL);

  newTechs.forEach((tech, i) => {
    updateReelFace(manager, i, tech);
  });
};

/** Get the technology at a specific face index */
export const getTechAtFace = (
  manager: ReelTextureManager,
  faceIndex: number,
): Technology => manager.currentTechs[faceIndex % FACES_PER_REEL];

/**
 * Detect which face is at front by checking world Z positions.
 * Uses bounding box center since face groups are at same origin.
 * The face with highest Z is facing the camera.
 * @param faceObjects - Map of faceIndex (0-7) to THREE.Object3D
 * @returns The index (0-7) of the face at front
 */
export const detectFrontFaceByPosition = (
  faceObjects: Map<number, THREE.Object3D>,
): number => {
  let maxZ = -Infinity;
  let frontFaceIndex = 0;

  faceObjects.forEach((obj, faceIndex) => {
    // Ensure world matrix is up to date after rotation
    obj.updateMatrixWorld(true);

    // Get bounding box center in world coordinates
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    if (center.z > maxZ) {
      maxZ = center.z;
      frontFaceIndex = faceIndex;
    }
  });

  return frontFaceIndex;
};

/**
 * DEPRECATED - Use detectFrontFaceByPosition instead.
 * Calculate which face is currently at the front based on rotation angle
 */
export const getFrontFaceIndex = (angle: number, _reelIndex = 0): number => {
  const radiansPerFace = (Math.PI * 2) / FACES_PER_REEL;
  // Normalize angle to 0-2π range
  const normalizedAngle =
    ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // Calculate raw face index
  const rawIndex = Math.round(normalizedAngle / radiansPerFace);
  const calculatedIndex = (FACES_PER_REEL - rawIndex) % FACES_PER_REEL;
  return calculatedIndex;
};

/** Get the faces that are hidden (safe to swap) based on current angle */
export const getHiddenFaces = (angle: number, reelIndex = 0): number[] => {
  const frontFace = getFrontFaceIndex(angle, reelIndex);
  const hidden: number[] = [];

  // Faces 3-5 positions away from front are hidden (back of cylinder)
  for (let offset = 3; offset <= 5; offset++) {
    hidden.push((frontFace + offset) % FACES_PER_REEL);
  }

  return hidden;
};

/** Get face material by index */
export const getFaceMaterial = (
  manager: ReelTextureManager,
  faceIndex: number,
): THREE.MeshStandardMaterial | null => {
  return manager.faces[faceIndex]?.material ?? null;
};
