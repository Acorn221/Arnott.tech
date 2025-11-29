import { type FC, useRef, useEffect } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useSlotMachine } from "./SlotMachineContext";

interface FloatingLabelProps {
  text: string;
  subText: string;
  position: [number, number, number];
  color: string;
  delay: number;
  visible: boolean;
  rotationY?: number; // Base Y rotation to face camera
}

const FloatingLabel: FC<FloatingLabelProps> = ({
  text,
  subText,
  position,
  color,
  delay,
  visible,
  rotationY = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const startedRef = useRef(false);

  // Reset animation when visibility changes
  useEffect(() => {
    if (visible) {
      timeRef.current = 0;
      startedRef.current = false;
      if (groupRef.current) {
        groupRef.current.scale.setScalar(0);
      }
    }
  }, [visible]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // When not visible, keep scale at 0
    if (!visible) {
      groupRef.current.scale.setScalar(0);
      return;
    }

    timeRef.current += delta;

    // Delay before starting animation
    if (timeRef.current < delay) {
      groupRef.current.scale.setScalar(0);
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
    }

    const t = timeRef.current - delay;

    // Pop-in animation (0 to 0.4s)
    if (t < 0.4) {
      const progress = t / 0.4;
      // Elastic ease out
      const elastic =
        1 - 2 ** (-10 * progress) * Math.cos(progress * Math.PI * 1.5);
      groupRef.current.scale.setScalar(Math.max(0, elastic));
    } else {
      groupRef.current.scale.setScalar(1);
    }

    // Gentle floating motion
    const floatY = Math.sin(t * 1.5) * 0.0005;
    groupRef.current.position.y = position[1] + floatY;

    // Subtle rotation on top of base rotation
    groupRef.current.rotation.y = rotationY + Math.sin(t * 0.8) * 0.05;
  });

  // Keep mounted but scaled to 0 when not visible (avoids remount flash)
  return (
    <group ref={groupRef} position={position} scale={0}>
      {/* Main tech name */}
      <Text
        position={[0, 0, 0]}
        fontSize={0.004}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.0002}
        outlineColor="#000000"
      >
        {text}
        <meshBasicMaterial color={color} toneMapped={false} />
      </Text>

      {/* Category label below */}
      <Text
        position={[0, -0.005, 0]}
        fontSize={0.002}
        color="#888888"
        anchorX="center"
        anchorY="middle"
      >
        {subText}
      </Text>
    </group>
  );
};

const TechLabels: FC = () => {
  const { lastResult, isSpinningRef } = useSlotMachine();

  // Don't render if no result or still spinning
  const showLabels = lastResult && !isSpinningRef.current;

  if (!lastResult) {
    return null;
  }

  const { backend, frontend, database } = lastResult;

  // Positions: left, center, right - above each reel
  const positions: [number, number, number][] = [
    [-0.035, 0.012, 0.008], // Backend - left
    [0, 0.02, 0.008], // Frontend - center (slightly higher)
    [0.035, 0.012, 0.008], // Database - right
  ];

  // Color based on individual tech scores
  const getColor = (techScore: number) => {
    if (techScore >= 80) return "#4ADE80"; // Green
    if (techScore >= 60) return "#FBBF24"; // Yellow
    if (techScore >= 40) return "#F97316"; // Orange
    return "#EF4444"; // Red
  };

  return (
    <group>
      <FloatingLabel
        text={backend.shortName}
        subText="Backend"
        position={positions[0]}
        color={getColor(backend.baseScore)}
        delay={0}
        visible={!!showLabels}
        rotationY={0.3} // Rotate right to face camera
      />
      <FloatingLabel
        text={frontend.shortName}
        subText="Frontend"
        position={positions[1]}
        color={getColor(frontend.baseScore)}
        delay={0.15}
        visible={!!showLabels}
      />
      <FloatingLabel
        text={database.shortName}
        subText="Database"
        position={positions[2]}
        color={getColor(database.baseScore)}
        delay={0.3}
        visible={!!showLabels}
        rotationY={-0.3} // Rotate left to face camera
      />
    </group>
  );
};

export default TechLabels;
