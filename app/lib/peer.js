'use strict';

/**
 * Waits for ICE candidate gathering to finish so that all candidates can be
 * bundled into a single offer or answer, as expected by the WebSocket
 * signaling relay used by this app.
 * @param {RTCPeerConnection} pc
 * @param {number} timeout Fallback in milliseconds in case gathering hangs.
 * @return {Promise<void>}
 */
function gatheredCandidates(pc, timeout = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const timer = setTimeout(done, timeout);

    function done() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }

    function onChange() {
      if (pc.iceGatheringState === 'complete') {
        done();
      }
    }

    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

/** Class representing a library-independent WebRTC peer */
class Peer {
  /**
   * Create a peer.
   * @param {string} id
   */
  constructor(id) {
    this._isInitiator = id === '';
    this._id = id || this._genID();
    this._pc = null;
    this._channel = null;
    this._offer = null;
    this._offerRequested = false;
    this._finished = false;
    this.onWSOpen = null;
    this.onConnect = null;
    this.onData = null;
    this.onClose = null;
  }

  /**
   * Returns a random string.
   * @return {string}
   */
  _genID() {
    return Math.random()
        .toString(16)
        .substr(2, 10);
  }

  /**
   * Sends data to remote peer.
   * @param {object} data
   */
  send(data) {
    this._channel.send(data);
  }

  /**
   * Performs signaling.
   */
  signal() {
    this._pc = new RTCPeerConnection({
      // simple-peer defaulted to this; required for connections across NAT.
      iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
    });
    this._pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(this._pc.connectionState)) {
        this._teardown();
      }
    };

    const isSecure = location.protocol === 'https:';
    const ws = new WebSocket(
        (isSecure ? 'wss://' : 'ws://') + location.host + '/ws?id=' + this._id,
    );

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'offer_request') {
        this._offerRequested = true;
        if (this._offer) {
          ws.send(JSON.stringify(this._offer));
        }
      } else if (
        (msg.type === 'offer' && !this._isInitiator) ||
        (msg.type === 'answer' && this._isInitiator)
      ) {
        this._handleSessionDescription(msg, ws);
      }
    };

    ws.onopen = () => {
      if (this._isInitiator) {
        this._createOffer(ws);
        this.onWSOpen(this._id);
      } else {
        this._pc.ondatachannel = (e) => {
          this._setupChannel(e.channel, ws);
        };
        ws.send(JSON.stringify({type: 'offer_request'}));
      }
    };
  }

  /**
   * Creates an SDP offer with all gathered ICE candidates bundled into it.
   * @param {WebSocket} ws
   */
  async _createOffer(ws) {
    const channel = this._pc.createDataChannel('chess');
    this._setupChannel(channel, ws);

    await this._pc.setLocalDescription(await this._pc.createOffer());
    await gatheredCandidates(this._pc);

    this._offer = {
      type: this._pc.localDescription.type,
      sdp: this._pc.localDescription.sdp,
    };
    if (this._offerRequested) {
      ws.send(JSON.stringify(this._offer));
    }
  }

  /**
   * Applies a session description from the remote peer and, for the receiving
   * peer, replies with an SDP answer over the given WebSocket.
   * @param {RTCSessionDescriptionInit} description
   * @param {WebSocket} ws
   */
  async _handleSessionDescription(description, ws) {
    await this._pc.setRemoteDescription(description);

    if (this._isInitiator) {
      return;
    }

    await this._pc.setLocalDescription(await this._pc.createAnswer());
    await gatheredCandidates(this._pc);

    ws.send(JSON.stringify({
      type: this._pc.localDescription.type,
      sdp: this._pc.localDescription.sdp,
    }));
  }

  /**
   * Wires up the data channel events.
   * @param {RTCDataChannel} channel
   * @param {WebSocket} ws
   */
  _setupChannel(channel, ws) {
    this._channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      ws.close();
      this.onConnect();
    };
    channel.onmessage = (e) => {
      const data = e.data instanceof ArrayBuffer ? new TextDecoder().decode(e.data) : e.data;
      this.onData(data);
    };
    channel.onclose = () => {
      this._teardown();
    };
    channel.onerror = () => {
      this._teardown();
    };
  }

  /**
   * Marks the session as finished and notifies the consumer.
   */
  _teardown() {
    if (this._finished) {
      return;
    }
    this._finished = true;
    this.onClose();
  }
}

export default Peer;
