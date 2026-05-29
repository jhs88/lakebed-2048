export type Board = number[][];
export type Direction = "up" | "down" | "left" | "right";

export function createEmptyBoard(): Board {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}

export function addRandomTile(board: Board): Board {
  const newBoard = board.map((row) => [...row]);
  const emptyCells: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (newBoard[r][c] === 0) emptyCells.push([r, c]);
    }
  }
  if (emptyCells.length === 0) return newBoard;
  const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newBoard;
}

export function createNewBoard(): Board {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  return addRandomTile(board);
}

function rotateClockwise(board: Board): Board {
  const newBoard = createEmptyBoard();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      newBoard[c][3 - r] = board[r][c];
    }
  }
  return newBoard;
}

function rotateCounterClockwise(board: Board): Board {
  const newBoard = createEmptyBoard();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      newBoard[3 - c][r] = board[r][c];
    }
  }
  return newBoard;
}

// Slide a single row left: compress, merge adjacent equals, compress again
function slideLeft(row: number[]): { newRow: number[]; scoreGain: number } {
  let scoreGain = 0;
  // Compress: remove zeros
  const filtered = row.filter((v) => v !== 0);
  // Merge adjacent equals
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      scoreGain += filtered[i];
      filtered.splice(i + 1, 1);
    }
  }
  // Pad with zeros to length 4
  const newRow = [0, 0, 0, 0];
  for (let i = 0; i < filtered.length && i < 4; i++) {
    newRow[i] = filtered[i];
  }
  return { newRow, scoreGain };
}

// Move the board left, returning new board and score gained
function moveLeft(board: Board): { board: Board; score: number } {
  let totalScore = 0;
  const newBoard = board.map((row) => {
    const result = slideLeft(row);
    totalScore += result.scoreGain;
    return result.newRow;
  });
  return { board: newBoard, score: totalScore };
}

// Normalize any direction to "left" by rotating, then rotate back
function move(board: Board, dir: Direction): { board: Board; score: number } {
  let rotated = board;
  switch (dir) {
    case "up":
      rotated = rotateCounterClockwise(board);
      break;
    case "down":
      rotated = rotateClockwise(board);
      break;
    case "left":
      rotated = board;
      break;
    case "right":
      rotated = rotateClockwise(rotateClockwise(board));
      break;
  }

  const result = moveLeft(rotated);

  let finalBoard: Board;
  switch (dir) {
    case "up":
      finalBoard = rotateClockwise(result.board);
      break;
    case "down":
      finalBoard = rotateCounterClockwise(result.board);
      break;
    case "left":
      finalBoard = result.board;
      break;
    case "right":
      finalBoard = rotateClockwise(rotateClockwise(result.board));
      break;
  }

  return { board: finalBoard, score: result.score };
}

export type MoveResult = {
  board: Board;
  score: number;
  moved: boolean;
  newPositions: [number, number][];
  mergedPositions: [number, number][];
  boardGen: number;
};

export function makeMove(
  board: Board,
  dir: Direction,
  prevBoard?: Board,
  boardGen?: number,
): MoveResult {
  const result = move(board, dir);
  const moved = !boardsEqual(board, result.board);
  const finalBoard = moved ? addRandomTile(result.board) : board;

  const newPositions: [number, number][] = [];
  const mergedPositions: [number, number][] = [];

  if (prevBoard && moved) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const prev = prevBoard[r][c];
        const curr = finalBoard[r][c];
        if (prev === 0 && curr !== 0) {
          newPositions.push([r, c]);
        } else if (prev !== 0 && curr !== 0 && curr === prev * 2) {
          mergedPositions.push([r, c]);
        }
      }
    }
  }

  return { board: finalBoard, score: result.score, moved, newPositions, mergedPositions, boardGen: boardGen ?? 0 };
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function hasWon(board: Board): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 2048) return true;
    }
  }
  return false;
}

export function isGameOver(board: Board): boolean {
  // Check for empty cells
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  // Check for possible merges
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r][c];
      if (c < 3 && board[r][c + 1] === val) return false;
      if (r < 3 && board[r + 1][c] === val) return false;
    }
  }
  return true;
}

export function getScoreFromBoard(board: Board): number {
  let score = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      score += board[r][c];
    }
  }
  return score;
}
