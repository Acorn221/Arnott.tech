import { Canvas } from "@react-three/fiber";
import {
  type FC,
  type InputHTMLAttributes,
  Suspense,
  useState,
  useCallback,
  useRef,
} from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import InteractiveSpinner from "./interactive-spinner";
import { useSyncRoom } from "@/lib/sync";
import {
  encodeSpinnerEvent,
  decodeSpinnerEvent,
  spinnerStateComputer,
  spinnerConflictResolver,
  type SpinnerEvent,
} from "./spinner-codec";

// JSON message types (sync event for initial state sharing)
interface SyncJsonMessage {
  type: "sync";
  event: SpinnerEvent;
}

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const [spinCount, setSpinCount] = useState(0);

  // Current CRDT event
  const currentEventRef = useRef<SpinnerEvent | null>(null);

  // Ref for sendTo (to avoid circular dependency with handlePeerConnect)
  const sendToRef = useRef<((peerId: string, data: ArrayBuffer) => void) | null>(null);

  // Handle incoming messages from any transport
  // Note: time-sync is handled automatically by SyncCoordinator
  const handleMessage = useCallback((data: ArrayBuffer, peerId: string, timeOffset: number) => {
    // Try to decode as spinner event (binary)
    const event = decodeSpinnerEvent(data);
    if (event) {
      const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
        event,
        timeOffset,
      );

      if (
        spinnerConflictResolver.shouldReplace(
          currentEventRef.current,
          adjustedEvent,
          timeOffset,
        )
      ) {
        currentEventRef.current = adjustedEvent;
      }
      return;
    }

    // Try to decode as JSON sync message
    try {
      const text = new TextDecoder().decode(data);
      const jsonMsg = JSON.parse(text) as SyncJsonMessage;

      if (jsonMsg.type === "sync" && jsonMsg.event) {
        const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
          jsonMsg.event,
          timeOffset,
        );
        if (
          spinnerConflictResolver.shouldReplace(
            currentEventRef.current,
            adjustedEvent,
            timeOffset,
          )
        ) {
          currentEventRef.current = adjustedEvent;
        }
      }
    } catch {
      // Not JSON, ignore
    }
  }, []);

  // Handle new peer connections - send current state
  // Note: time-sync is handled automatically by SyncCoordinator
  const handlePeerConnect = useCallback((peerId: string) => {
    // Send current state if we have any
    const currentEvent = currentEventRef.current;
    if (currentEvent) {
      const syncMsg: SyncJsonMessage = {
        type: "sync",
        event: currentEvent,
      };
      const data = new TextEncoder().encode(JSON.stringify(syncMsg));
      sendToRef.current?.(peerId, data.buffer as ArrayBuffer);
    }
  }, []);

  const {
    broadcast,
    sendTo,
    isConnected,
    connectionState,
  } = useSyncRoom({
    roomId: "spinner",
    autoConnect: true,
    onMessage: handleMessage,
    onPeerConnect: handlePeerConnect,
  });

  // Store ref for use in callbacks
  sendToRef.current = sendTo;

  // Emit CRDT events to all peers (binary encoded)
  const handleEventEmit = useCallback(
    (event: SpinnerEvent) => {
      currentEventRef.current = event;

      // Broadcast to all peers (transport manager handles local tabs + remote)
      if (isConnected) {
        broadcast(encodeSpinnerEvent(event));
      }
    },
    [isConnected, broadcast],
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
    [handleEventEmit],
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
    [handleEventEmit],
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
    [handleEventEmit],
  );

  // isSynced = connected to room
  const isSynced = connectionState === "connected";

  return (
    <div {...props}>
      <div className="flex w-full justify-center align-middle gap-4 items-center">
        <div className="m-auto flex items-center gap-4">
          <span>Spins: {spinCount}</span>
          {isConnected && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Synced
            </span>
          )}
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
