import { type FC } from 'react';
import TechStackSlotMachine from '../Home/TechStackSlotMachine';

const Dev: FC = () => (
  <div
    className="w-full h-screen flex items-center justify-center relative overflow-hidden"
    style={{
      background: 'radial-gradient(ellipse at center bottom, #1a0a2e 0%, #0d0d0d 50%, #000000 100%)',
    }}
  >
    {/* Subtle ambient glow effects */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'radial-gradient(circle at 30% 70%, rgba(255, 69, 0, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 30%, rgba(255, 215, 0, 0.06) 0%, transparent 35%)',
      }}
    />
    {/* Main container */}
    <div className="w-full max-w-4xl h-[500px] relative">
      <TechStackSlotMachine className="w-full h-full" />
    </div>
  </div>
);

export default Dev;
