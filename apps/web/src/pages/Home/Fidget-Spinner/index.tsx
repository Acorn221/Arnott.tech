import { Canvas } from "@react-three/fiber";
import { type FC, type InputHTMLAttributes, Suspense, useState, useCallback, useRef, useEffect } from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import InteractiveSpinner from "./interactive-spinner";
import { useWebRTCRoom } from "@/hooks/useWebRTCRoom";
import {
  encodeSpinnerEvent,
  decodeSpinnerEvent,
  spinnerStateComputer,
  spinnerConflictResolver,
  type SpinnerEvent,
} from "./spinner-codec";

// JSON message types (binary used for spinner events)
type SpinnerMessage =
  | { type: "sync"; event: SpinnerEvent }
  | { type: "time-sync"; localTime: number };

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const [spinCount, setSpinCount] = useState(0);
  const timeOffsetsRef = useRef<Map<string, number>>(new Map());

  // Current CRDT event
  const currentEventRef = useRef<SpinnerEvent | null>(null);
  const timeOffsetRef = useRef(0);

  // Create refs for WebRTC methods to avoid circular deps
  const webrtcRef = useRef<{
    sendTo: (peerId: string, data: unknown) => void;
    broadcast: (data: unknown) => void;
  } | null>(null);

  // Handle incoming CRDT messages
  const handleMessage = useCallback((peerId: string, data: unknown) => {
    // Binary spinner events (fast path)
    if (data instanceof ArrayBuffer) {
      const event = decodeSpinnerEvent(data);
      if (event) {
        // Apply time offset
        const offset = timeOffsetsRef.current.get(peerId) ?? 0;
        const adjustedEvent = spinnerConflictResolver.adjustTimestamp(event, offset);

        if (spinnerConflictResolver.shouldReplace(currentEventRef.current, adjustedEvent, offset)) {
          currentEventRef.current = adjustedEvent;
        }
      }
      return;
    }

    // JSON messages (time-sync, sync)
    const msg = data as SpinnerMessage;

    if (msg.type === "time-sync") {
      const offset = performance.now() - msg.localTime;
      timeOffsetsRef.current.set(peerId, offset);
      // Use average offset
      const offsets = Array.from(timeOffsetsRef.current.values());
      timeOffsetRef.current = offsets.reduce((a, b) => a + b, 0) / offsets.length;
      return;
    }

    if (msg.type === "sync" && msg.event) {
      const offset = timeOffsetsRef.current.get(peerId) ?? 0;
      const adjustedEvent = spinnerConflictResolver.adjustTimestamp(msg.event, offset);
      if (spinnerConflictResolver.shouldReplace(currentEventRef.current, adjustedEvent, offset)) {
        currentEventRef.current = adjustedEvent;
      }
    }
  }, []);

  // Handle new peer connections
  const handlePeerConnect = useCallback((peerId: string) => {
    webrtcRef.current?.sendTo(peerId, {
      type: "time-sync",
      localTime: performance.now(),
    } as SpinnerMessage);

    const currentEvent = currentEventRef.current;
    if (currentEvent) {
      webrtcRef.current?.sendTo(peerId, {
        type: "sync",
        event: currentEvent,
      } as SpinnerMessage);
    }
  }, []);

  const { join, leave, broadcast, sendTo, isConnected, peerCount } = useWebRTCRoom({
    roomId: "spinner",
    onMessage: handleMessage,
    onPeerConnect: handlePeerConnect,
  });

  // Store webrtc methods in ref
  useEffect(() => {
    webrtcRef.current = { sendTo, broadcast };
  }, [sendTo, broadcast]);

  // Emit CRDT events to all peers (binary encoded)
  const handleEventEmit = useCallback(
    (event: SpinnerEvent) => {
      currentEventRef.current = event;
      if (isConnected) {
        broadcast(encodeSpinnerEvent(event));
      }
    },
    [isConnected, broadcast]
  );

  // Compute state from current event
  const computeState = useCallback((now: number) => {
    const event = currentEventRef.current;
    if (!event) {
      return spinnerStateComputer.initialState();
    }
    return spinnerStateComputer.compute(event, now);
  }, []);

  // CRDT action methods
  const grab = useCallback(
    (rotation: number) => {
      handleEventEmit({
        type: "grab",
        timestamp: performance.now(),
        rotation,
      });
    },
    [handleEventEmit]
  );

  const drag = useCallback(
    (rotation: number, velocity: number) => {
      handleEventEmit({
        type: "drag",
        timestamp: performance.now(),
        rotation,
        velocity,
      });
    },
    [handleEventEmit]
  );

  const release = useCallback(
    (rotation: number, velocity: number) => {
      handleEventEmit({
        type: "release",
        timestamp: performance.now(),
        rotation,
        velocity,
      });
    },
    [handleEventEmit]
  );

  const toggleRoom = useCallback(() => {
    if (isConnected) {
      void leave();
    } else {
      void join();
    }
  }, [isConnected, join, leave]);

  // isSynced = connected to room
  const isSynced = isConnected;

  return (
    <div {...props}>
      <div className="flex w-full justify-center align-middle gap-4 items-center">
        <div className="m-auto flex items-center gap-3">
          <span>Spins: {spinCount}</span>
          <button
            onClick={toggleRoom}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              isConnected
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
            }`}
            title={isConnected ? `Connected (${peerCount} peers)` : "Join room"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {isConnected && peerCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-xs bg-green-500 text-white rounded-full">
                {peerCount}
              </span>
            )}
          </button>
        </div>
      </div>
      <Canvas
        camera={{
          position: [0, 4, 0],
          fov: 24,
          rotation: [-Math.PI / 2, 0, 0],
        }}
        shadows
        gl={{ antialias: true }}
      >
        <Environment files="/empty_warehouse_01_1k.hdr" background={false} />
        <ambientLight intensity={0.2} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 4}
        />
        <Suspense fallback={null}>
          <InteractiveSpinner
            position={[0, 0, 0]}
            scale={20}
            setSpinCount={setSpinCount}
            computeState={computeState}
            onGrab={grab}
            onDrag={drag}
            onRelease={release}
            isSynced={isSynced}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default FidgetSpinner;
