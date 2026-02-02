import { Canvas } from "@react-three/fiber";
import {
  type FC,
  type HTMLAttributes,
  Suspense,
  useState,
  useRef,
  useCallback,
} from "react";
import { OrbitControls, Environment, BakeShadows } from "@react-three/drei";
import { EffectComposer, Vignette } from "@react-three/postprocessing";
import InteractiveSlotMachine from "./interactive-slot-machine";
import { SlotMachineProvider, type SpinResult } from "./SlotMachineContext";
import ShareDialog from "./ShareDialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addSpins, spendSpins, selectSpinCount, selectGamblingUnlocked } from "@/store/slices/gameSlice";
import { SPIN_COST, calculateSpinsWon } from "./config/gambling";

/** Main component with Canvas - Provider is INSIDE Canvas for R3F compatibility */
const TechStackSlotMachine: FC<HTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [dialogResult, setDialogResult] = useState<SpinResult | null>(null);

  const dispatch = useAppDispatch();
  const spinCount = useAppSelector(selectSpinCount);
  const gamblingUnlocked = useAppSelector(selectGamblingUnlocked);

  const handleAttemptSpin = useCallback(() => {
    if (spinCount < SPIN_COST) return false;
    dispatch(spendSpins(SPIN_COST));
    return true;
  }, [spinCount, dispatch]);

  const handleSpinComplete = useCallback((score: number) => {
    const winnings = calculateSpinsWon(score);
    if (winnings > 0) dispatch(addSpins(winnings));
  }, [dispatch]);

  const captureScreenshot = useCallback(() => {
    if (!canvasRef.current) return null;

    const sourceCanvas = canvasRef.current;

    // Create a canvas same size - overlay branding on existing space
    const brandedCanvas = document.createElement("canvas");
    brandedCanvas.width = sourceCanvas.width;
    brandedCanvas.height = sourceCanvas.height;

    const ctx = brandedCanvas.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/png");

    // Fill with black background first (no transparency)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, brandedCanvas.width, brandedCanvas.height);

    // Draw the original canvas on top
    ctx.drawImage(sourceCanvas, 0, 0);

    // Overlay branding bar at top (semi-transparent)
    const barHeight = 44;
    ctx.fillStyle = "rgba(5, 5, 10, 0.85)";
    ctx.fillRect(0, 0, brandedCanvas.width, barHeight);

    // Add subtle bottom border to the bar
    ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barHeight);
    ctx.lineTo(brandedCanvas.width, barHeight);
    ctx.stroke();

    // Add branding text
    const fontSize = Math.max(14, Math.floor(brandedCanvas.width / 40));
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Gradient text effect
    const gradient = ctx.createLinearGradient(0, 0, brandedCanvas.width, 0);
    gradient.addColorStop(0, "#00FF88");
    gradient.addColorStop(0.5, "#00AAFF");
    gradient.addColorStop(1, "#00FF88");
    ctx.fillStyle = gradient;

    ctx.fillText(
      "🎰 Tech Stack Slot Machine  •  a.rno.tt",
      brandedCanvas.width / 2,
      barHeight / 2,
    );

    return brandedCanvas.toDataURL("image/png");
  }, []);

  const openShareDialog = useCallback(
    (result: SpinResult) => {
      // Capture screenshot from canvas
      const dataUrl = captureScreenshot();
      if (dataUrl) {
        setScreenshot(dataUrl);
      }
      setDialogResult(result);
      setDialogOpen(true);
    },
    [captureScreenshot],
  );

  const closeShareDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return (
    <div {...props} className={`relative ${props.className ?? ""}`}>
      {/* Cost indicator when gambling is unlocked */}
      {gamblingUnlocked && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/80 px-3 py-1 rounded text-xs text-amber-400 font-medium">
          Cost: {SPIN_COST} spins per pull
        </div>
      )}
      <Canvas
        ref={canvasRef}
        camera={{
          position: [0, 0.15, 1.8],
          fov: 55,
          near: 0.1,
          far: 100,
        }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
      >
        {/* Provider MUST be inside Canvas for R3F reconciler */}
        <SlotMachineProvider
          onShareDialog={openShareDialog}
          captureScreenshot={captureScreenshot}
          onAttemptSpin={gamblingUnlocked ? handleAttemptSpin : undefined}
          onSpinComplete={gamblingUnlocked ? handleSpinComplete : undefined}
        >
          <Environment files="/empty_warehouse_01_1k.hdr" background={false} />

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
            {/* Vignette - darkens edges for cinematic focus */}
            <Vignette offset={0.3} darkness={0.5} />
          </EffectComposer>
        </SlotMachineProvider>
      </Canvas>

      {/* Share Dialog - outside Canvas */}
      <ShareDialog
        isOpen={dialogOpen}
        onClose={closeShareDialog}
        result={dialogResult}
        screenshot={screenshot}
      />
    </div>
  );
};

export default TechStackSlotMachine;
