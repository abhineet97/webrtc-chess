'use strict';

import SimplePeer from 'simple-peer';

/** Class representing a library-independent WebRTC peer */
class Peer {
  /**
   * Create a peer.
   * @param {string} id
   */
  constructor(id) {
    this._isInitiator = id === '';
    this._id = id || this._genID();
    this._offer = null;
    this._answer = null;
    this._p = null;
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
    this._p.send(data);
  }

  /**
   * Performs signalling.
   */
  signal() {
    this._p = new SimplePeer({initiator: this._isInitiator, trickle: false});

    const isSecure = location.protocol === 'https:';
    const ws = new WebSocket(
        (isSecure ? 'wss://' : 'ws://') + location.host + '/ws?id=' + this._id,
    );

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'offer_request' && this._isInitiator) {
        ws.send(JSON.stringify(this._offer));
      } else if (
        (msg.type === 'offer' && !this._isInitiator) ||
        (msg.type === 'answer' && this._isInitiator)
      ) {
        this._p.signal(msg);
      }
    };

    ws.onopen = () => {
      if (this._isInitiator) {
        this.onWSOpen(this._id);
      } else {
        ws.send(JSON.stringify({type: 'offer_request'}));
      }
    };

    this._p.on('signal', (signal) => {
      this['_' + signal.type] = signal;
      if (signal.type === 'answer') {
        ws.send(JSON.stringify(signal));
      }
    });

    this._p.on('connect', () => {
      ws.close();
      this.onConnect();
    });

    this._p.on('data', (data) => {
      this.onData(data);
    });

    this._p.on('close', () => {
      this.onClose();
    });
  }
}

export default Peer;
