'use strict';

import ChessBoard from './lib/chessboard/chessboard.js';
import Peer from './lib/peer.js';
import Chess from 'chess.js';

import './main.css';

/**
 * Hides the loading spinner.
 */
function loaded() {
  const loader = document.querySelector('#loading');
  loader.parentElement.removeChild(loader);
  document.querySelector('main').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const orientation = location.hash.length === 0 ? 'w' : 'b';
  let isConnected = false;

  const peer = new Peer(location.hash.split('#').pop());

  peer.onWSOpen = (id) => {
    const link = location.href + '#' + id;
    document.querySelector('#link').href = link;
    document.querySelector('#link').innerHTML = link;
    document.querySelector('#link').classList.remove('hidden');
    loaded();
    status('Waiting for opponent...');
  };

  /**
   * Function that fires when a square is clicked on the board.
   * @function
   * @param {string} clickedSquare ID of clicked square.
   * @param {array} selectedSquares List of all the selected squares.
   */
  function onSquareClick(clickedSquare, selectedSquares) {
    if (!checkTurn()) {
      board.unselectSquare(clickedSquare);
      return;
    }

    if (selectedSquares.length === 0) {
      if (
        game.moves({
          square: clickedSquare,
        }).length > 0
      ) {
        board.selectSquare(clickedSquare);
      }

      return;
    }

    const selectedSquare = selectedSquares[0];

    if (clickedSquare === selectedSquare) {
      board.unselectSquare(clickedSquare);
      return;
    }

    const clickedPieceObject = game.get(clickedSquare);
    const selectedPieceObject = game.get(selectedSquare);

    if (
      clickedPieceObject &&
      clickedPieceObject.color === selectedPieceObject.color
    ) {
      board.unselectSquare(clickedSquare);
      return;
    }

    const legalMoves = game.moves({
      square: selectedSquare,
      verbose: true,
    });
    const isMoveLegal =
      legalMoves.filter(function(move) {
        return move.to === clickedSquare;
      }).length > 0;

    if (!isMoveLegal) {
      status('Invalid move. Try Again.');
      return;
    }

    if (
      selectedPieceObject.type === 'p' &&
      (clickedSquare[1] === '1' || clickedSquare[1] === '8')
    ) {
      // Promotion
      board.askPromotion(selectedPieceObject.color, function(shortPiece) {
        move(selectedSquare, clickedSquare, shortPiece);
      });
    } else {
      move(selectedSquare, clickedSquare);
    }
  }

  /**
   * Moves a chess piece from one given location to another given location.
   * @function
   * @param {string} from Current location of piece.
   * @param {string} to The location to move the piece to.
   * @param {string} promotionShortPiece
   */
  function move(from, to, promotionShortPiece) {
    game.move({
      from: from,
      to: to,
      promotion: promotionShortPiece,
    });

    board.setPosition(game.fen());

    peer.send(String(game.fen()));
    checkGameStatus();
    board.unselectAllSquares();
  }

  /**
   * Checks the game status and update the status board accordingly.
   */
  function checkGameStatus() {
    const isMyTurn = game.turn() === orientation;
    if (game.game_over()) {
      if (game.in_draw()) {
        status('Game Over. It\'s a DRAW.');
      }
      status('Game Over. You have ' + (isMyTurn ? 'LOST' : 'WON'));
    } else if (game.in_check()) {
      status((isMyTurn ? 'You are' : 'Opponent is') + ' in CHECK.');
    } else {
      status((isMyTurn ? 'Your' : 'Opponent\'s') + ' turn.');
    }
  }

  /**
   * Checks if user can play this turn.
   * @return {boolean}
   */
  function checkTurn() {
    if (game.game_over()) {
      checkGameStatus();
      return false;
    } else if (!isConnected) {
      status('Connection to your opponent has been lost.');
      return false;
    } else if (game.turn() !== orientation) {
      status('Not your turn');
      return false;
    }
    return true;
  }

  /**
   * Updates the status UI element.
   * @param {string} string
   */
  function status(string) {
    document.getElementById('msg').innerHTML = string;
  }

  peer.onConnect = () => {
    if (orientation === 'w') {
      status('Connected to opponent, play your turn.');
    } else {
      status('Connected to opponent, waiting for him/her to play...');
      loaded();
    }

    isConnected = true;
    document.querySelector('header').classList.add('hidden');
    document.querySelector('.blur').classList.remove('blur');
  };

  peer.onData = (data) => {
    const fen = String(data);
    game.load(fen);
    board.setPosition(game.fen());
    checkGameStatus();
  };

  peer.onClose = () => {
    isConnected = false;
  };

  const game = new Chess();
  const board = new ChessBoard('board', {
    onSquareClick: onSquareClick,
    orientation: orientation,
  });
  peer.signal();
});
