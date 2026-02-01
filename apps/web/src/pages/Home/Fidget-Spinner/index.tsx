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

// Welcome spin velocity (radians/second) - a gentle spin to say hello
const WELCOME_SPIN_VELOCITY = 8;

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const [spinCount, setSpinCount] = useState(0);

  // Current CRDT event
  const currentEventRef = useRef<SpinnerEvent | null>(null);

  // Track current rotation for welcome spins
  const currentRotationRef = useRef(0);

  // Ref for broadcast function to avoid circular dependency
  const broadcastRef = useRef<((data: ArrayBuffer) => void) | null>(null);

  // Debounce welcome spins - only one per 5 seconds
  const lastWelcomeSpinRef = useRef(0);
  const WELCOME_SPIN_DEBOUNCE_MS = 5000;

  // Handle incoming messages from any transport
  // Time-sync is handled automatically by SyncCoordinator
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

  // Welcome spin when a new peer joins
  const handlePeerJoin = useCallback(
    (peerId: string, isLocal: boolean) => {
      console.log("[Spinner] New peer joined!", { peerId, isLocal });

      // Only trigger welcome spin for remote peers (not local tabs)
      if (isLocal) {
        return;
      }

      // Debounce - only one welcome spin per 5 seconds
      const now = performance.now();
      if (now - lastWelcomeSpinRef.current < WELCOME_SPIN_DEBOUNCE_MS) {
        console.log("[Spinner] Welcome spin debounced");
        return;
      }

      // Get current state
      const currentState = currentEventRef.current
        ? spinnerStateComputer.compute(currentEventRef.current, now)
        : spinnerStateComputer.initialState();

      // Only trigger welcome spin if spinner is nearly stopped
      if (Math.abs(currentState.velocity) > 2) {
        console.log("[Spinner] Spinner already moving, skipping welcome spin");
        return;
      }

      lastWelcomeSpinRef.current = now;

      // Trigger a welcome spin!
      const welcomeEvent: SpinnerEvent = {
        type: "release",
        timestamp: now,
        rotation: currentState.rotation,
        velocity: WELCOME_SPIN_VELOCITY,
      };

      currentEventRef.current = welcomeEvent;

      // Broadcast the welcome spin to all peers
      broadcastRef.current?.(encodeSpinnerEvent(welcomeEvent));
    },
    [],
  );

  const {
    broadcast,
    isConnected,
    connectionState,
  } = useSyncRoom({
    roomId: "spinner",
    autoConnect: true,
    onMessage: handleMessage,
    onPeerJoin: handlePeerJoin,
  });

  // Keep broadcast ref updated
  broadcastRef.current = broadcast;

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

  // Debug logging
  console.log("[Spinner] State:", { isConnected, connectionState, isSynced });

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
