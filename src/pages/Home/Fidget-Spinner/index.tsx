import { Canvas } from '@react-three/fiber';
import {
  FC, InputHTMLAttributes, Suspense, useState, useEffect, useRef,
} from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import confetti from 'canvas-confetti';
import InteractiveSpinner from './interactive-spinner';
import { useUnlock } from '../../../contexts/UnlockContext';

const LINKEDIN_UNLOCK = 100;
const EMAIL_UNLOCK = 200;
const MILESTONES = [LINKEDIN_UNLOCK, EMAIL_UNLOCK];

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({ ...props }) => {
  const [spinCount, setSpinCount] = useState(0);
  const [lastMilestone, setLastMilestone] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const { unlockState, updateSpinCount, unlockLinkedIn, unlockEmail } = useUnlock();

  useEffect(() => {
    updateSpinCount(spinCount);
  }, [spinCount, updateSpinCount]);

  useEffect(() => {
    const currentMilestone = MILESTONES.find((milestone) => spinCount >= milestone && milestone > lastMilestone);

    if (currentMilestone) {
      setLastMilestone(currentMilestone);

      // Trigger unlock in context
      if (currentMilestone === LINKEDIN_UNLOCK) {
        unlockLinkedIn();
      } else if (currentMilestone === EMAIL_UNLOCK) {
        unlockEmail();
      }

      // Calculate the position of the fidget spinner on screen
      const spinnerContainer = document.querySelector('canvas');
      if (spinnerContainer) {
        const rect = spinnerContainer.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height * 0.8) / window.innerHeight;

        const confettiConfig = {
          particleCount: 100,
          spread: 70,
          origin: { x, y },
          colors: ['#DC143C', '#1E90FF', '#FF4500', '#4169E1'],
        };

        confetti(confettiConfig);
      }
    }
  }, [spinCount, lastMilestone, unlockLinkedIn, unlockEmail]);

  const { linkedinUnlocked, emailUnlocked } = unlockState;

  return (
    <div
      {...props}
      className={`${props.className || ''} relative`}
    >
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-sm">
          <div className="text-center text-sm text-gray-400 mb-1">
            Spins:
            {' '}
            {spinCount}
            {' '}
            | 💼
            {' '}
            {linkedinUnlocked ? '✓' : `linkedin unlock at ${LINKEDIN_UNLOCK}`}
            {linkedinUnlocked && ` | 📧 ${emailUnlocked ? '✓' : `email unlock at ${EMAIL_UNLOCK}`}`}
          </div>

        <div className="relative w-full bg-gray-800 rounded-full h-1">
          {!linkedinUnlocked ? (
            <div
              className="absolute top-0 left-0 h-1 bg-white rounded-full transition-all duration-300"
              style={{ width: `${(spinCount / LINKEDIN_UNLOCK) * 100}%` }}
            />
          ) : (
            <>
              <div className="absolute top-0 left-0 h-1 bg-white rounded-full w-full" />
              <div
                className="absolute top-0 left-0 h-1 bg-gray-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(((spinCount - LINKEDIN_UNLOCK) / LINKEDIN_UNLOCK) * 100, 100)}%` }}
              />
            </>
          )}
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
