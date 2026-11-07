// UI wiring for the Tabletop Score Keeper. Imports pure scoring logic
// from scoring.js and persistence from storage.js.

import {
  createGame,
  addScore,
  undo,
  canUndo,
  getLeader,
  endGame,
  formatHistoryEntry,
} from "./scoring.js";
import { loadResults, saveResult, clearResults, loadDraft, saveDraft } from "./storage.js";

const $ = (id) => document.getElementById(id);

const setupScreen = $("setup-screen");
const gameScreen = $("game-screen");
const resultsScreen = $("results-screen");

const els = {
  setupForm: $("setup-form"),
  gameName: $("game-name"),
  playersInput: $("players-input"),
  savedList: $("saved-list"),
  clearSaved: $("clear-saved"),
  gameTitle: $("game-title"),
  leaderBanner: $("leader-banner"),
  playerList: $("player-list"),
  historyList: $("history-list"),
  historyEmpty: $("history-empty"),
  undoBtn: $("undo-btn"),
  endBtn: $("end-btn"),
  backSetupBtn: $("back-setup-btn"),
  resultsGameName: $("results-game-name"),
  winnerBanner: $("winner-banner"),
  standingsList: $("standings-list"),
  againBtn: $("again-btn"),
  toast: $("toast"),
};

let state = null;
let toastTimer = null;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function show(screen) {
  for (const el of [setupScreen, gameScreen, resultsScreen]) el.hidden = true;
  screen.hidden = false;
}

/* ---------- Setup screen ---------- */

function renderSaved() {
  const results = loadResults();
  els.savedList.replaceChildren();
  if (results.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "No finished games yet.";
    els.savedList.appendChild(li);
    els.clearSaved.disabled = true;
    return;
  }
  els.clearSaved.disabled = false;
  for (const r of results) {
    const li = document.createElement("li");
    const when = new Date(r.finishedAt);
    const whenText = Number.isNaN(when.getTime())
      ? ""
      : ` — ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    li.textContent = `${r.gameName}: ${r.winnerNames.join(" & ")} ${
      r.tie ? "tied" : "won"
    } (${r.winnerScore})${whenText}`;
    els.savedList.appendChild(li);
  }
}

els.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const names = els.playersInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (names.length === 0) {
    showToast("Add at least one player name.");
    return;
  }
  try {
    startGame(els.gameName.value, names);
  } catch (err) {
    showToast(err.message.startsWith("player names must be unique")
      ? "Player names must be unique."
      : "Could not start the game. Check player names.");
  }
});

function startGame(gameName, names) {
  state = createGame(gameName, names);
  saveDraft(serializeDraft(state));
  renderGame();
  show(gameScreen);
  els.undoBtn.focus();
}

function serializeDraft(s) {
  // Persist a serializable snapshot (ids renumber fine on reload).
  return {
    gameName: s.gameName,
    players: s.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    history: s.history,
    undoStack: s.undoStack,
    finished: false,
    savedAt: new Date().toISOString(),
  };
}

function restoreDraft() {
  const draft = loadDraft();
  if (!draft || draft.finished) return false;
  if (!Array.isArray(draft.players) || draft.players.length === 0) return false;
  state = {
    ...draft,
    finished: false,
    finishedAt: null,
  };
  renderGame();
  show(gameScreen);
  return true;
}

/* ---------- Game screen ---------- */

function renderGame() {
  els.gameTitle.textContent = state.gameName;
  renderLeader();
  renderPlayers();
  renderHistory();
  els.undoBtn.disabled = !canUndo(state);
}

function renderLeader() {
  const leader = getLeader(state);
  if (!leader) {
    els.leaderBanner.textContent = "No leader yet";
    return;
  }
  if (state.finished) return;
  const who = leader.tie ? `Tie: ${leader.names.join(" & ")}` : `Leader: ${leader.names[0]}`;
  els.leaderBanner.textContent = `${who} (${leader.score})`;
}

function renderPlayers() {
  els.playerList.replaceChildren();
  const leaders = getLeader(state);
  const leaderIds = new Set(
    leaders
      ? state.players.filter((p) => p.score === leaders.score).map((p) => p.id)
      : []
  );

  state.players.forEach((player, index) => {
    const isLeader = leaders && leaders.score !== 0 && player.score === leaders.score;
    const row = document.createElement("li");
    row.className = "player-row" + (isLeader ? " is-leader" : "");

    const rank = document.createElement("span");
    rank.className = "player-rank";
    rank.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name;
    name.title = player.name;

    const score = document.createElement("span");
    score.className = "player-score";
    score.textContent = String(player.score);
    score.setAttribute("aria-label", `${player.name} has ${player.score} points`);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "btn btn-point btn-plus";
    plus.textContent = "+";
    const deltaPlus = 1;
    plus.setAttribute(
      "aria-label",
      `Add ${deltaPlus} point to ${player.name}`
    );
    plus.addEventListener("click", () => tapScore(player.id, 1));

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "btn btn-point btn-minus";
    minus.textContent = "\u2212";
    minus.setAttribute(
      "aria-label",
      `Subtract 1 point from ${player.name}`
    );
    minus.addEventListener("click", () => tapScore(player.id, -1));

    // Layout: rank | name | score | plus | minus
    row.append(rank, name, score, plus, minus);
    els.playerList.appendChild(row);
  });
}

function renderHistory() {
  els.historyList.replaceChildren();
  const entries = state.history.slice().reverse(); // newest first
  els.historyEmpty.hidden = entries.length > 0;
  if (entries.length === 0) return;
  entries.forEach((entry) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = formatHistoryEntry(entry);
    const delta = document.createElement("span");
    delta.className = "history-delta " + (entry.delta > 0 ? "positive" : "negative");
    delta.textContent = (entry.delta > 0 ? "+" : "") + entry.delta;
    li.append(label, delta);
    els.historyList.appendChild(li);
  });
}

function tapScore(playerId, delta) {
  if (!state || state.finished) return;
  try {
    state = addScore(state, playerId, delta);
  } catch {
    return;
  }
  saveDraft(serializeDraft(state));
  renderGame();
  announce(playerId, delta);
}

function announce(playerId, delta) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  showToast(`${player.name} ${delta > 0 ? "+" : "-"}${Math.abs(delta)} (${player.score})`);
}

els.undoBtn.addEventListener("click", () => {
  if (!state || !canUndo(state)) return;
  const lastId = state.undoStack[state.undoStack.length - 1]?.playerId;
  state = undo(state);
  saveDraft(serializeDraft(state));
  renderGame();
  if (lastId != null) {
    const player = state.players.find((p) => p.id === lastId);
    if (player) showToast(`Undid last change — ${player.name} back to ${player.score}`);
  }
});

els.endBtn.addEventListener("click", () => {
  if (!state || state.finished) return;
  state = endGame(state);
  const result = {
    gameName: state.gameName,
    winnerNames: state.result.winnerNames,
    winnerScore: state.result.winnerScore,
    tie: state.result.tie,
    standings: state.result.standings,
    finishedAt: state.finishedAt,
  };
  saveResult(result);
  saveDraft(null);
  renderResults();
  show(resultsScreen);
});

els.backSetupBtn.addEventListener("click", () => {
  state = null;
  saveDraft(null);
  renderSaved();
  show(setupScreen);
  els.playersInput.focus();
});

/* ---------- Results screen ---------- */

function renderResults() {
  els.resultsGameName.textContent = state.gameName;
  const r = state.result;
  els.winnerBanner.textContent = r.tie
    ? `Tie: ${r.winnerNames.join(" & ")} (${r.winnerScore} points)`
    : `${r.winnerNames[0]} wins with ${r.winnerScore} points!`;
  els.standingsList.replaceChildren();
  for (const entry of r.standings) {
    const li = document.createElement("li");
    li.textContent = `${entry.name}: ${entry.score}`;
    els.standingsList.appendChild(li);
  }
}

els.againBtn.addEventListener("click", () => {
  state = null;
  saveDraft(null);
  renderSaved();
  show(setupScreen);
  els.playersInput.focus();
});

els.clearSaved.addEventListener("click", () => {
  clearResults();
  renderSaved();
  showToast("Saved results cleared.");
});

/* ---------- Boot ---------- */

if (!restoreDraft()) {
  renderSaved();
  show(setupScreen);
} else {
  renderSaved();
}
