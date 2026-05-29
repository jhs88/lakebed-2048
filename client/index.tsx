import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "lakebed/client";
import { createNewBoard, makeMove, hasWon, isGameOver, type Board, type Direction, type MoveResult } from "../shared/game";

type LeaderboardEntry = {
  id: string;
  score: string;
  won: boolean;
  playerName: string;
  playerPicture: string;
};

type Page = "game" | "scores";

// ── Animation keyframes (injected once) ────────────────────────

const animationStyleId = "game-animations";

function useAnimationStyles() {
  useEffect(() => {
    if (document.getElementById(animationStyleId)) return;
    const style = document.createElement("style");
    style.id = animationStyleId;
    style.textContent = `
      @keyframes tileSpawn {
        0% { opacity: 0; transform: scale(0); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes tileMerge {
        0% { transform: scale(1); }
        40% { transform: scale(1.18); }
        100% { transform: scale(1); }
      }
      @keyframes scorePulse {
        0% { transform: scale(1); }
        40% { transform: scale(1.18); color: #fbbf24; }
        100% { transform: scale(1); color: inherit; }
      }
      .animate-tile-spawn {
        animation: tileSpawn 200ms ease-out both;
      }
      .animate-tile-merge {
        animation: tileMerge 150ms ease-in-out both;
      }
      .animate-score-pulse {
        animation: scorePulse 200ms ease-in-out both;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

// Tile color map for Tailwind classes
function tileClasses(value: number): string {
  const base = "flex items-center justify-center font-bold rounded-lg transition-all duration-150 select-none";
  switch (value) {
    case 0: return `${base} bg-neutral-800`;
    case 2: return `${base} bg-stone-200 text-stone-700`;
    case 4: return `${base} bg-amber-100 text-stone-700`;
    case 8: return `${base} bg-orange-300 text-white`;
    case 16: return `${base} bg-orange-500 text-white`;
    case 32: return `${base} bg-red-400 text-white`;
    case 64: return `${base} bg-red-600 text-white`;
    case 128: return `${base} bg-yellow-300 text-stone-700 text-xl`;
    case 256: return `${base} bg-yellow-400 text-stone-700 text-xl`;
    case 512: return `${base} bg-yellow-500 text-white text-xl`;
    case 1024: return `${base} bg-amber-500 text-white text-lg`;
    case 2048: return `${base} bg-amber-400 text-white text-lg shadow-lg shadow-amber-400/50`;
    default: return `${base} bg-purple-600 text-white text-lg`;
  }
}

function tileSize(value: number): string {
  return value >= 1024 ? "text-lg" : value >= 128 ? "text-xl" : "text-2xl";
}

function Avatar({ label, picture }: { label: string; picture?: string }) {
  const initial = label.trim().slice(0, 1).toUpperCase() || "?";
  if (picture) {
    return (
      <img
        alt=""
        className="h-6 w-6 shrink-0 rounded-full border border-neutral-700 bg-neutral-900 object-cover"
        referrerPolicy="no-referrer"
        src={picture}
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-[10px] font-medium text-neutral-400">
      {initial}
    </span>
  );
}

function rankIcon(rank: number): string {
  switch (rank) {
    case 1: return "👑";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return `#${rank}`;
  }
}

function rankColor(rank: number): string {
  switch (rank) {
    case 1: return "text-yellow-300";
    case 2: return "text-neutral-400";
    case 3: return "text-amber-600";
    default: return "text-neutral-600";
  }
}

// ── Scores page ────────────────────────────────────────────────

function ScoresPage() {
  const auth = useAuth();
  const leaderboard = useQuery<LeaderboardEntry[]>("leaderboard");

  if (auth.isLoading) {
    return <div className="text-sm text-neutral-500">Loading...</div>;
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <p className="text-lg font-bold text-white">No scores yet</p>
        <p className="mt-1 text-sm text-neutral-500">Play a game and your best score will appear here.</p>
      </div>
    );
  }

  const myId = auth.userId;

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold tracking-tight text-white">All Scores</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[40px_1fr_80px] items-center gap-3 border-b border-neutral-800 px-4 py-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Score</span>
        </div>
        <ul className="divide-y divide-neutral-800">
          {leaderboard.map((entry, i) => {
            const isMe = entry.ownerId === myId;
            return (
              <li
                key={entry.id}
                className={`grid grid-cols-[40px_1fr_80px] items-center gap-3 px-4 py-3 ${isMe ? "bg-neutral-800/60" : ""}`}
              >
                <span className={`text-right font-mono text-sm font-bold ${rankColor(i + 1)}`}>
                  {rankIcon(i + 1)}
                </span>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar label={entry.playerName} picture={entry.playerPicture || undefined} />
                  <div className="min-w-0">
                    <span className="truncate text-sm text-neutral-300">{entry.playerName}</span>
                    {isMe && (
                      <span className="ml-2 rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                        you
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-end gap-2">
                  {entry.won && <span className="text-xs">🏆</span>}
                  <span className="font-mono text-sm font-bold text-white">
                    {parseInt(entry.score, 10).toLocaleString()}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── Game page ──────────────────────────────────────────────────

function GamePage() {
  useAnimationStyles();
  const bestScoreData = useQuery<{ bestScore: number; hasPlayed: boolean }>("bestScore");
  const saveScore = useMutation<[score: number, won: boolean], void>("saveScore");

  const [board, setBoard] = useState<Board>(createNewBoard);
  const [score, setScore] = useState(0);
  const [prevScore, setPrevScore] = useState(0);
  const [scorePulse, setScorePulse] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<MoveResult | null>(null);
  const boardGenRef = useRef(0);

  useEffect(() => {
    if ((gameOver || (won && !keepPlaying)) && score > 0) {
      saveScore(score, won);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, won, keepPlaying]);

  // Score pulse effect
  useEffect(() => {
    if (score > prevScore) {
      setScorePulse(true);
      const t = setTimeout(() => setScorePulse(false), 200);
      return () => clearTimeout(t);
    }
    setPrevScore(score);
  }, [score]);

  const bestScore = bestScoreData?.bestScore ?? 0;

  const handleMove = useCallback((dir: Direction) => {
    if (gameOver || (won && !keepPlaying)) return;

    setBoard((prev) => {
      const result = makeMove(prev, dir, prev, boardGenRef.current);
      if (!result.moved) return prev;

      setScore((s) => s + result.score);
      setLastResult(result);

      if (!won && hasWon(result.board)) {
        setWon(true);
      } else if (isGameOver(result.board)) {
        setGameOver(true);
      }

      return result.board;
    });
  }, [gameOver, won, keepPlaying]);

  const resetGame = () => {
    setBoard(createNewBoard());
    setScore(0);
    setPrevScore(0);
    setGameOver(false);
    setWon(false);
    setKeepPlaying(false);
    setLastResult(null);
    boardGenRef.current++;
  };

  const keyDown = useCallback(
    (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    },
    [handleMove]
  );

  const mainRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    mainRef.current?.focus();
  }, []);

  const handleTouchStart = useCallback((e: Event) => {
    const t = (e as TouchEvent).touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: Event) => {
      if (!touchStart.current) return;
      const t = (e as TouchEvent).changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 30) return;

      if (absDx > absDy) {
        handleMove(dx > 0 ? "right" : "left");
      } else {
        handleMove(dy > 0 ? "down" : "up");
      }
      touchStart.current = null;
    },
    [handleMove]
  );

  return (
    <div ref={mainRef} tabIndex={-1} className="outline-none" onKeyDown={keyDown}>
      {/* Score header */}
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">2048</h1>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">Score</span>
            <span className={`text-xl font-bold ${scorePulse ? "animate-score-pulse" : ""}`}>{score}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">Best</span>
            <span className="text-xl font-bold">{bestScore}</span>
          </div>
        </div>
      </header>

      {/* Game board */}
      <div
        className="relative rounded-xl border border-neutral-800 bg-neutral-900 p-2 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2">
          {board.map((row, r) => row.map((value, c) => {
            const isGenNew = boardGenRef.current > 0 && (!lastResult || lastResult.boardGen !== boardGenRef.current);
            const isNew = !isGenNew && lastResult?.newPositions.some(([pr, pc]) => pr === r && pc === c);
            const isMerged = !isGenNew && lastResult?.mergedPositions.some(([pr, pc]) => pr === r && pc === c);
            const animClass = isGenNew || isNew ? "animate-tile-spawn" : isMerged ? "animate-tile-merge" : "";
            return (
              <div
                key={`${r}-${c}`}
                className={`aspect-square ${tileClasses(value)} ${tileSize(value)} ${animClass}`}
              >
                {value || ""}
              </div>
            );
          }))}
        </div>

        {/* Game Over overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/75 backdrop-blur-sm">
            <p className="mb-4 text-3xl font-bold text-red-400">Game Over</p>
            <p className="mb-4 text-neutral-400">Score: {score}</p>
            <button
              className="rounded-lg border border-white bg-white px-6 py-2 font-bold text-black hover:bg-neutral-200"
              onClick={resetGame}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Win overlay */}
        {won && !keepPlaying && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-amber-400/30 backdrop-blur-sm">
            <p className="mb-2 text-4xl font-extrabold text-amber-300">You Win!</p>
            <p className="mb-4 text-neutral-300">Score: {score}</p>
            <div className="flex gap-3">
              <button
                className="rounded-lg border border-white bg-white px-5 py-2 font-bold text-black hover:bg-neutral-200"
                onClick={resetGame}
              >
                New Game
              </button>
              <button
                className="rounded-lg border border-amber-300 px-5 py-2 font-bold text-amber-300 hover:bg-amber-300/20"
                onClick={() => setKeepPlaying(true)}
              >
                Keep Going
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-neutral-600">Arrow keys / WASD / swipe</p>
        <button
          className="rounded-lg border border-neutral-700 px-4 py-1.5 text-sm font-medium text-neutral-300 hover:border-white hover:text-white"
          onClick={resetGame}
        >
          New Game
        </button>
      </div>
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────

export function App() {
  const auth = useAuth();
  const [page, setPage] = useState<Page>("game");

  const authLabel = auth.displayName ?? auth.email ?? "Guest";

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md">
        {/* Nav tabs */}
        <nav className="mb-6 flex gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              page === "game"
                ? "bg-white text-black"
                : "border border-neutral-700 text-neutral-400 hover:border-white hover:text-white"
            }`}
            onClick={() => setPage("game")}
          >
            Game
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              page === "scores"
                ? "bg-white text-black"
                : "border border-neutral-700 text-neutral-400 hover:border-white hover:text-white"
            }`}
            onClick={() => setPage("scores")}
          >
            Scores
          </button>
        </nav>

        {/* Auth bar */}
        <div className="mb-6 flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {!auth.isLoading && <Avatar label={authLabel} picture={auth.picture} />}
            <span className="truncate text-xs text-neutral-500">
              {auth.isLoading ? "checking..." : auth.isGuest ? "guest" : authLabel}
            </span>
          </div>
          {!auth.isLoading && auth.isGuest ? (
            <SignInWithGoogle className="shrink-0 border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:border-white hover:text-white" />
          ) : !auth.isLoading ? (
            <button className="shrink-0 text-xs text-neutral-500 hover:text-white" type="button" onClick={() => signOut()}>
              Sign out
            </button>
          ) : null}
        </div>

        {/* Page content */}
        {page === "game" && <GamePage />}
        {page === "scores" && <ScoresPage />}
      </div>
    </main>
  );
}
