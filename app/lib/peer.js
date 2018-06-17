/*global SimplePeer*/
'use strict';

var isInitiator = location.hash.length === 0;
var ws;
var p = new SimplePeer({ initiator: isInitiator, trickle: false });

function genId(offer, onID) {
    var h = btoa(JSON.stringify(offer));
    var id = h.substr(0, 10);
    onID(id);
    return id;
}

if (!isInitiator) {
    var id = location.hash.split('#').pop();
    ws = new WebSocket('ws://' + location.host + '/ws?id=' + id);

    // Recieve Offer
    ws.onmessage = function (e) {
        var msg = JSON.parse(e.data);
        if (msg.type === 'offer') {
            p.signal(msg.content);
        }
    };
    // Request Offer
    ws.onopen = function () {
        var msg = {
            type: 'request',
            content: 'offer'
        };
        ws.send(JSON.stringify(msg));
    };
}

var Peer = function (onID) {
    var ws, offer;

    p.on('signal', function (data) {
        if (isInitiator) {
            offer = data;
            ws = new WebSocket('ws://' + location.host + '/ws?id=' + genId(offer, onID));

            // Send Offer
            ws.onmessage = function (e) {
                var msg = JSON.parse(e.data);
                if (msg.type === 'request') {
                    ws.send(JSON.stringify({
                        type: 'offer',
                        content: offer
                    }));
                } else if (msg.type === 'answer') {
                    // Recieve Answer
                    p.signal(msg.content);
                    ws.close();
                }
            };
        } else {
            // Send Answer
            ws.send(JSON.stringify({
                type: 'answer',
                content: data
            }));
            ws.close();
        }
    });
    return p;
};

window.Peer = Peer;