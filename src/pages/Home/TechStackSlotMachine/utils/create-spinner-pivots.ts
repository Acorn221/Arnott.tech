import * as THREE from 'three';

const SPINNER_AXIS_Y = -0.0038093519397079945;
const SPINNER_AXIS_Z = 0.0;

export const createSpinnerPivots = (
  scene: THREE.Object3D,
): Record<string, THREE.Object3D> => {
  const foundSpinners: Record<string, THREE.Object3D> = {};
  scene.traverse((object) => {
    if (/^slot-spinner-\d+$/.exec(object.name)) {
      foundSpinners[object.name] = object;
    }
  });

  const newPivots: Record<string, THREE.Object3D> = {};

  Object.entries(foundSpinners).forEach(([name, spinner]) => {
    const { parent } = spinner;
    if (!parent) return;

    if (parent.name === `${name}-pivot`) {
      newPivots[name] = parent;
      return;
    }

    const spinnerWorldPos = new THREE.Vector3();
    spinner.getWorldPosition(spinnerWorldPos);

    const spinnerModelPos = spinnerWorldPos.clone();
    scene.worldToLocal(spinnerModelPos);

    const pivotModelPos = new THREE.Vector3(spinnerModelPos.x, SPINNER_AXIS_Y, SPINNER_AXIS_Z);
    const pivotWorldPos = pivotModelPos.clone();
    scene.localToWorld(pivotWorldPos);

    const pivotParentPos = pivotWorldPos.clone();
    parent.worldToLocal(pivotParentPos);

    const pivot = new THREE.Group();
    pivot.name = `${name}-pivot`;
    pivot.position.copy(pivotParentPos);
    parent.add(pivot);

    const offset = spinner.position.clone().sub(pivotParentPos);
    parent.remove(spinner);
    pivot.add(spinner);
    spinner.position.copy(offset);

    newPivots[name] = pivot;
  });

  return newPivots;
};
