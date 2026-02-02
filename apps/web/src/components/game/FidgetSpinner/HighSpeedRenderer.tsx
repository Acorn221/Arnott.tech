import { useFrame } from "@react-three/fiber";
import {
  useRef,
  type FC,
  type ReactNode,
  type MutableRefObject,
} from "react";

interface HighSpeedRendererProps {
  children: ReactNode;
  speed: number | MutableRefObject<number>;
  speedThreshold?: number;
}

/**
 * High-speed renderer - monitors speed for future frame caching optimization.
 * Currently a placeholder that tracks high-speed state.
 */
export const HighSpeedRenderer: FC<HighSpeedRendererProps> = ({
  children,
  speed,
  speedThreshold = 30,
}) => {
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

    // TODO: Implement frame caching when isHighSpeed.current is true
  });

  return <>{children}</>;
};

export default HighSpeedRenderer;
