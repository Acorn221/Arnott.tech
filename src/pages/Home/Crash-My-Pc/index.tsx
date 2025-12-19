import { useState } from "react";

export function CrashButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "rip">("idle");
  const [showDialog, setShowDialog] = useState(false);

  async function crashGPU() {
    setShowDialog(false);
    setStatus("loading");

    if (!navigator.gpu) {
      alert("WebGPU not supported - your PC lives another day");
      setStatus("idle");
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      if (!adapter) {
        alert("No GPU adapter found - saved by the hardware gods");
        setStatus("idle");
        return;
      }

      const device = await adapter.requestDevice();

      // The crash shader - astronomically long computation
      const shader = device.createShaderModule({
        code: `
					@group(0) @binding(0) var<storage, read_write> data: array<u32>;
					
					@compute @workgroup_size(256)
					fn main(@builtin(global_invocation_id) id: vec3<u32>) {
						var x = id.x;
						// Astronomically long loop - will timeout GPU watchdog
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
        size: 1024 * 1024 * 4, // 4MB
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

      // Dispatch an absurd amount of work
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(65535, 65535, 1); // Maximum dispatch
      pass.end();

      device.queue.submit([encoder.finish()]);

      setStatus("rip");
      console.log("RIP your GPU");
    } catch (error) {
      console.error("Failed to crash:", error);
      alert(`Crash failed: ${error}`);
      setStatus("idle");
    }
  }

  const handleButtonClick = () => {
    if (status === "idle") {
      setShowDialog(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <button
          className={
            status === "idle"
              ? "px-6 py-3 rounded-xl font-bold text-white transition-all duration-200 cursor-pointer shadow-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:scale-105 shadow-red-500/40"
              : status === "loading"
                ? "px-6 py-3 rounded-xl font-bold text-white transition-all duration-200 shadow-lg bg-gradient-to-r from-yellow-500 to-orange-500 cursor-wait"
                : "px-6 py-3 rounded-xl font-bold text-white transition-all duration-200 shadow-lg bg-gradient-to-r from-gray-700 to-gray-800 cursor-not-allowed"
          }
          disabled={status === "loading" || status === "rip"}
          onClick={handleButtonClick}
          type="button"
        >
          {status === "idle" ? "🔥 " : ""}
          {status === "idle"
            ? "Crash My PC"
            : status === "loading"
              ? "Initializing doom..."
              : "RIP"}
          {status === "idle" ? " 🔥" : ""}
          {status === "rip" ? " 💀" : ""}
        </button>
        <p className="text-xs text-red-400/70">
          {status === "rip"
            ? "Check if you can still read this..."
            : "⚠️ Requires WebGPU"}
        </p>
      </div>

      {/* Warning Dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-gradient-to-br from-red-950 to-gray-900 border-2 border-red-500 rounded-2xl p-8 max-w-md mx-4 shadow-2xl shadow-red-500/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-3xl font-bold text-red-500 mb-2">
                FINAL WARNING
              </h2>
              <p className="text-red-400 text-sm uppercase tracking-wider">
                Point of No Return
              </p>
            </div>

            <div className="space-y-4 mb-6 text-gray-300">
              <div className="bg-red-950/50 border border-red-800/50 rounded-lg p-4">
                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                  <span className="text-xl">💀</span> What Will Happen:
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>Your GPU will be pushed to its absolute limits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>
                      Your computer will likely freeze or become unresponsive
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>You may need to force restart your computer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500">•</span>
                    <span>Unsaved work WILL be lost</span>
                  </li>
                </ul>
              </div>

              <div className="bg-orange-950/50 border border-orange-800/50 rounded-lg p-4">
                <h3 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <span className="text-xl">🔥</span> Technical Details:
                </h3>
                <p className="text-sm">
                  This will dispatch a WebGPU compute shader with nested loops
                  totaling ~18 quintillion operations, designed to trigger GPU
                  watchdog timeouts.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                onClick={() => setShowDialog(false)}
                type="button"
              >
                Cancel (Smart Choice)
              </button>
              <button
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-200 shadow-lg shadow-red-500/50 animate-pulse"
                onClick={crashGPU}
                type="button"
              >
                💥 DO IT 💥
              </button>
            </div>

            <p className="text-xs text-red-400/60 text-center mt-4">
              This is your last chance. I take no responsibility for what
              happens next.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
