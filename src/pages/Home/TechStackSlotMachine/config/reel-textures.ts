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

  // Dark background (alternating slightly for visibility)
  ctx.fillStyle = faceIndex % 2 === 0 ? "#1a1a1a" : "#222222";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Icon - draw with original colors
  // Compensate for face aspect ratio (wider than tall on octagon)
  const img = loadedImages.get(tech.id);
  if (img) {
    // Draw icon taller than wide to counteract horizontal stretch on face
    const iconWidth = TEXTURE_SIZE * 0.5;
    const iconHeight = TEXTURE_SIZE * 0.65; // Taller to compensate for stretch

    ctx.save();
    ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    // Rotate 90 degrees for correct orientation on cylinder face
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -iconWidth / 2, -iconHeight / 2, iconWidth, iconHeight);
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

/**
 * Pick technologies ensuring unique icons.
 * When multiple techs share an icon, randomly pick one (preferring TS over JS).
 */
const pickUniqueIconTechs = (
  techs: Technology[],
  count: number,
): Technology[] => {
  // Group techs by their icon URL
  const byIcon = new Map<string, Technology[]>();
  for (const tech of techs) {
    const existing = byIcon.get(tech.icon) || [];
    existing.push(tech);
    byIcon.set(tech.icon, existing);
  }

  // For each icon group, pick one randomly (slightly prefer TS variants)
  const candidates: Technology[] = [];
  for (const group of byIcon.values()) {
    if (group.length === 1) {
      candidates.push(group[0]);
    } else {
      // Prefer TS variants slightly (70% chance if both exist)
      const tsVariant = group.find((t) => t.id.endsWith("-ts"));
      const jsVariant = group.find((t) => t.id.endsWith("-js"));

      if (tsVariant && jsVariant) {
        // Has both TS and JS - randomly pick with TS preference
        candidates.push(Math.random() < 0.7 ? tsVariant : jsVariant);
      } else {
        // Just pick randomly from the group
        candidates.push(group[Math.floor(Math.random() * group.length)]);
      }
    }
  }

  // Shuffle and pick requested count
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
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

  // Pick 8 techs with unique icons
  const currentTechs = pickUniqueIconTechs(allTechs, FACES_PER_REEL);

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

/** Get a random tech that's not currently displayed and has a unique icon */
export const getRandomUnusedTech = (
  manager: ReelTextureManager,
): Technology => {
  const usedIds = new Set(manager.currentTechs.map((t) => t.id));
  const usedIcons = new Set(manager.currentTechs.map((t) => t.icon));

  // Filter to techs not used AND with unique icons
  const unused = manager.allTechs.filter(
    (t) => !usedIds.has(t.id) && !usedIcons.has(t.icon),
  );

  if (unused.length === 0) {
    // Fallback: just avoid same ID
    const fallback = manager.allTechs.filter((t) => !usedIds.has(t.id));
    if (fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    // Last resort: return any random tech
    return manager.allTechs[
      Math.floor(Math.random() * manager.allTechs.length)
    ];
  }

  return unused[Math.floor(Math.random() * unused.length)];
};

/** Shuffle all faces with new random techs (unique icons) */
export const shuffleReel = (manager: ReelTextureManager) => {
  const newTechs = pickUniqueIconTechs(manager.allTechs, FACES_PER_REEL);

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
