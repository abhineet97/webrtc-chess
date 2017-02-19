/*global ChessBoard*/
'use strict';

document.addEventListener('DOMContentLoaded', main);

function getOrientation() {
  if (window.location.hash && window.location.hash.length !== 0) return 'b';
  else return 'w';
}

function main() {
  var board, game, onSquareClick, onData, onOpen, move, checkGameStatus;

  var peer = new Peer({
    key: '618b8av1yey4lsor'
  });
  var user = {},
    friend = {},
    connected = false;

  onSquareClick = function(clickedSquare, selectedSquares) {
    if (!checkTurn()) {
      board.unselectSquare(clickedSquare);
      return;
    }

    if (selectedSquares.length === 0) {
      if (game.moves({
          square: clickedSquare
        }).length > 0) {
        board.selectSquare(clickedSquare);
      }

      return;
    }

    var selectedSquare = selectedSquares[0];

    if (clickedSquare === selectedSquare) {
      board.unselectSquare(clickedSquare);
      return;
    }

    var clickedPieceObject = game.get(clickedSquare);
    var selectedPieceObject = game.get(selectedSquare);

    if (clickedPieceObject && (clickedPieceObject.color === selectedPieceObject.color)) {
      board.unselectSquare(clickedSquare);
      return;
    }

    var legalMoves = game.moves({
      square: selectedSquare,
      verbose: true
    });
    var isMoveLegal = legalMoves.filter(function(move) {
      return move.to === clickedSquare;
    }).length > 0;

    if (!isMoveLegal) {
      status('Invalid move. Try Again.')
      return;
    }

    if (selectedPieceObject.type === 'p' && (clickedSquare[1] === '1' || clickedSquare[1] === '8')) { // Promotion
      board.askPromotion(selectedPieceObject.color, function(shortPiece) {
        move(selectedSquare, clickedSquare, shortPiece);
      });
    }
    else {
      move(selectedSquare, clickedSquare);
    }
  };

  move = function(from, to, promotionShortPiece) {
    game.move({
      from: from,
      to: to,
      promotion: promotionShortPiece
    });

    board.setPosition(game.fen());

    sendMove();
    board.unselectAllSquares();
  };

  var sendMove = function() {
    friend.dataConnection.send(game.fen());
    checkGameStatus();
  };

  checkGameStatus = function() {
    if (game.game_over()) {
      if (game.in_draw()) {
        status('Game Over. It\'s a DRAW.');
      }
      status('Game Over. You have ' + (game.turn() === user.color ? 'LOST' : 'WON'));
    }
    else if (game.in_check()) {
      status((game.turn() === user.color ? 'You are' : 'Opponent is') + ' in CHECK.');
    }
    else {
      status((game.turn() === user.color ? 'Your' : 'Opponent\'s') + ' turn.');
    }
  };

  var dialog = document.querySelector('dialog');
  dialogPolyfill.registerDialog(dialog);

  var setModal = function(string) {
    dialog.innerHTML = string;
    dialog.showModal();
  };

  var checkTurn = function() {
    if (game.game_over()) {
      checkGameStatus();
      return false;
    }
    else if (game.turn() !== user.color) {
      status('Not your turn');
      return false;
    }
    else if (!connected) {
      if(peer.disconnected){
        status('Connection to your opponent has been lost.');
      }else{
        status('Please wait while we connect to your opponent...');
      }
      return false;
    }
    return true;
  };

  var status = function(string) {
    document.getElementById('msg').innerHTML = string;
  };

  onData = function(data) {
    console.log('Recieved', data);
    game.load(data);
    board.setPosition(game.fen());
    checkGameStatus();
  };

  onOpen = function(dataConnection) {
    if (user.color === 'w') {
      dialog.close();
      status('Connected to opponent, play your turn.');
    }
    else {
      status('Connected to opponent, waiting for him/her to play...');
    }

    connected = true;
    friend.dataConnection = dataConnection;
  };

  peer.on('open', function(id) {
    status('Waiting for opponent...');
    if (window.location.hash.length !== 0) {
      user = {
        id: id,
        color: 'b'
      };

      friend = {
        id: window.location.hash.split('#').pop(),
        color: 'w'
      };

      var dataConnection = peer.connect(friend.id);
      status('Connecting to opponent...');

      dataConnection.on('open', function() {
        onOpen(dataConnection);
      });

      dataConnection.on('data', onData);
    }
    else {
      user = {
        color: 'w',
        id: id
      };

      friend = {
        color: 'b'
      };

      setModal('<span>Share this URL to begin</span><input onclick="this.select();" value="' + window.location.href + '#' + user.id + '">');
    }
  });

  peer.on('connection', function(dataConnection) {
    dataConnection.on('open', function() {
      onOpen(dataConnection);
    });

    dataConnection.on('data', onData);
  });

  game = Chess();
  board = new ChessBoard('board', {
    onSquareClick: onSquareClick,
    orientation: getOrientation()
  });
}