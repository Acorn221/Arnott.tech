import { Canvas } from "@react-three/fiber";
import { FC, InputHTMLAttributes, Suspense } from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import InteractiveSlotMachine from "./interactive-slot-machine";

const TechStackSlotMachine: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  return (
    <div {...props}>
      <Canvas
        camera={{
          position: [0, 2, 4],
          fov: 24,
        }}
        shadows
        gl={{ antialias: true }}
      >
        <Environment files="/empty_warehouse_01_1k.hdr" background={false} />

        {/* Base ambient light */}
        <ambientLight intensity={0.2} />

        {/* Locks the camera where we want it */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 2.5}
        />

        {/* Scene content */}
        <Suspense fallback={null}>
          <InteractiveSlotMachine
            position={[0, 0, 0]}
            scale={35}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default TechStackSlotMachine;
