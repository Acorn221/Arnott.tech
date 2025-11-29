import { Canvas } from '@react-three/fiber';
import {
  type FC, type InputHTMLAttributes, Suspense, useState,
} from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import InteractiveSpinner from './interactive-spinner';

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({ ...props }) => {
  const [spinCount, setSpinCount] = useState(0);

  return (
    <div
      {...props}
    >
      <div className="flex w-full justify-center align-middle">
        {/* <div>
          <div className="circle-2 ml-4" />
        </div> */}
        <div className="m-auto">
          Spins:
          {' '}
          {spinCount}
        </div>
      </div>
      <Canvas
        camera={{ position: [0, 4, 0], fov: 24, rotation: [-Math.PI / 2, 0, 0] }}
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
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 4}
        />

        {/* Scene content */}
        <Suspense fallback={null}>
          <InteractiveSpinner
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
