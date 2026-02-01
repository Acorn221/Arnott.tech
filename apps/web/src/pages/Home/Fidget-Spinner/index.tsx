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
import { useSyncRoom, type SyncMessage } from "@/lib/sync";
import {
  encodeSpinnerEvent,
  decodeSpinnerEvent,
  spinnerStateComputer,
  spinnerConflictResolver,
  type SpinnerEvent,
} from "./spinner-codec";

// JSON message types (binary used for spinner events)
type SpinnerJsonMessage =
  | { type: "sync"; event: SpinnerEvent }
  | { type: "time-sync"; localTime: number };

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const [spinCount, setSpinCount] = useState(0);

  // Current CRDT event
  const currentEventRef = useRef<SpinnerEvent | null>(null);

  // Refs for sendTo (to avoid circular dependency with handlePeerConnect)
  const sendToRef = useRef<((peerId: string, data: ArrayBuffer | string) => void) | null>(null);
  const setTimeOffsetRef = useRef<((peerId: string, offset: number) => void) | null>(null);

  // Handle incoming messages from any transport
  const handleMessage = useCallback((msg: SyncMessage) => {
    const { data, source } = msg;

    // Binary = spinner event (fast path)
    if (data instanceof ArrayBuffer) {
      const event = decodeSpinnerEvent(data);
      if (event) {
        // Time offset is already in source.timeOffset
        const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
          event,
          source.timeOffset,
        );

        if (
          spinnerConflictResolver.shouldReplace(
            currentEventRef.current,
            adjustedEvent,
            source.timeOffset,
          )
        ) {
          currentEventRef.current = adjustedEvent;
        }
      }
      return;
    }

    // JSON messages (time-sync, sync)
    const jsonMsg = data as SpinnerJsonMessage;

    if (jsonMsg.type === "time-sync") {
      // Calculate and store time offset for this peer
      const offset = performance.now() - jsonMsg.localTime;
      setTimeOffsetRef.current?.(source.peerId, offset);
      return;
    }

    if (jsonMsg.type === "sync" && jsonMsg.event) {
      const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
        jsonMsg.event,
        source.timeOffset,
      );
      if (
        spinnerConflictResolver.shouldReplace(
          currentEventRef.current,
          adjustedEvent,
          source.timeOffset,
        )
      ) {
        currentEventRef.current = adjustedEvent;
      }
    }
  }, []);

  // Handle new peer connections - exchange time sync and current state
  const handlePeerConnect = useCallback((peerId: string) => {
    // Send time sync for timestamp alignment
    const timeSyncMsg: SpinnerJsonMessage = {
      type: "time-sync",
      localTime: performance.now(),
    };
    sendToRef.current?.(peerId, JSON.stringify(timeSyncMsg));

    // Send current state if we have any
    const currentEvent = currentEventRef.current;
    if (currentEvent) {
      const syncMsg: SpinnerJsonMessage = {
        type: "sync",
        event: currentEvent,
      };
      sendToRef.current?.(peerId, JSON.stringify(syncMsg));
    }
  }, []);

  const {
    broadcast,
    sendTo,
    isConnected,
    connectionState,
    setTimeOffset,
  } = useSyncRoom({
    roomId: "spinner",
    autoConnect: true,
    onMessage: handleMessage,
    onPeerConnect: handlePeerConnect,
  });

  // Store refs for use in callbacks
  sendToRef.current = sendTo;
  setTimeOffsetRef.current = setTimeOffset;

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
