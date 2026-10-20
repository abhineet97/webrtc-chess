import ChessBoard from "./lib/chessboard/chessboard";
import Peer from "./lib/peer";
import { Chess, type Square } from "chess.js";

import "./main.css";

type PieceColor = "w" | "b";

/**
 * Hides the loading spinner.
 */
function loaded() {
  const loader = document.querySelector("#loading");
  if (loader) {
    loader.parentElement?.removeChild(loader);
  }
  document.querySelector("main")?.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const orientation: PieceColor = location.hash.length === 0 ? "w" : "b";
  let isConnected = false;
  let wasConnected = false;

  const peer = new Peer(location.hash.split("#").pop() ?? "");

  peer.onWSOpen = (id: string) => {
    const link = location.href + "#" + id;
    const linkElement = document.querySelector("#link") as HTMLAnchorElement;
    linkElement.href = link;
    linkElement.innerHTML = link;
    linkElement.classList.remove("hidden");
    loaded();
    status("Waiting for opponent...");
  };

  /**
   * Function that fires when a square is clicked on the board.
   * @param clickedSquare ID of clicked square.
   * @param selectedSquares List of all the selected squares.
   */
  function onSquareClick(clickedSquare: string, selectedSquares: string[]) {
    if (!checkTurn()) {
      board.unselectSquare(clickedSquare);
      return;
    }

    if (selectedSquares.length === 0) {
      if (game.moves({ square: clickedSquare as Square }).length > 0) {
        board.selectSquare(clickedSquare);
      }

      return;
    }

    const selectedSquare = selectedSquares[0];

    if (clickedSquare === selectedSquare) {
      board.unselectSquare(clickedSquare);
      return;
    }

    const clickedPieceObject = game.get(clickedSquare as Square);
    const selectedPieceObject = game.get(selectedSquare as Square);

    if (!selectedPieceObject) {
      return;
    }

    if (clickedPieceObject && clickedPieceObject.color === selectedPieceObject.color) {
      // Allow selecting a different piece of the same color instead of a no-op.
      board.unselectSquare(selectedSquare);
      if (game.moves({ square: clickedSquare as Square }).length > 0) {
        board.selectSquare(clickedSquare);
      }
      return;
    }

    const legalMoves = game.moves({
      square: selectedSquare as Square,
      verbose: true,
    });
    const isMoveLegal =
      legalMoves.filter(function (move) {
        return move.to === clickedSquare;
      }).length > 0;

    if (!isMoveLegal) {
      status("Invalid move. Try Again.");
      return;
    }

    if (
      selectedPieceObject.type === "p" &&
      (clickedSquare[1] === "1" || clickedSquare[1] === "8")
    ) {
      // Promotion
      board.askPromotion(selectedPieceObject.color, function (shortPiece) {
        move(selectedSquare, clickedSquare, shortPiece);
      });
    } else {
      move(selectedSquare, clickedSquare);
    }
  }

  /**
   * Moves a chess piece from one given location to another given location.
   * @param from Current location of piece.
   * @param to The location to move the piece to.
   * @param promotionShortPiece
   */
  function move(from: string, to: string, promotionShortPiece?: string) {
    game.move({
      from: from as Square,
      to: to as Square,
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
    if (game.isGameOver()) {
      if (game.isDraw()) {
        status("Game Over. It's a DRAW.");
        return;
      }
      status("Game Over. You have " + (isMyTurn ? "LOST" : "WON"));
    } else if (game.isCheck()) {
      status((isMyTurn ? "You are" : "Opponent is") + " in CHECK.");
    } else {
      status((isMyTurn ? "Your" : "Opponent's") + " turn.");
    }
  }

  /**
   * Checks if user can play this turn.
   * @return {boolean}
   */
  function checkTurn(): boolean {
    if (game.isGameOver()) {
      checkGameStatus();
      return false;
    } else if (!isConnected) {
      status(
        wasConnected
          ? "Connection to your opponent has been lost."
          : "Waiting for your opponent to connect...",
      );
      return false;
    } else if (game.turn() !== orientation) {
      status("Not your turn");
      return false;
    }
    return true;
  }

  /**
   * Updates the status UI element.
   * @param string
   */
  function status(string: string) {
    const msgElement = document.getElementById("msg");
    if (msgElement) {
      msgElement.innerHTML = string;
    }
  }

  peer.onConnect = () => {
    if (orientation === "w") {
      status("Connected to opponent, play your turn.");
    } else {
      status("Connected to opponent, waiting for him/her to play...");
      loaded();
    }

    isConnected = true;
    wasConnected = true;
    document.querySelector("header")?.classList.add("hidden");
    document.querySelector(".blur")?.classList.remove("blur");
  };

  peer.onData = (data: string) => {
    try {
      game.load(data);
    } catch {
      // Ignore malformed FEN received from the opponent.
      return;
    }
    board.setPosition(game.fen());
    checkGameStatus();
  };

  peer.onClose = () => {
    isConnected = false;
  };

  const game = new Chess();
  const board = new ChessBoard("board", {
    onSquareClick: onSquareClick,
    orientation: orientation,
  });
  peer.signal();
});
