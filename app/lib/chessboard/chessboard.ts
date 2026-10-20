export type PieceColor = "w" | "b";

export type Square = string;

/** A square on the board. */
type BoardSquare = {
  element: HTMLElement;
  piece: string | null;
};

/** A row of squares. Rows are keyed by 1-8, columns by 0-7. */
type BoardRow = {
  element: HTMLElement;
  squares: BoardSquare[];
};

/** A piece that can be selected for promotion. */
type PromotionPiece = {
  piece: string;
  element: HTMLElement;
};

export type ChessBoardConfig = {
  /** FEN string to load on startup. */
  fen?: string;
  /** Whether the board should resize with its container. */
  resize?: boolean;
  /** Which side the board is oriented towards ("w" white, "b" black). */
  orientation?: PieceColor;
  minSquareSize?: number;
  maxSquareSize?: number;
  /** Fired when a square on the board is clicked. */
  onSquareClick?: (clickedSquare: Square, selectedSquares: Square[]) => void;
};

type ChessBoardOptions = Required<Omit<ChessBoardConfig, "onSquareClick">> &
  Pick<ChessBoardConfig, "onSquareClick">;

export default class ChessBoard {
  private readonly boardId: string;
  private readonly options: ChessBoardOptions;

  private boardElement: HTMLElement;
  private readonly rows = new Map<number, BoardRow>();
  private selectedSquares: Square[] = [];
  private squareSize = 0;
  private boardBorderWidth = 0;
  private boardWidthFix = 0;

  // The promotion overlay is created in the constructor before any user
  // interaction, so everything except the selection/callback is always set.
  private readonly promotion: {
    pieces: PromotionPiece[];
    selectedElement: HTMLElement | null;
    whitePiecesWrapper: HTMLElement;
    blackPiecesWrapper: HTMLElement;
    promoteButton: HTMLButtonElement;
    promoteButtonWrapper: HTMLElement;
    wrapper: HTMLElement;
    overlay: HTMLElement;
    callback: ((shortPiece: string) => void) | null;
  } = {
    pieces: [],
    selectedElement: null,
    whitePiecesWrapper: null!,
    blackPiecesWrapper: null!,
    promoteButton: null!,
    promoteButtonWrapper: null!,
    wrapper: null!,
    overlay: null!,
    callback: null,
  };

  constructor(boardId: string, config: ChessBoardConfig = {}) {
    this.boardId = boardId;
    this.options = {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
      resize: true,
      orientation: "w",
      minSquareSize: 20,
      maxSquareSize: 64,
      ...config,
    };

    const boardElement = document.getElementById(this.boardId);
    if (!boardElement) {
      throw new Error(`No element with id "${this.boardId}" was found`);
    }

    this.boardElement = boardElement;
    boardElement.classList.add("chessboard");

    if (this.options.orientation === "b") {
      boardElement.classList.add("flipped");
    }

    for (let r = 8; r >= 1; r--) {
      const rowElement = document.createElement("div");

      const row: BoardRow = { element: rowElement, squares: [] };
      this.rows.set(r, row);

      for (let c = 0; c < 8; c++) {
        const squareElement = document.createElement("div");

        if ((r + c) % 2 === 0) {
          squareElement.className = "white square";
        } else {
          squareElement.className = "black square";
        }

        squareElement.setAttribute("data-square", calcSquare(r, c));

        if (this.options.onSquareClick) {
          squareElement.addEventListener("click", this.onSquareClick.bind(this));
        }

        row.squares[c] = { element: squareElement, piece: null };

        rowElement.appendChild(squareElement);
      }

      boardElement.appendChild(rowElement);
    }

    this.createPromotion();

    setTimeout(() => {
      // Without setTimeout, boxSizing is not set yet.
      const boardStyle = getComputedStyle(this.boardElement);

      // Assumption: all 4 borders have the same width
      this.boardBorderWidth = parseInt(boardStyle.borderTopWidth);

      if (boardStyle.boxSizing === "border-box") {
        this.boardWidthFix = 2 * this.boardBorderWidth;
      } else {
        this.boardWidthFix = 0;
      }

      this.setBoardSize();
      this.setPosition(this.options.fen);
    });

    if (this.options.resize) {
      window.addEventListener("resize", this.setBoardSize.bind(this));
    }
  }

  selectSquare(square: Square): void {
    if (this.selectedSquares.includes(square)) {
      return;
    }

    const boardSquare = this.getBoardSquare(square);

    boardSquare.element.classList.add("selected");
    this.selectedSquares.push(square);
  }

  unselectSquare(square: Square): void {
    const index = this.selectedSquares.indexOf(square);

    if (index === -1) {
      return;
    }

    const boardSquare = this.getBoardSquare(square);

    boardSquare.element.classList.remove("selected");
    this.selectedSquares.splice(index, 1);
  }

  unselectAllSquares(): void {
    for (const square of this.selectedSquares) {
      const boardSquare = this.getBoardSquare(square);

      boardSquare.element.classList.remove("selected");
    }

    this.selectedSquares = [];
  }

  setPosition(fen: string): void {
    const board = fen.split(" ")[0];

    for (let r = 0; r < 8; r++) {
      const row = board.split("/")[r].replace(/\d/g, (number) => repeatChar(".", +number));

      for (let c = 0; c < 8; c++) {
        const square = calcSquare(8 - r, c);

        if (row[c] === ".") {
          this.clearSquare(square);
        } else {
          this.putPiece(square, calcPieceFromFenPiece(row[c]));
        }
      }
    }
  }

  askPromotion(color: PieceColor, callback: (shortPiece: string) => void): void {
    const promotion = this.promotion;

    promotion.callback = callback;
    promotion.whitePiecesWrapper.style.display = color === "w" ? "block" : "none";
    promotion.blackPiecesWrapper.style.display = color === "b" ? "block" : "none";

    promotion.promoteButton.disabled = true;

    if (promotion.selectedElement !== null) {
      promotion.selectedElement.classList.remove("selected");
    }

    promotion.selectedElement = null;

    promotion.overlay.style.display = "block";
  }

  private getBoardSquare(square: Square): BoardSquare {
    const c = square.charCodeAt(0) - 97;
    const r = Number(square[1]);

    const row = this.rows.get(r);

    if (!row) {
      throw new Error(`Row "${r}" does not exist on the board`);
    }

    return row.squares[c];
  }

  private onSquareClick(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const clickedSquare = target.getAttribute("data-square") as Square;

    if (this.options.onSquareClick) {
      this.options.onSquareClick(clickedSquare, this.selectedSquares);
    }
  }

  private createPromotion(): void {
    const promotion = this.promotion;

    // Pieces
    const whitePiecesWrapper = this.createPromotionPieces("w");
    const blackPiecesWrapper = this.createPromotionPieces("b");

    // Promote button
    const promoteButton = document.createElement("button");
    const promoteButtonText = document.createTextNode("Promote");

    promoteButton.appendChild(promoteButtonText);
    promotion.promoteButton = promoteButton;

    const promoteButtonWrapper = document.createElement("div");

    promoteButtonWrapper.appendChild(promoteButton);
    promotion.promoteButtonWrapper = promoteButtonWrapper;

    // Promotion wrapper
    const promotionWrapper = document.createElement("div");
    promotionWrapper.className = "promotion-wrapper";

    promotionWrapper.appendChild(whitePiecesWrapper);
    promotionWrapper.appendChild(blackPiecesWrapper);
    promotionWrapper.appendChild(promoteButtonWrapper);

    promotion.wrapper = promotionWrapper;

    // Promotion overlay
    const overlay = document.createElement("div");
    overlay.className = "promotion-overlay";
    promotion.overlay = overlay;

    overlay.appendChild(promotionWrapper);
    this.boardElement.appendChild(overlay);

    // Set click handlers
    for (const { element } of promotion.pieces) {
      element.addEventListener("click", this.onPromotionPieceClick.bind(this));
    }

    promoteButton.addEventListener("click", this.onPromotionButtonClick.bind(this));
  }

  private createPromotionPieces(color: PieceColor): HTMLElement {
    const promotion = this.promotion;
    const piecesWrapper = document.createElement("div");
    piecesWrapper.className = "pieces";

    for (const type of ["Q", "R", "N", "B"]) {
      const piece = color + type;
      const pieceElement = document.createElement("div");

      pieceElement.className = "square " + piece;
      pieceElement.setAttribute("data-piece", piece);

      promotion.pieces.push({ piece: piece, element: pieceElement });

      piecesWrapper.appendChild(pieceElement);
    }

    if (color === "w") {
      promotion.whitePiecesWrapper = piecesWrapper;
    } else {
      promotion.blackPiecesWrapper = piecesWrapper;
    }

    return piecesWrapper;
  }

  private onPromotionPieceClick(event: Event): void {
    const promotion = this.promotion;
    const clickedElement = event.currentTarget as HTMLElement;

    // Selected piece clicked
    if (clickedElement === promotion.selectedElement) {
      return;
    }

    // First time piece is selected
    if (promotion.selectedElement === null) {
      promotion.selectedElement = clickedElement;
      clickedElement.classList.add("selected");
      promotion.promoteButton.disabled = false;
      return;
    }

    // Selecting another piece
    promotion.selectedElement.classList.remove("selected");
    promotion.selectedElement = clickedElement;
    clickedElement.classList.add("selected");
  }

  private onPromotionButtonClick(): void {
    const promotion = this.promotion;
    if (promotion.selectedElement === null || promotion.overlay === null) {
      return;
    }

    const piece = promotion.selectedElement.getAttribute("data-piece") ?? "";
    const shortPiece = String.fromCharCode(piece.charCodeAt(1) + 32);

    promotion.overlay.style.display = "none";

    if (promotion.callback) {
      promotion.callback(shortPiece);
    }
  }

  private setBoardSize(): void {
    const promotion = this.promotion;
    this.calcSquareSize();
    const squareSize = this.squareSize;

    const squareSizePx = squareSize + "px";
    const rowWidthPx = 8 * squareSize + "px";
    const backgroundSizePx = 6 * squareSize + "px";

    // Update board elements
    this.boardElement.style.width = 8 * squareSize + this.boardWidthFix + "px";

    for (const { element: rowElement, squares } of this.rows.values()) {
      rowElement.style.width = rowWidthPx;
      rowElement.style.height = squareSizePx;

      for (const { element: squareElement, piece } of squares) {
        squareElement.style.width = squareSizePx;
        squareElement.style.height = squareSizePx;
        squareElement.style.backgroundSize = backgroundSizePx;
        squareElement.style.backgroundPosition = this.backgroundPosition(piece);
      }
    }

    // Update promotion elements
    promotion.wrapper.style.width = 4 * squareSize + "px";
    promotion.wrapper.style.height = 2 * squareSize + "px";
    promotion.wrapper.style.marginTop = 3 * squareSize + "px";

    promotion.whitePiecesWrapper.style.height = squareSizePx;
    promotion.blackPiecesWrapper.style.height = squareSizePx;

    for (const { piece, element } of promotion.pieces) {
      element.style.width = squareSizePx;
      element.style.height = squareSizePx;
      element.style.backgroundSize = backgroundSizePx;
      element.style.backgroundPosition = this.backgroundPosition(piece);
    }

    promotion.promoteButtonWrapper.style.height = squareSizePx;
    promotion.promoteButtonWrapper.style.lineHeight = squareSizePx;
    promotion.promoteButton.style.fontSize = squareSize / 2.5 + "px";
  }

  /**
   * Calculates the size of a single square, which is dependent on the size of
   * the parent of the board and the min/max square size options.
   */
  private calcSquareSize(): void {
    const parent = this.boardElement.parentElement;
    if (!parent) {
      return;
    }

    const parentStyle = getComputedStyle(parent);
    const parentWidth =
      parseInt(parentStyle.width) -
      parseInt(parentStyle.paddingLeft) -
      parseInt(parentStyle.paddingRight);

    this.squareSize = Math.floor((parentWidth - 2 * this.boardBorderWidth) / 8);
    this.squareSize = Math.min(this.squareSize, this.options.maxSquareSize);
    this.squareSize = Math.max(this.squareSize, this.options.minSquareSize);
  }

  /** Gets the CSS background position of a piece's sprite. */
  private backgroundPosition(piece: string | null): string {
    const size = this.squareSize;

    switch (piece) {
      case "wP":
        return "0 0";
      case "wB":
        return -1 * size + "px 0";
      case "wN":
        return -2 * size + "px 0";
      case "wR":
        return -3 * size + "px 0";
      case "wQ":
        return -4 * size + "px 0";
      case "wK":
        return -5 * size + "px 0";
      case "bP":
        return "0 " + -1 * size + "px";
      case "bB":
        return -1 * size + "px " + -1 * size + "px";
      case "bN":
        return -2 * size + "px " + -1 * size + "px";
      case "bR":
        return -3 * size + "px " + -1 * size + "px";
      case "bQ":
        return -4 * size + "px " + -1 * size + "px";
      case "bK":
        return -5 * size + "px " + -1 * size + "px";
      default:
        return "0 0";
    }
  }

  private clearSquare(square: Square): void {
    const boardSquare = this.getBoardSquare(square);

    if (boardSquare.piece !== null) {
      boardSquare.element.classList.remove(boardSquare.piece);
    }

    boardSquare.piece = null;
  }

  private putPiece(square: Square, piece: string): void {
    const boardSquare = this.getBoardSquare(square);
    const currentPiece = boardSquare.piece;

    if (currentPiece !== null) {
      boardSquare.element.classList.remove(currentPiece);
    }

    boardSquare.element.classList.add(piece);
    boardSquare.element.style.backgroundPosition = this.backgroundPosition(piece);
    boardSquare.piece = piece;
  }
}

/** Calculates the name of the square at the given row (1-8) and column (0-7). */
function calcSquare(row: number, column: number): Square {
  return String.fromCharCode(97 + column) + row;
}

function repeatChar(char: string, count: number): string {
  let result = "";
  while (result.length < count) {
    result += char;
  }

  return result;
}

function calcPieceFromFenPiece(fenPiece: string): string {
  const fenPieceCharCode = fenPiece.charCodeAt(0);

  if (fenPieceCharCode >= 97) {
    // Black
    return "b" + String.fromCharCode(fenPieceCharCode - 32);
  } else {
    // White
    return "w" + fenPiece;
  }
}
