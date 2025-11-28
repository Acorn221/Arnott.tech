import { Canvas } from '@react-three/fiber';
import { FC, InputHTMLAttributes, Suspense } from 'react';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import InteractiveSlotMachine from './interactive-slot-machine';

const TechStackSlotMachine: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => (
  <div {...props}>
    <Canvas
      camera={{
        position: [0, 1.0, 3.5],
        fov: 35,
      }}
      shadows
      gl={{ antialias: true }}
    >
      <Environment files="/empty_warehouse_01_1k.hdr" background={false} />

      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.3} color="#fff5e6" />

      {/* Key light - main front light */}
      <spotLight
        position={[3, 4, 5]}
        angle={0.4}
        penumbra={0.5}
        intensity={1.5}
        color="#fff8f0"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Fill light - softer side light */}
      <spotLight
        position={[-4, 2, 3]}
        angle={0.5}
        penumbra={0.8}
        intensity={0.8}
        color="#e0f0ff"
      />

      {/* Rim light - back highlight */}
      <pointLight
        position={[0, 3, -3]}
        intensity={0.6}
        color="#ffd700"
      />

      {/* Bottom accent light for casino glow effect */}
      <pointLight
        position={[0, -1, 2]}
        intensity={0.4}
        color="#ff6b35"
      />

      {/* Contact shadows for grounding */}
      <ContactShadows
        position={[0, -0.8, 0]}
        opacity={0.5}
        scale={10}
        blur={2}
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
        <InteractiveSlotMachine
          position={[0, 0, 0]}
          scale={30}
        />
      </Suspense>
    </Canvas>
  </div>
);

export default TechStackSlotMachine;
