import ChessBoard from "./lib/chessboard/chessboard";
import Peer from "./lib/peer";
import { Chess, type Square } from "chess.js";

import "./main.css";

type PieceColor = "w" | "b";

type CardContent = {
  message?: string;
  link?: string;
  action?: { label: string; onClick: () => void };
};

/**
 * Shows the info card over the blurred board. With no content it shows the
 * spinner.
 */
function showCard({ message, link, action }: CardContent = {}) {
  const spinner = document.getElementById("spinner") as HTMLElement;
  const messageElement = document.getElementById("message") as HTMLElement;
  const linkElement = document.getElementById("link") as HTMLElement;
  const actionElement = document.getElementById("action") as HTMLButtonElement;

  spinner.classList.toggle("hidden", Boolean(message));
  messageElement.textContent = message ?? "";
  messageElement.classList.toggle("hidden", !message);
  linkElement.textContent = link ?? "";
  linkElement.classList.toggle("hidden", !link);
  actionElement.textContent = action?.label ?? "";
  actionElement.onclick = action?.onClick ?? null;
  actionElement.classList.toggle("hidden", !action);

  document.getElementById("info")?.classList.remove("hidden");
  document.getElementById("board")?.classList.add("blur");
}

/**
 * Hides the info card and unblurs the board.
 */
function hideCard() {
  document.getElementById("info")?.classList.add("hidden");
  document.getElementById("board")?.classList.remove("blur");
}

/**
 * Drops any game id from the URL and loads the app fresh.
 */
function reset() {
  location.assign(location.origin + location.pathname);
}

document.addEventListener("DOMContentLoaded", () => {
  const orientation: PieceColor = location.hash.length === 0 ? "w" : "b";
  let isConnected = false;
  let isOver = false;

  const peer = new Peer(location.hash.split("#").pop() ?? "");

  peer.onWSOpen = (id: string) => {
    const link = location.href + "#" + id;
    showCard({
      message: "Start session by sharing link",
      link,
      action:
        typeof navigator.share === "function"
          ? {
              label: "Share",
              onClick: () => {
                navigator.share({ title: "WebRTC Chess", url: link }).catch(() => {});
              },
            }
          : undefined,
    });
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
    checkGameOver();
    board.unselectAllSquares();
  }

  /**
   * Shows the result card once the game has ended.
   */
  function checkGameOver() {
    if (!game.isGameOver()) {
      return;
    }

    let result: string;
    if (game.isCheckmate()) {
      result = game.turn() === orientation ? "You lost" : "You won";
    } else if (game.isStalemate()) {
      result = "Draw by stalemate";
    } else if (game.isThreefoldRepetition()) {
      result = "Draw by threefold repetition";
    } else if (game.isInsufficientMaterial()) {
      result = "Draw by insufficient material";
    } else if (game.isDrawByFiftyMoves()) {
      result = "Draw by 50-move rule";
    } else {
      result = "Draw";
    }

    isOver = true;
    showCard({ message: result, action: { label: "Play again", onClick: reset } });
  }

  /**
   * Checks if user can play this turn.
   * @return {boolean}
   */
  function checkTurn(): boolean {
    return isConnected && !game.isGameOver() && game.turn() === orientation;
  }

  /**
   * Shows the error card. Used for every failure, before or during a game.
   */
  function showError() {
    isConnected = false;
    showCard({
      message: "Something went wrong",
      action: { label: "Start afresh", onClick: reset },
    });
  }

  peer.onConnect = () => {
    isConnected = true;
    hideCard();
  };

  peer.onData = (data: string) => {
    try {
      game.load(data);
    } catch {
      showError();
      return;
    }
    board.setPosition(game.fen());
    checkGameOver();
  };

  peer.onReconnecting = () => {
    isConnected = false;
    showCard();
  };

  peer.onReconnected = () => {
    isConnected = true;
    hideCard();
    checkGameOver();
  };

  peer.onClose = () => {
    // The game is already decided, so keep showing its result.
    if (!isOver) {
      showError();
    }
  };

  const game = new Chess();
  const board = new ChessBoard("board", {
    onSquareClick: onSquareClick,
    orientation: orientation,
  });
  peer.signal();
});
