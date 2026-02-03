import { useFrame } from "@react-three/fiber";
import { type MutableRefObject,type ReactNode, useRef } from "react";

interface HighSpeedRendererProps {
  children: ReactNode;
  speed: number | MutableRefObject<number>;
  speedThreshold?: number;
}

/**
 * High-speed renderer - monitors speed and tracks high-speed state.
 * Provides hysteresis to prevent flickering at the speed threshold.
 */
export const HighSpeedRenderer = ({
  children,
  speed,
  speedThreshold = 30,
}: HighSpeedRendererProps) => {
  const isHighSpeed = useRef(false);

  useFrame(() => {
    const spd = typeof speed === "number" ? speed : speed.current;
    const absSpd = Math.abs(spd);

    // Hysteresis to prevent flickering at threshold
    if (!isHighSpeed.current && absSpd > speedThreshold) {
      isHighSpeed.current = true;
    } else if (isHighSpeed.current && absSpd < speedThreshold - 5) {
      isHighSpeed.current = false;
    }

    // High-speed state tracked for potential future optimizations
  });

  return <>{children}</>;
};
