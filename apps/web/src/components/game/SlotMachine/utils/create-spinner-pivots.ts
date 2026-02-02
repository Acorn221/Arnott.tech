import * as THREE from "three";

/** Regex to match reel face groups: reel-[1-3]-face-[1-8] */
const REEL_FACE_REGEX = /^reel-(\d+)-face-(\d+)$/;

// Original pivot axis values (Y and Z stay constant, X varies per reel)
const SPINNER_AXIS_Y = -0.0038093519397079945;
const SPINNER_AXIS_Z = 0.0;

/**
 * Creates spinner pivots by finding all reel faces and grouping them by reel number.
 * Each reel's faces are placed under a new pivot group for rotation.
 */
export const createSpinnerPivots = (
  scene: THREE.Object3D,
): Record<string, THREE.Object3D> => {
  const newPivots: Record<string, THREE.Object3D> = {};

  // Find all reel face objects grouped by reel number
  const reelFaces: Record<string, THREE.Object3D[]> = {
    "1": [],
    "2": [],
    "3": [],
  };

  // First pass: collect all face objects
  scene.traverse((object) => {
    const match = REEL_FACE_REGEX.exec(object.name);
    if (match) {
      const reelNum = match[1];
      if (reelFaces[reelNum]) {
        // Get the "occurrence_of_" parent which is the actual positioned object
        const positionedParent = object.parent;
        if (positionedParent?.name.includes("occurrence")) {
          reelFaces[reelNum].push(positionedParent);
        } else {
          reelFaces[reelNum].push(object);
        }
      }
    }
  });

  // Create a pivot for each reel
  Object.entries(reelFaces).forEach(([reelNum, faces]) => {
    if (faces.length === 0) return;

    const spinnerName = `slot-spinner-${reelNum}`;

    // Calculate X position from faces (average), but use fixed Y and Z axis
    let avgX = 0;
    faces.forEach((face) => {
      avgX += face.position.x;
    });
    avgX /= faces.length;

    // Create pivot at the original axis position (fixed Y and Z, calculated X)
    const pivot = new THREE.Group();
    pivot.name = `${spinnerName}-pivot`;

    const localCenter = new THREE.Vector3(avgX, SPINNER_AXIS_Y, SPINNER_AXIS_Z);
    pivot.position.copy(localCenter);

    // Add pivot to scene
    scene.add(pivot);

    // Move all faces to be children of pivot (preserve original transforms)
    faces.forEach((face) => {
      // Store original local position before reparenting
      const originalPosition = face.position.clone();
      const originalRotation = face.rotation.clone();
      const originalScale = face.scale.clone();

      // Remove from current parent
      const oldParent = face.parent;
      oldParent?.remove(face);

      // Add to pivot
      pivot.add(face);

      // Calculate new local position relative to pivot
      face.position.copy(originalPosition).sub(localCenter);
      face.rotation.copy(originalRotation);
      face.scale.copy(originalScale);
    });

    newPivots[spinnerName] = pivot;
  });

  return newPivots;
};
