import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createGame,
  addScore,
  undo,
  canUndo,
  getLeader,
  getStandings,
  endGame,
  formatHistoryEntry,
  createPlayers,
} from "../src/scoring.js";

function newGame() {
  return createGame("Catan", ["Alice", "Bob", "Cass"]);
}

function playerIdOf(state, name) {
  return state.players.find((p) => p.name === name).id;
}

test("createGame starts everyone at zero", () => {
  const game = newGame();
  assert.equal(game.gameName, "Catan");
  assert.deepEqual(
    game.players.map((p) => p.score),
    [0, 0, 0]
  );
  assert.equal(game.history.length, 0);
  assert.equal(game.finished, false);
});

test("createGame rejects empty or duplicate player names", () => {
  assert.throws(() => createGame("X", []), /at least one player/);
  assert.throws(() => createGame("X", ["  ", "   "]), /at least one player/);
  assert.throws(() => createGame("X", ["Al", "Al", "Bo"]), /unique/);
  assert.throws(() => createGame("X", "not-an-array"));
});

test("createGame trims whitespace and ignores blank entries only when others exist", () => {
  const game = createGame("X", [" Al ", "Bo", "  "]);
  assert.deepEqual(
    game.players.map((p) => p.name),
    ["Al", "Bo"]
  );
});

test("createGame falls back to a default game name", () => {
  assert.equal(createGame("   ", ["A"]).gameName, "Game Night");
});

test("addScore increases a player's score and records history", () => {
  let game = newGame();
  const alice = playerIdOf(game, "Alice");
  game = addScore(game, alice, 3);
  game = addScore(game, alice, 2);
  assert.equal(game.players[0].score, 5);
  assert.equal(game.players[1].score, 0);
  assert.equal(game.history.length, 2);
  assert.equal(game.undoStack.length, 2);
  assert.deepEqual(game.history[0], {
    playerId: alice,
    playerName: "Alice",
    delta: 3,
    total: 3,
    at: game.history[0].at,
  });
  assert.equal(game.history[1].total, 5);
});

test("addScore supports negative points", () => {
  let game = newGame();
  const bob = playerIdOf(game, "Bob");
  game = addScore(game, bob, 4);
  game = addScore(game, bob, -1);
  assert.equal(game.players[1].score, 3);
  assert.equal(game.history[1].delta, -1);
});

test("addScore rejects non-integer and non-finite deltas", () => {
  let game = newGame();
  const alice = playerIdOf(game, "Alice");
  assert.throws(() => addScore(game, alice, 1.5), /integer/);
  assert.throws(() => addScore(game, alice, Number.NaN), /finite/);
  assert.throws(() => addScore(game, alice, Infinity), /finite/);
  assert.throws(() => addScore(game, alice, "two"), /finite/);
});

test("addScore rejects an unknown player and a finished game", () => {
  const game = newGame();
  assert.throws(() => addScore(game, 9999, 1), /unknown player/);
  const done = endGame(game);
  assert.throws(() => addScore(done, playerIdOf(game, "Alice"), 1), /over/);
});

test("addScore with delta 0 is a no-op", () => {
  const game = newGame();
  const alice = playerIdOf(game, "Alice");
  const next = addScore(game, alice, 0);
  assert.equal(next, game);
});

test("undo reverses the most recent score change", () => {
  let game = newGame();
  const alice = playerIdOf(game, "Alice");
  const bob = playerIdOf(game, "Bob");
  game = addScore(game, alice, 5);
  game = addScore(game, bob, 2);
  game = undo(game);
  // Bob's +2 should be gone; Alice's +5 remains.
  assert.equal(game.players[0].score, 5);
  assert.equal(game.players[1].score, 0);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].playerName, "Alice");
  assert.equal(game.undoStack.length, 1);
});

test("undo after a negative move restores the pre-move score", () => {
  let game = newGame();
  const cass = playerIdOf(game, "Cass");
  game = addScore(game, cass, 3);
  game = addScore(game, cass, -2);
  assert.equal(game.players[2].score, 1);
  game = undo(game);
  assert.equal(game.players[2].score, 3);
  assert.equal(game.history.length, 1);
});

test("the entire scoring stack can be undone step by step", () => {
  let game = newGame();
  const alice = playerIdOf(game, "Alice");
  const bob = playerIdOf(game, "Bob");
  game = addScore(game, alice, 5);
  game = addScore(game, bob, -2);
  game = addScore(game, alice, 1);
  assert.equal(game.players[0].score, 6);
  game = undo(game);
  assert.equal(game.players[0].score, 5);
  game = undo(game);
  assert.equal(game.players[1].score, 0);
  game = undo(game);
  assert.equal(game.players[0].score, 0);
  assert.equal(game.history.length, 0);
  assert.equal(canUndo(game), false);
});

test("undo on an empty stack is a safe no-op", () => {
  const game = newGame();
  const next = undo(game);
  assert.equal(next, game);
  assert.equal(canUndo(game), false);
});

test("undo is blocked after the game ends", () => {
  let game = newGame();
  const alice = playerIdOf(game, "Alice");
  game = addScore(game, alice, 7);
  const done = endGame(game);
  assert.equal(canUndo(done), false);
  assert.equal(undo(done), done);
});

test("getLeader reports a single leader correctly", () => {
  let game = newGame();
  game = addScore(game, playerIdOf(game, "Bob"), 9);
  game = addScore(game, playerIdOf(game, "Alice"), 4);
  const leader = getLeader(game);
  assert.equal(leader.tie, false);
  assert.deepEqual(leader.names, ["Bob"]);
  assert.equal(leader.score, 9);
});

test("getLeader reports ties with every tied player", () => {
  let game = newGame();
  game = addScore(game, playerIdOf(game, "Alice"), 3);
  game = addScore(game, playerIdOf(game, "Cass"), 3);
  const leader = getLeader(game);
  assert.equal(leader.tie, true);
  assert.deepEqual(leader.names, ["Alice", "Cass"]);
  assert.equal(leader.score, 3);
});

test("getLeader returns null for a game with no players", () => {
  assert.equal(getLeader({ players: [] }), null);
});

test("getStandings sorts by score descending, names ascending on ties", () => {
  let game = newGame();
  game = addScore(game, playerIdOf(game, "Alice"), 2);
  game = addScore(game, playerIdOf(game, "Bob"), 5);
  game = addScore(game, playerIdOf(game, "Cass"), 2);
  const standings = getStandings(game);
  assert.deepEqual(
    standings.map((p) => p.name),
    ["Bob", "Alice", "Cass"]
  );
});

test("endGame freezes the game and records a winner snapshot", () => {
  let game = newGame();
  game = addScore(game, playerIdOf(game, "Alice"), 10);
  game = addScore(game, playerIdOf(game, "Bob"), 4);
  const done = endGame(game);
  assert.equal(done.finished, true);
  assert.ok(done.finishedAt);
  assert.deepEqual(done.result.winnerNames, ["Alice"]);
  assert.equal(done.result.winnerScore, 10);
  assert.equal(done.result.tie, false);
  assert.deepEqual(
    done.result.standings.map((p) => p.name),
    ["Alice", "Bob", "Cass"]
  );
  // Scores are preserved after finishing.
  assert.equal(done.players[0].score, 10);
  // Calling endGame again is idempotent.
  assert.equal(endGame(done), done);
});

test("endGame records a tie as multiple winners", () => {
  let game = createGame("Scrabble", ["Ann", "Bea"]);
  game = addScore(game, playerIdOf(game, "Ann"), 5);
  game = addScore(game, playerIdOf(game, "Bea"), 5);
  const done = endGame(game);
  assert.equal(done.result.tie, true);
  assert.deepEqual(done.result.winnerNames, ["Ann", "Bea"]);
});

test("formatHistoryEntry renders signed deltas and totals", () => {
  assert.equal(
    formatHistoryEntry({ playerName: "Alice", delta: 3, total: 7 }),
    "Alice +3 (7)"
  );
  assert.equal(
    formatHistoryEntry({ playerName: "Bob", delta: -2, total: 1 }),
    "Bob -2 (1)"
  );
});

test("player ids are unique across games", () => {
  const a = createPlayers(["A", "B"]);
  const b = createPlayers(["C", "D"]);
  const ids = [...a, ...b].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
