import { Canvas } from '@react-three/fiber';
import {
  FC, InputHTMLAttributes, Suspense, useState,
} from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import Spinner from './spinner';

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({ ...props }) => {
  const [spinCount, setSpinCount] = useState(0);

  return (
    <div
      {...props}
    >
      <div>
        Spins:
        {' '}
        {spinCount}
      </div>
      <Canvas
        camera={{ position: [0, 4, 0], fov: 24, rotation: [-Math.PI / 2, 0, 0] }}
        shadows
        gl={{ antialias: true }}
      >
        <Environment files="/empty_warehouse_01_1k.hdr" background={false} />

        {/* Base ambient light */}
        <ambientLight intensity={0.2} />

        {/* Main dramatic lighting */}
        {/* <spotLight
        position={[5, 5, 0]}
        angle={0.4}
        penumbra={1}
        intensity={1.5}
        castShadow
        color="#ffff00"
      /> */}

        {/* Colored rim lights for visual interest */}
        {/* <pointLight
        position={[-3, 3, 2]}
        intensity={0.8}
        color="#ff7777"
      /> */}

        {/* <pointLight
        position={[3, -3, 2]}
        intensity={0.8}
        color="#77ddff"
      /> */}

        {/* Add subtle bottom fill light */}
        {/* <pointLight
        position={[0, 0, -3]}
        intensity={0.4}
        color="#ffffff"
      /> */}

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 4}
        />

        {/* Scene content */}
        <Suspense fallback={null}>
          <Spinner
            position={[0, 0, 0]}
            scale={20}
            setSpinCount={setSpinCount}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default FidgetSpinner;
