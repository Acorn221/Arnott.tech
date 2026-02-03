import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo,useRef } from "react";
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

const FloatingLabel = ({
  text,
  subText,
  position,
  color,
  delay,
  visible,
  rotationY = 0,
}: FloatingLabelProps) => {
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

/** Static button label */
interface ButtonLabelProps {
  text: string;
  position: [number, number, number];
  color: string;
  activeColor?: string;
  isActive?: boolean;
}

const ButtonLabel = ({
  text,
  position,
  color,
  activeColor,
  isActive = false,
}: ButtonLabelProps) => {
  const textRef = useRef<THREE.Mesh>(null);
  const currentColor = isActive && activeColor ? activeColor : color;

  return (
    <Text
      ref={textRef}
      position={position}
      fontSize={0.0018}
      color={currentColor}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.00015}
      outlineColor="#000000"
      rotation={[Math.PI / 2, 0, 0]} // Rotate to face up (model is rotated -90° on X)
    >
      {text}
      <meshBasicMaterial color={currentColor} toneMapped={false} />
    </Text>
  );
};

export const TechLabels = () => {
  const { lastResult, isSpinningRef } = useSlotMachine();

  // Don't render if no result or still spinning
  const showLabels = lastResult && !isSpinningRef.current;

  // Button label positions (in model space, before rotation)
  // These are approximate - adjust based on actual button positions
  const buttonPositions = useMemo(
    () => ({
      spin: [-0.022, -0.024, 0.003] as [number, number, number], // button-1 (left)
      share: [0.022, -0.024, 0.003] as [number, number, number], // button-2 (right)
    }),
    [],
  );

  return (
    <group>
      {/* Button labels - always visible */}
      <ButtonLabel
        text="SPIN"
        position={buttonPositions.spin}
        color="#AAAAAA"
        activeColor="#4ADE80"
        isActive={true}
      />
      <ButtonLabel
        text="SHARE"
        position={buttonPositions.share}
        color="#555555"
        activeColor="#00AAFF"
        isActive={!!lastResult}
      />

      {/* Tech result labels - only after spin */}
      {lastResult && (
        <>
          <FloatingLabel
            text={lastResult.backend.shortName}
            subText="Backend"
            position={[-0.015, 0.018, 0.006]}
            color={getColorForScore(lastResult.backend.baseScore)}
            delay={0}
            visible={!!showLabels}
            rotationY={0.2}
          />
          <FloatingLabel
            text={lastResult.frontend.shortName}
            subText="Frontend"
            position={[0, 0.025, 0.006]}
            color={getColorForScore(lastResult.frontend.baseScore)}
            delay={0.15}
            visible={!!showLabels}
          />
          <FloatingLabel
            text={lastResult.database.shortName}
            subText="Database"
            position={[0.015, 0.018, 0.006]}
            color={getColorForScore(lastResult.database.baseScore)}
            delay={0.3}
            visible={!!showLabels}
            rotationY={-0.2}
          />
        </>
      )}
    </group>
  );
};

// Color based on individual tech scores
const getColorForScore = (techScore: number) => {
  if (techScore >= 80) return "#4ADE80"; // Green
  if (techScore >= 60) return "#FBBF24"; // Yellow
  if (techScore >= 40) return "#F97316"; // Orange
  return "#EF4444"; // Red
};
