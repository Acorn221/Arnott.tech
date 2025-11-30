import * as THREE from "three";

export const createHandlePivot = (
  scene: THREE.Object3D,
): THREE.Group | null => {
  let handleKnob: THREE.Object3D | undefined;
  let handleBody: THREE.Object3D | undefined;

  scene.traverse((object) => {
    if (object.name === "handle-knob") handleKnob = object;
    else if (object.name === "handle-body") handleBody = object;
  });

  if (!handleKnob || !handleBody) return null;

  const bodyParent = handleBody.parent;
  const knobParent = handleKnob.parent;
  if (!bodyParent || !knobParent) return null;

  const pivot = new THREE.Group();
  pivot.name = "handle-pivot";
  pivot.position.set(0.01969, 0, -0.01572);
  bodyParent.add(pivot);

  const bodyOffset = handleBody.position.clone().sub(pivot.position);
  const knobOffset = handleKnob.position.clone().sub(pivot.position);

  bodyParent.remove(handleBody);
  knobParent.remove(handleKnob);

  pivot.add(handleBody);
  pivot.add(handleKnob);

  handleBody.position.copy(bodyOffset);
  handleKnob.position.copy(knobOffset);

  return pivot;
};
