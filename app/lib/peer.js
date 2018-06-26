/*global SimplePeer*/
'use strict';
var Peer = function (id) {
    this._isInitiator = (id === '');
    this._id = id || this._genID();
    this._offer = null;
    this._answer = null;
    this._p = null;
    this.onWSOpen = null;
    this.onConnect = null;
    this.onData = null;
    this.onClose = null;

    return this;
};

Peer.prototype._genID = function(){
    function _guid(){
        return Math.random().toString(16).substr(2, 10);
    }
    return _guid();
};

Peer.prototype.send = function(data) {
    this._p.send(data);
};

Peer.prototype.signal = function(){
    var self = this;
    self._p = new SimplePeer({ initiator: self._isInitiator, trickle: false });

    var ws = new WebSocket('ws://' + location.host + '/ws?id=' + self._id);
    
    ws.onmessage = function(e){
        var msg = JSON.parse(e.data);
        if(msg.type === 'offer_request' && self._isInitiator){
            ws.send(JSON.stringify(self._offer));
        } else if((msg.type === 'offer' && !self._isInitiator) || (msg.type === 'answer' && self._isInitiator)){
            self._p.signal(msg);
        }
    };
    
    ws.onopen = function(){
        if(self._isInitiator) {
            self.onWSOpen(self._id);
        } else {
            ws.send(JSON.stringify({type: 'offer_request'}));
        }
    };

    self._p.on('signal', function (signal) {
        self['_' + signal.type] = signal;
        if(signal.type === 'answer'){
            ws.send(JSON.stringify(signal));
        }
    });

    self._p.on('connect', function(){
        ws.close();
        self.onConnect();
    });
    self._p.on('data', function(data){
        self.onData(data);
    });
    self._p.on('close', function(){
        self.onClose();
    });
};

window.Peer = Peer;