import { useRef, useMemo, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AutoSpinEffectProps {
  active: boolean;
  /** Ref to parent group to read rotation for counter-rotation */
  parentRef?: MutableRefObject<THREE.Group | null>;
}

const PARTICLE_COUNT = 12;
const PARTICLE_SPEED = 0.15;
const PARTICLE_LIFETIME = 0.4; // seconds

/**
 * Wind/burst effect that plays when auto-spin triggers
 * Creates speed lines that spiral outward from the spinner
 */
export const AutoSpinEffect = ({ active, parentRef }: AutoSpinEffectProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const startTimeRef = useRef(PARTICLE_LIFETIME + 1); // Start past lifetime so no animation on load
  const wasActive = useRef(false);

  // Create a simple elongated shape for speed lines
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.002, 0.025);
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color("#00ffcc"),
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Initial transforms for each particle
  const initialData = useMemo(() => {
    const data = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      data.push({
        angle,
        startRadius: 0.02,
        rotationSpeed: 3 + Math.random() * 2,
      });
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    if (!particlesRef.current || !groupRef.current) return;

    // Counter-rotate to stay fixed in world space
    if (parentRef?.current) {
      groupRef.current.rotation.y = -parentRef.current.rotation.y;
    }

    // Detect rising edge of active
    if (active && !wasActive.current) {
      startTimeRef.current = 0;
    }
    wasActive.current = active;

    // Update each particle instance
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    // If not animating, hide all particles by scaling to 0
    if (!active && startTimeRef.current > PARTICLE_LIFETIME) {
      scale.set(0, 0, 0);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        matrix.compose(position, quaternion, scale);
        particlesRef.current.setMatrixAt(i, matrix);
      }
      particlesRef.current.instanceMatrix.needsUpdate = true;
      (particlesRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }

    startTimeRef.current += delta;
    const t = startTimeRef.current / PARTICLE_LIFETIME;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const { angle, startRadius, rotationSpeed } = initialData[i];

      // Spiral outward
      const currentAngle = angle + startTimeRef.current * rotationSpeed;
      const radius = startRadius + startTimeRef.current * PARTICLE_SPEED;

      position.set(
        Math.cos(currentAngle) * radius,
        0.015, // Slightly above spinner
        Math.sin(currentAngle) * radius
      );

      // Rotate to face outward direction
      quaternion.setFromEuler(
        new THREE.Euler(0, -currentAngle + Math.PI / 2, 0)
      );

      // Scale down as they move out, fade with time
      const fadeOut = Math.max(0, 1 - t);
      const stretch = 1 + t * 2; // Stretch as they speed up
      scale.set(fadeOut, stretch * fadeOut, 1);

      matrix.compose(position, quaternion, scale);
      particlesRef.current.setMatrixAt(i, matrix);
    }

    particlesRef.current.instanceMatrix.needsUpdate = true;

    // Update material opacity
    (particlesRef.current.material as THREE.MeshBasicMaterial).opacity =
      Math.max(0, 0.9 * (1 - t * 0.7));
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={particlesRef}
        args={[geometry, material, PARTICLE_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
};
