# Sync Message Flows

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER A                                       │
│                                                                              │
│  ┌──────────────┐    BroadcastChannel    ┌──────────────┐                   │
│  │  Tab A1      │◄─────────────────────►│  Tab A2      │                   │
│  │  (LEADER)    │                        │  (FOLLOWER)  │                   │
│  │              │                        │              │                   │
│  │ ┌──────────┐ │                        │ ┌──────────┐ │                   │
│  │ │Signaling │ │                        │ │Broadcast │ │                   │
│  │ │Transport │ │                        │ │Only      │ │                   │
│  │ └────┬─────┘ │                        │ └──────────┘ │                   │
│  └──────┼───────┘                        └──────────────┘                   │
│         │                                                                    │
└─────────┼────────────────────────────────────────────────────────────────────┘
          │
          │ WebSocket (signaling + relay fallback)
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIGNALING SERVER                                     │
│                                                                              │
│  - Tracks peers in each room                                                │
│  - Relays WebRTC signaling (offer/answer/ice)                               │
│  - Relays binary data to peers without WebRTC                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          │ WebSocket / WebRTC P2P
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER B                                       │
│                                                                              │
│  ┌──────────────┐                                                           │
│  │  Tab B1      │  (Leader in its browser)                                  │
│  │  (PEER)      │                                                           │
│  └──────────────┘                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Transport Layers

### Layer 1: BroadcastChannel (Local Tabs)
- **Latency**: ~1ms
- **Scope**: Same browser, same origin
- **Used for**: Tab-to-tab sync within one browser
- **Handled by**: `BroadcastTransport`

### Layer 2: WebRTC Data Channel (P2P)
- **Latency**: ~50-150ms depending on network
- **Scope**: Cross-browser, cross-network
- **Used for**: Direct peer-to-peer communication
- **Handled by**: `SignalingTransport`

### Layer 3: WebSocket Relay (Fallback)
- **Latency**: ~100-300ms (through server)
- **Scope**: Cross-browser, cross-network
- **Used for**: When WebRTC fails (firewall, symmetric NAT)
- **Handled by**: `SignalingTransport` via server relay

---

## Local Tab Flows (WORKING ✅)

### Flow 1: Leader broadcasts to followers
```
Tab A1 (Leader)               Tab A2 (Follower)
    │                              │
    │──── broadcast() ────────────►│ ✅ via BroadcastChannel
```

### Flow 2: Follower broadcasts to leader
```
Tab A2 (Follower)             Tab A1 (Leader)
    │                              │
    │──── broadcast() ────────────►│ ✅ via BroadcastChannel
```

---

## Cross-Browser Relay Flows (FIXED ✅)

### Flow 3: Leader relays follower → remote
```
Tab A2 (Follower)             Tab A1 (Leader)              Browser B
    │                              │                            │
    │──── broadcast() ────────────►│ via BroadcastChannel       │
    │                              │                            │
    │                              │──── relay() ──────────────►│ via WebRTC/WS
```

### Flow 4: Leader relays remote → followers
```
Browser B                     Tab A1 (Leader)              Tab A2 (Follower)
    │                              │                            │
    │──── message ────────────────►│ via WebRTC/WS              │
    │                              │                            │
    │                              │──── relay() ──────────────►│ via Broadcast
```

---

## WebRTC vs WebSocket Flows

### Flow 5: WebRTC established (happy path)
```
Browser A (Leader)                              Browser B
    │                                               │
    │◄──────────── WebSocket ─────────────────────►│  (signaling)
    │                                               │
    │   1. peer-joined notification                 │
    │◄──────────────────────────────────────────────│
    │                                               │
    │   2. WebRTC offer                             │
    │──────────────────────────────────────────────►│
    │                                               │
    │   3. WebRTC answer                            │
    │◄──────────────────────────────────────────────│
    │                                               │
    │   4. ICE candidates (both directions)         │
    │◄─────────────────────────────────────────────►│
    │                                               │
    │   5. Data channel opens                       │
    │◄═══════════════ WebRTC P2P ═════════════════►│  (direct!)
    │                                               │
    │   6. onPeerConnect fires                      │
    │                                               │
```

### Flow 6: WebRTC fails, WebSocket relay
```
Browser A (Leader)            Signaling Server           Browser B
    │                              │                         │
    │   WebRTC negotiation fails   │                         │
    │   (firewall/NAT)             │                         │
    │                              │                         │
    │   peer.rtcConnected = false  │                         │
    │                              │                         │
    │   broadcast() called:        │                         │
    │   - hasWsOnlyPeers = true    │                         │
    │                              │                         │
    │──── binary data ────────────►│──── relay ─────────────►│
    │          WebSocket           │        WebSocket        │
    │                              │                         │
```

---

## Problem Scenarios

### Problem 1: WebSocket-only peer never fires onPeerConnect ⚠️

```
Browser A                     Signaling Server           Browser B (WS only)
    │                              │                         │
    │◄─── peer-joined ─────────────│                         │
    │                              │                         │
    │   Creates PeerState          │                         │
    │   rtcConnected = false       │                         │
    │                              │                         │
    │   WebRTC fails               │                         │
    │                              │                         │
    │   onPeerConnect NEVER fires! │                         │  ❌
    │   (only fires on data        │                         │
    │    channel open)             │                         │
```

**Impact**: App doesn't know peer exists, won't send time-sync.

**Fix needed**: Fire `onPeerConnect` for peers that fail WebRTC after a timeout.

---

### Problem 2: WebSocket relay loses peer identity ⚠️

```
Browser A                     Signaling Server           Browser B
    │                              │                         │
    │                              │◄──── binary data ───────│
    │                              │                         │
    │◄──── binary data ────────────│                         │
    │                              │                         │
    │   source.peerId = "ws-relay" │                         │  ❌
    │   (not "browser-b-id")       │                         │
```

**Impact**: Can't track per-peer time offset, can't do targeted responses.

**Fix needed**: Server should wrap relay messages with sender ID.

---

### Problem 3: sendTo() doesn't work for WebSocket peers ⚠️

```typescript
sendTo(peerId: string, data: ArrayBuffer | string): void {
  const peer = this.peers.get(peerId);
  if (peer?.rtcConnected && peer.dataChannel?.readyState === "open") {
    peer.dataChannel.send(data);
  }
  // No WebSocket fallback!  ❌
}
```

**Impact**: Time-sync and targeted messages fail for WebSocket-only peers.

**Fix needed**: Add WebSocket relay with target peer ID.

---

### Problem 4: Page refresh race condition ⚠️

```
Browser A                     Signaling Server           Browser B (refreshing)
    │                              │                         │
    │                              │◄──── disconnect ────────│ (page unload)
    │                              │                         │
    │◄─── peer-left ───────────────│                         │
    │                              │                         │
    │   Removes peer, closes RTC   │                         │
    │                              │                         │
    │                              │◄──── connect ───────────│ (page load)
    │                              │                         │
    │◄─── peer-joined ─────────────│                         │
    │                              │                         │
    │   Creates new PeerState      │                         │
    │   Starts WebRTC negotiation  │                         │
    │                              │                         │
    │   ... 2-5 seconds to         │                         │
    │   establish WebRTC ...       │                         │
    │                              │                         │
    │   Meanwhile: no sync! ❌     │                         │
```

**Impact**: 2-5 second gap where peer exists but can't receive messages.

**Fix needed**: Send via WebSocket immediately while WebRTC negotiates.

---

### Problem 5: Mixed WebRTC/WebSocket group

```
                    ┌─────────────┐
                    │   Server    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │ Peer A  │    │ Peer B  │    │ Peer C  │
      │ (WebRTC)│    │ (WebRTC)│    │ (WS only)│
      └────┬────┘    └────┬────┘    └─────────┘
           │              │
           └──── P2P ─────┘
```

**Current behavior**:
- A broadcasts: → B via WebRTC, → Server → C via WebSocket ✅
- B broadcasts: → A via WebRTC, → Server → C via WebSocket ✅
- C broadcasts: → Server → A,B via WebSocket ✅

**This actually works!** The `hasWsOnlyPeers` check handles it.

---

## Implementation Checklist

### Completed ✅
- [x] Fix FallbackCoordinator to relay remote→local
- [x] Fix FallbackCoordinator to relay local→remote

### Needs Server Changes 🔧
- [ ] Server: Include sender peerId in relay messages
- [ ] Server: Support targeted relay (sendTo via WebSocket)

### Needs Client Changes 🔧
- [ ] Fire onPeerConnect for WS-only peers after RTC timeout
- [ ] Add sendTo() fallback via WebSocket with target ID
- [ ] Consider sending via WS immediately while RTC negotiates

### Testing 🧪
- [ ] Test: Two local tabs sync
- [ ] Test: Two browsers with WebRTC
- [ ] Test: Two browsers with WebRTC blocked (WS only)
- [ ] Test: Page refresh during active session
- [ ] Test: Three browsers, one WS-only

---

## Quick Reference: Where Messages Go

| Sender | Recipients | Transport Used |
|--------|-----------|----------------|
| Leader tab | Follower tabs | BroadcastChannel |
| Leader tab | Remote peers (RTC) | WebRTC DataChannel |
| Leader tab | Remote peers (WS) | WebSocket relay |
| Follower tab | Leader tab | BroadcastChannel |
| Follower tab | Remote peers | BroadcastChannel → Leader → WebRTC/WS |
| Remote peer (RTC) | Leader tab | WebRTC DataChannel |
| Remote peer (RTC) | Follower tabs | WebRTC → Leader → BroadcastChannel |
| Remote peer (WS) | Leader tab | WebSocket relay |
| Remote peer (WS) | Follower tabs | WebSocket → Leader → BroadcastChannel |
