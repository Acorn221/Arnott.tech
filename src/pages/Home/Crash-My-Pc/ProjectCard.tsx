import { useState, useRef } from "react";
import { XyzTransition } from "@animxyz/react";
import { Skull } from "lucide-react";

type Status = "idle" | "loading" | "rip";

const BUTTON_CLASSES = {
  base: "px-8 py-4 rounded-xl font-bold text-white transition-all duration-200 shadow-lg text-2xl",
  idle: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:scale-105 cursor-pointer",
  loading: "bg-gradient-to-r from-orange-600 to-red-600 cursor-wait",
  rip: "bg-gradient-to-r from-gray-900 to-black cursor-not-allowed text-gray-500",
} as const;

const BUTTON_TEXT = {
  idle: "Crash My PC",
  loading: "Initializing...",
  rip: "RIP",
} as const;

export function CrashProjectCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [showDialog, setShowDialog] = useState(false);
  const [showMeme, setShowMeme] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function crashGPU() {
    setShowDialog(false);
    setShowMeme(true);

    // Play the "to be continued" sound
    const audio = new Audio("/to-be-continued.mp3");
    audioRef.current = audio;
    audio.play();

    // Wait 3.8 seconds before executing the crash
    await new Promise((resolve) => setTimeout(resolve, 3800));

    setStatus("loading");

    if (!navigator.gpu) {
      alert("WebGPU not supported - your PC lives another day");
      setStatus("idle");
      setShowMeme(false);
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      if (!adapter) {
        alert("No GPU adapter found - saved by the hardware gods");
        setStatus("idle");
        setShowMeme(false);
        return;
      }

      const device = await adapter.requestDevice();

      const shader = device.createShaderModule({
        code: `
					@group(0) @binding(0) var<storage, read_write> data: array<u32>;
					
					@compute @workgroup_size(256)
					fn main(@builtin(global_invocation_id) id: vec3<u32>) {
						var x = id.x;
						for (var i = 0u; i < 4294967295u; i++) {
							x = x * 1103515245u + 12345u;
							for (var j = 0u; j < 4294967295u; j++) {
								x = x ^ (x << 13u);
								x = x ^ (x >> 17u);
								x = x ^ (x << 5u);
							}
						}
						data[id.x] = x;
					}
				`,
      });

      const buffer = device.createBuffer({
        size: 1024 * 1024 * 4,
        usage: GPUBufferUsage.STORAGE,
      });

      const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shader, entryPoint: "main" },
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }],
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(65535, 65535, 1);
      pass.end();

      device.queue.submit([encoder.finish()]);

      setStatus("rip");
    } catch (error) {
      console.error("Failed to crash:", error);
      alert(`Crash failed: ${error}`);
      setStatus("idle");
      setShowMeme(false);
    }
  }

  const handleButtonClick = () => {
    if (status === "idle") {
      setShowDialog(true);
    }
  };

  const buttonClassName = `${BUTTON_CLASSES.base} ${BUTTON_CLASSES[status]}`;
  const isDisabled = status === "loading" || status === "rip";

  return (
    <>
      <div className="flex flex-col bg-zinc-800/75 rounded-2xl">
        <XyzTransition appear xyz="fade in-out delay-8">
          <div className="w-64 mx-auto p-4 flex items-center justify-center">
            <Skull className="w-48 h-48 text-gray-400 stroke-[1.5]" />
          </div>
        </XyzTransition>

        <div className="text-3xl m-2">Crash My PC</div>

        <div className="flex justify-center align-middle">
          <div className="bg-white p-[2px] rounded-full w-9/12 mt-1 m-auto" />
        </div>

        <div className="md:text-2xl text-xl m-3 flex-1">
          A WebGPU powered button that will aim to crash your PC. This has been
          tested with my mac, message me if it doesn't work for you!
        </div>

        <div className="flex justify-center align-middle p-4 gap-4 flex-col">
          <button
            className={buttonClassName}
            disabled={isDisabled}
            onClick={handleButtonClick}
            type="button"
          >
            {BUTTON_TEXT[status]}
          </button>

          {status === "rip" && (
            <p className="text-sm text-gray-400 text-center animate-pulse">
              If you can still see this, your GPU survived... barely
            </p>
          )}
        </div>
      </div>

      {showDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-8 max-w-xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <div className="text-6xl mb-4">💀</div>
              <h2 className="text-3xl font-bold text-white mb-2">
                FINAL WARNING
              </h2>
              <div className="bg-white p-[2px] rounded-full w-1/3 mx-auto mt-3" />
            </div>

            <div className="flex flex-col mb-6">
              <div className="bg-zinc-900/50 rounded-xl p-5">
                <h3 className="text-xl font-bold mb-3 text-white">
                  What Could Happen:
                </h3>
                <ul className="space-y-2 text-gray-300">
                  <li>• Your GPU will be pushed to its absolute limits</li>
                  <li>
                    • Your computer will likely freeze or become unresponsive
                  </li>
                  <li>• You may need to force restart your computer</li>
                  <li>• Unsaved work WILL be lost</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <button
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-zinc-700/75 hover:bg-zinc-600/75 text-white transition-all duration-200 text-lg"
                onClick={() => setShowDialog(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-200 shadow-lg text-lg"
                onClick={crashGPU}
                type="button"
              >
                💀 DO IT 💀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* To Be Continued Meme Overlay */}
      {showMeme && (
        <div className="fixed inset-0 z-[200] bg-white flex items-end justify-end overflow-hidden">
          <img
            src="/to-be-continued-arrow.png"
            alt="To Be Continued"
            className="w-1/2 max-w-2xl"
            style={{
              animation: "slideInFromRight 1s ease-out forwards",
            }}
          />
          <style>{`
            @keyframes slideInFromRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
