// Pure scoring engine for the tabletop score keeper.
// No DOM, no storage — all state mutations return new state so it is
// trivially testable.

let nextId = 1;
function freshId() {
  return nextId++;
}

export function createPlayers(names) {
  if (!Array.isArray(names)) throw new Error("playerNames must be an array");
  const cleaned = names.map((n) => String(n).trim()).filter((n) => n.length > 0);
  const unique = cleaned.filter((n, i) => cleaned.indexOf(n) === i);
  if (unique.length === 0) throw new Error("at least one player is required");
  if (unique.length !== cleaned.length) {
    throw new Error("player names must be unique");
  }
  return unique.map((name) => ({ id: freshId(), name, score: 0 }));
}

export function createGame(gameName, playerNames) {
  return {
    gameName: String(gameName ?? "").trim() || "Game Night",
    players: createPlayers(playerNames),
    history: [],
    finished: false,
    finishedAt: null,
    undoStack: [],
  };
}

export function findPlayer(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`unknown player: ${playerId}`);
  return player;
}

export function addScore(state, playerId, delta) {
  if (state.finished) throw new Error("game is over; start a new game");
  const value = Number(delta);
  if (!Number.isFinite(value)) throw new Error("delta must be a finite number");
  if (!Number.isInteger(value)) throw new Error("delta must be an integer");
  if (value === 0) return state; // tapping +0 changes nothing; keep no-op legal
  const player = findPlayer(state, playerId);
  const next = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, score: p.score + value } : p
    ),
    history: [
      ...state.history,
      {
        playerId,
        playerName: player.name,
        delta: value,
        total: player.score + value,
        at: new Date().toISOString(),
      },
    ],
    undoStack: [...state.undoStack, { playerId, delta: value }],
  };
  return next;
}

export function canUndo(state) {
  return state.undoStack.length > 0 && !state.finished;
}

export function undo(state) {
  if (!canUndo(state)) return state;
  const undoStack = state.undoStack.slice();
  const last = undoStack.pop();
  const player = findPlayer(state, last.playerId);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === last.playerId ? { ...p, score: p.score - last.delta } : p
    ),
    history: state.history.slice(0, -1),
    undoStack,
  };
}

export function getLeader(state) {
  if (state.players.length === 0) return null;
  const sorted = state.players.slice().sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const tied = sorted.filter((p) => p.score === top.score);
  if (tied.length > 1) {
    return { names: tied.map((p) => p.name), score: top.score, tie: true };
  }
  return { names: [top.name], score: top.score, tie: false };
}

export function getStandings(state) {
  return state.players
    .slice()
    .sort(
      (a, b) =>
        b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
}

export function endGame(state) {
  if (state.finished) return state;
  const leader = getLeader(state);
  return {
    ...state,
    finished: true,
    finishedAt: new Date().toISOString(),
    result: {
      winnerNames: leader ? leader.names : [],
      winnerScore: leader ? leader.score : 0,
      tie: leader ? leader.tie : false,
      standings: getStandings(state).map((p) => ({
        name: p.name,
        score: p.score,
      })),
    },
  };
}

export function formatHistoryEntry(entry) {
  const sign = entry.delta > 0 ? "+" : "";
  return `${entry.playerName} ${sign}${entry.delta} (${entry.total})`;
}
