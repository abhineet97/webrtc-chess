/*global ChessBoard*/
'use strict';

document.addEventListener('DOMContentLoaded', main);

/**
 * Hide element with given CSS selector.
 * @param {string} selector 
 */
function hide(selector) {
    document.querySelector(selector).classList.add('hidden');
}

/**
 * Unhide element with given CSS selector.
 * @param {string} selector 
 */
function unhide(selector) {
    document.querySelector(selector).classList.remove('hidden');
}

/**
 * Sets the game link on the #link element.
 * @param {string} link the link to be shared with opponent.
 */
function setLink(link) {
    document.querySelector('#link').href = link;
    document.querySelector('#link').innerHTML = link;
    loaded();
}

/**
 * Hides the spining loading animation.
 */
function loaded() {
    var loader = document.querySelector('.loader');
    loader.parentElement.removeChild(loader);
    unhide('main');
}

/**
 * Returns the orientation of Chess board.
 * @returns {string}
 */
function getOrientation() {
    if (window.location.hash && window.location.hash.length !== 0) return 'b';
    else return 'w';
}

function main() {
    var board, game, onSquareClick, onOpen, move, checkGameStatus;

    var peer = new Peer({
        key: '618b8av1yey4lsor'
    });
    var user = {},
        friend = {},
        isConnected = false;

    /**
     * Function that fires when a square is clicked on the board.
     * @function 
     * @param {string} clickedSquare ID of clicked square.
     * @param {array} selectedSquares List of all the selected squares.
     */
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
            status('Invalid move. Try Again.');
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

    /**
     * Moves a chess piece from one given location to another given location.
     * @function
     * @param {string} from Current location of piece.
     * @param {string} to The location to move the piece to.
     * @param {string} promotionShortPiece 
     */
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

    /**
     * Checks the game status and update the status board accordingly.
     */
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
  
    /**
     * Checks if user can play this turn.
     * @returns {boolean}
     */
    var checkTurn = function() {
        if (game.game_over()) {
            checkGameStatus();
            return false;
        }
        else if (game.turn() !== user.color) {
            status('Not your turn');
            return false;
        }
        else if (!isConnected) {
            if(peer.disconnected){
                status('Connection to your opponent has been lost.');
            }else{
                status('Please wait while we connect to your opponent...');
            }
            return false;
        }
        return true;
    };

    /**
     * Updates the status UI element.
     * @param {string} string
     */
    var status = function(string) {
        document.getElementById('msg').innerHTML = string;
    };

    /**
     * Updates board's element based on given fen.
     * @param {string} fen 
     */
    function updateBoard (fen) {
        game.load(fen);
        board.setPosition(game.fen());
        checkGameStatus();
    }

    onOpen = function(dataConnection) {
        if (user.color === 'w') {
            status('Connected to opponent, play your turn.');

        }
        else {
            status('Connected to opponent, waiting for him/her to play...');
            loaded();
        }

        isConnected = true;
        friend.dataConnection = dataConnection;
        hide('header');
        document.querySelector('.blur').classList.remove('blur');
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

            dataConnection.on('data', updateBoard);
        }
        else {
            user = {
                color: 'w',
                id: id
            };

            friend = {
                color: 'b'
            };

            setLink(window.location.href + '#' + user.id);
        }
    });

    peer.on('connection', function(dataConnection) {
        dataConnection.on('open', function() {
            onOpen(dataConnection);
        });

        dataConnection.on('data', updateBoard);
    });

    game = Chess();
    board = new ChessBoard('board', {
        onSquareClick: onSquareClick,
        orientation: getOrientation()
    });
}
