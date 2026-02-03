import { createLogger } from "@arnott/logger";
import * as THREE from "three";

import {
  ALL_TECHNOLOGIES,
  BACKEND_TECHNOLOGIES,
  DATABASE_TECHNOLOGIES,
  FRONTEND_TECHNOLOGIES,
  type ReelCategory,
  type Technology,
} from "./technologies";

const log = createLogger("ui:reel-textures");

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
// Texture Pool (Pre-generated textures for performance)
// ============================================================================

interface PrerenderedTexture {
  texture: THREE.CanvasTexture;
}

// Two pools: one for even backgrounds, one for odd backgrounds
const texturePoolEven = new Map<string, PrerenderedTexture>();
const texturePoolOdd = new Map<string, PrerenderedTexture>();
let texturePoolInitialized = false;
let texturePoolInitializing = false;

// Shared loaded images for texture generation
let sharedLoadedImages: Map<string, HTMLImageElement> | null = null;

/** Pre-generate all face textures at startup */
export const initializeTexturePool = async (): Promise<void> => {
  if (texturePoolInitialized || texturePoolInitializing) return;
  texturePoolInitializing = true;

  const startTime = performance.now();

  // Load all images first
  sharedLoadedImages = await preloadImages(ALL_TECHNOLOGIES);

  // Generate textures for each technology (both backgrounds)
  for (const tech of ALL_TECHNOLOGIES) {
    // Even background
    const canvasEven = document.createElement("canvas");
    canvasEven.width = TEXTURE_SIZE;
    canvasEven.height = TEXTURE_SIZE;
    const ctxEven = canvasEven.getContext("2d")!;
    drawFaceTexture(ctxEven, tech, sharedLoadedImages, 0);
    const textureEven = new THREE.CanvasTexture(canvasEven);
    textureEven.anisotropy = 16;
    textureEven.needsUpdate = true;
    texturePoolEven.set(tech.name, { texture: textureEven });

    // Odd background
    const canvasOdd = document.createElement("canvas");
    canvasOdd.width = TEXTURE_SIZE;
    canvasOdd.height = TEXTURE_SIZE;
    const ctxOdd = canvasOdd.getContext("2d")!;
    drawFaceTexture(ctxOdd, tech, sharedLoadedImages, 1);
    const textureOdd = new THREE.CanvasTexture(canvasOdd);
    textureOdd.anisotropy = 16;
    textureOdd.needsUpdate = true;
    texturePoolOdd.set(tech.name, { texture: textureOdd });
  }

  texturePoolInitialized = true;
  texturePoolInitializing = false;

  const elapsed = performance.now() - startTime;
  log.info("Texture pool initialized", {
    count: ALL_TECHNOLOGIES.length * 2,
    timeMs: elapsed.toFixed(1),
  });
};

/** Check if texture pool is initialized */
export const isTexturePoolInitialized = (): boolean => texturePoolInitialized;

/** Get pre-rendered texture for a technology */
const getPrerenderedTexture = (
  tech: Technology,
  faceIndex: number,
): PrerenderedTexture | undefined => {
  const pool = faceIndex % 2 === 0 ? texturePoolEven : texturePoolOdd;
  return pool.get(tech.name);
};

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
            log.warn("Failed to load tech icon", { techName: tech.name, icon: tech.icon });
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
  // Dark background (alternating slightly for visibility)
  ctx.fillStyle = faceIndex % 2 === 0 ? "#1a1a1a" : "#222222";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Icon - draw with original colors
  const img = loadedImages.get(tech.id);
  if (img) {
    const iconWidth = TEXTURE_SIZE * 0.5;
    const iconHeight = TEXTURE_SIZE * 0.65;

    ctx.save();
    ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -iconWidth / 2, -iconHeight / 2, iconWidth, iconHeight);
    ctx.restore();
  }

  // Tech name at bottom
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

  // Use pre-rendered texture if available
  const prerendered = getPrerenderedTexture(tech, faceIndex);

  // Create material
  const material = new THREE.MeshStandardMaterial({
    map: prerendered?.texture ?? texture,
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
 */
const pickUniqueIconTechs = (
  techs: Technology[],
  count: number,
): Technology[] => {
  const byIcon = new Map<string, Technology[]>();
  for (const tech of techs) {
    const existing = byIcon.get(tech.icon) || [];
    existing.push(tech);
    byIcon.set(tech.icon, existing);
  }

  const candidates: Technology[] = [];
  for (const group of byIcon.values()) {
    if (group.length === 1) {
      candidates.push(group[0]);
    } else {
      const tsVariant = group.find((t) => t.id.endsWith("-ts"));
      const jsVariant = group.find((t) => t.id.endsWith("-js"));

      if (tsVariant && jsVariant) {
        candidates.push(Math.random() < 0.7 ? tsVariant : jsVariant);
      } else {
        candidates.push(group[Math.floor(Math.random() * group.length)]);
      }
    }
  }

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

/** Create a reel texture manager for a category */
export const createReelTextureManager = async (
  category: ReelCategory,
): Promise<ReelTextureManager> => {
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

  const currentTechs = pickUniqueIconTechs(allTechs, FACES_PER_REEL);
  const loadedImages = await preloadImages(allTechs);

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

  // Use pre-rendered texture if available (swap reference - no canvas ops)
  const prerendered = getPrerenderedTexture(tech, faceIndex);
  if (prerendered) {
    face.material.map = prerendered.texture;
    face.material.needsUpdate = true;
    face.currentTech = tech;
    manager.currentTechs[faceIndex] = tech;
  } else {
    // Fallback: draw texture (happens before pool is initialized)
    drawFaceTexture(face.context, tech, manager.loadedImages, faceIndex);
    face.currentTech = tech;
    face.texture.needsUpdate = true;
    manager.currentTechs[faceIndex] = tech;
  }
};

/** Get a random tech that's not currently displayed and has a unique icon */
export const getRandomUnusedTech = (
  manager: ReelTextureManager,
): Technology => {
  const usedIds = new Set(manager.currentTechs.map((t) => t.id));
  const usedIcons = new Set(manager.currentTechs.map((t) => t.icon));

  const unused = manager.allTechs.filter(
    (t) => !usedIds.has(t.id) && !usedIcons.has(t.icon),
  );

  if (unused.length === 0) {
    const fallback = manager.allTechs.filter((t) => !usedIds.has(t.id));
    if (fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
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
 */
export const detectFrontFaceByPosition = (
  faceObjects: Map<number, THREE.Object3D>,
): number => {
  let maxZ = -Infinity;
  let frontFaceIndex = 0;

  faceObjects.forEach((obj, faceIndex) => {
    obj.updateMatrixWorld(true);

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
 * Calculate which face is currently at the front based on rotation angle.
 */
const getFrontFaceIndex = (angle: number): number => {
  const radiansPerFace = (Math.PI * 2) / FACES_PER_REEL;
  const normalizedAngle =
    ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const rawIndex = Math.round(normalizedAngle / radiansPerFace);
  const calculatedIndex = (FACES_PER_REEL - rawIndex) % FACES_PER_REEL;
  return calculatedIndex;
};

/** Get the faces that are hidden (safe to swap) based on current angle */
export const getHiddenFaces = (angle: number): number[] => {
  const frontFace = getFrontFaceIndex(angle);
  const hidden: number[] = [];

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
