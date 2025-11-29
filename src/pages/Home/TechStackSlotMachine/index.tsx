import { Canvas } from "@react-three/fiber";
import { type FC, type HTMLAttributes, Suspense } from "react";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  BakeShadows,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import InteractiveSlotMachine from "./interactive-slot-machine";
import { SlotMachineProvider } from "./SlotMachineContext";

/** 3D Scene content - must be inside Canvas */
const SlotMachineScene: FC = () => (
  <SlotMachineProvider>
    {/* Dark background for better glow contrast */}
    <color attach="background" args={["#030306"]} />

    <Environment files="/empty_warehouse_01_1k.hdr" background={false} />

    {/* Hemisphere light for ambient fill */}
    <hemisphereLight intensity={0.1} groundColor="#000" color="#111" />

    {/* Key light - main front light */}
    <spotLight
      position={[3, 4, 5]}
      angle={0.4}
      penumbra={0.5}
      intensity={0.8}
      color="#fff8f0"
      castShadow
      shadow-mapSize={[2048, 2048]}
      decay={0}
    />

    {/* Fill light - softer side light */}
    <spotLight
      position={[-4, 2, 3]}
      angle={0.5}
      penumbra={0.8}
      intensity={0.3}
      color="#e0f0ff"
      decay={0}
    />

    {/* Rim light - back highlight */}
    <pointLight
      position={[0, 3, -3]}
      intensity={0.2}
      color="#ffd700"
      decay={0}
    />

    {/* Bottom accent light for casino glow effect */}
    <pointLight
      position={[0, -1, 2]}
      intensity={0.15}
      color="#00FF88"
      decay={0}
    />

    {/* Contact shadows for grounding */}
    <ContactShadows
      position={[0, -0.8, 0]}
      opacity={0.7}
      scale={10}
      blur={2.5}
      far={4}
      color="#000"
    />

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
      <InteractiveSlotMachine position={[0, 0, 0]} scale={25} />
    </Suspense>

    {/* Bake shadows for performance */}
    <BakeShadows />

    {/* Post-processing effects */}
    <EffectComposer multisampling={8}>
      {/* Bloom - makes emissive glow (reduced for cleaner text) */}
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.5}
        mipmapBlur
      />
      {/* Vignette - darkens edges for cinematic focus */}
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  </SlotMachineProvider>
);

/** Main component with Canvas */
const TechStackSlotMachine: FC<HTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => (
  <div {...props}>
    <Canvas
      camera={{
        position: [0, 0.15, 1.8],
        fov: 55,
        near: 0.1,
        far: 100,
      }}
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <SlotMachineScene />
    </Canvas>
  </div>
);

export default TechStackSlotMachine;
