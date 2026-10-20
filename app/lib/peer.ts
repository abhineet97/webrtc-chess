type SessionDescriptionMessage = {
  type: "offer" | "answer";
  sdp: string;
};

type SignalingMessage = { type: "offer_request" } | SessionDescriptionMessage;

/**
 * Waits for ICE candidate gathering to finish so that all candidates can be
 * bundled into a single offer or answer, as expected by the WebSocket
 * signaling relay used by this app.
 */
function gatheredCandidates(pc: RTCPeerConnection, timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const timer = setTimeout(done, timeout);

    function done() {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }

    function onChange() {
      if (pc.iceGatheringState === "complete") {
        done();
      }
    }

    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

/** Class representing a library-independent WebRTC peer */
export default class Peer {
  private readonly _isInitiator: boolean;
  private readonly _id: string;
  private _pc: RTCPeerConnection | null = null;
  private _channel: RTCDataChannel | null = null;
  private _offer: SessionDescriptionMessage | null = null;
  private _offerRequested = false;
  private _finished = false;

  onWSOpen: ((id: string) => void) | null = null;
  onConnect: (() => void) | null = null;
  onData: ((data: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(id: string) {
    this._isInitiator = id === "";
    this._id = id || this._genID();
  }

  /** Returns a random string. */
  private _genID(): string {
    return Math.random().toString(16).slice(2, 12);
  }

  /** Sends data to remote peer. */
  send(data: string): void {
    const channel = this._channel;
    if (channel) {
      channel.send(data);
    }
  }

  /** Performs signaling. */
  signal(): void {
    this._pc = new RTCPeerConnection({
      // simple-peer defaulted to this; required for connections across NAT.
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this._pc.onconnectionstatechange = () => {
      const pc = this._pc;
      if (pc && ["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        this._teardown();
      }
    };

    const isSecure = location.protocol === "https:";
    const ws = new WebSocket(
      (isSecure ? "wss://" : "ws://") + location.host + "/ws?id=" + this._id,
    );

    ws.onmessage = (e) => {
      const msg = e.data as string;
      const parsed = JSON.parse(msg) as SignalingMessage;
      if (parsed.type === "offer_request") {
        this._offerRequested = true;
        if (this._offer) {
          ws.send(JSON.stringify(this._offer));
        }
      } else if (
        (parsed.type === "offer" && !this._isInitiator) ||
        (parsed.type === "answer" && this._isInitiator)
      ) {
        void this._handleSessionDescription(parsed, ws);
      }
    };

    ws.onopen = () => {
      if (this._isInitiator) {
        void this._createOffer(ws);
        this.onWSOpen?.(this._id);
      } else {
        const pc = this._pc;
        if (pc == null) return;
        pc.ondatachannel = (e) => {
          this._setupChannel(e.channel, ws);
        };
        ws.send(JSON.stringify({ type: "offer_request" }));
      }
    };
  }

  /**
   * Creates an SDP offer with all gathered ICE candidates bundled into it.
   */
  private async _createOffer(ws: WebSocket): Promise<void> {
    const pc = this._pc;
    if (!pc) return;

    const channel = pc.createDataChannel("chess");
    this._setupChannel(channel, ws);

    await pc.setLocalDescription(await pc.createOffer());
    await gatheredCandidates(pc);

    const localDescription = pc.localDescription;
    if (!localDescription) return;

    this._offer = {
      type: localDescription.type as "offer" | "answer",
      sdp: localDescription.sdp,
    };
    if (this._offerRequested) {
      ws.send(JSON.stringify(this._offer));
    }
  }

  /**
   * Applies a session description from the remote peer and, for the receiving
   * peer, replies with an SDP answer over the given WebSocket.
   */
  private async _handleSessionDescription(
    description: SessionDescriptionMessage,
    ws: WebSocket,
  ): Promise<void> {
    const pc = this._pc;
    if (!pc) return;

    await pc.setRemoteDescription(description);

    if (this._isInitiator) {
      return;
    }

    await pc.setLocalDescription(await pc.createAnswer());
    await gatheredCandidates(pc);

    const localDescription = pc.localDescription;
    if (!localDescription) return;

    ws.send(JSON.stringify({ type: localDescription.type, sdp: localDescription.sdp }));
  }

  /** Wires up the data channel events. */
  private _setupChannel(channel: RTCDataChannel, ws: WebSocket): void {
    this._channel = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      ws.close();
      this.onConnect?.();
    };
    channel.onmessage = (e) => {
      const data =
        e.data instanceof ArrayBuffer ? new TextDecoder().decode(e.data) : String(e.data);
      this.onData?.(data);
    };
    channel.onclose = () => {
      this._teardown();
    };
    channel.onerror = () => {
      this._teardown();
    };
  }

  /** Marks the session as finished and notifies the consumer. */
  private _teardown(): void {
    if (this._finished) {
      return;
    }
    this._finished = true;
    this.onClose?.();
  }
}
