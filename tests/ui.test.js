// Integration tests for src/app.js using a DOM stub — proves the wiring
// works end to end: setup, taps, undo stack, leader banner, results, saves.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

import { StubElement, StubDocument, StubLocalStorage } from "./dom-stub.js";

const here = path.dirname(url.fileURLToPath(import.meta.url));

const SCREEN_TAGS = {
  "setup-screen": "section",
  "game-screen": "section",
  "results-screen": "section",
  "setup-form": "form",
  "game-name": "input",
  "players-input": "textarea",
  "saved-list": "ul",
  "clear-saved": "button",
  "game-title": "h2",
  "leader-banner": "div",
  "player-list": "ul",
  "history-list": "ul",
  "history-empty": "p",
  "undo-btn": "button",
  "end-btn": "button",
  "back-setup-btn": "button",
  "results-game-name": "p",
  "winner-banner": "div",
  "standings-list": "ol",
  "again-btn": "button",
  toast: "div",
};

let state = null;

/**
 * Tiny bundler: because the browser app is native ESM but vm.runInNewContext
 * needs CommonJS-ish single-scope code, we concatenate the modules and strip
 * import/export statements. The modules are plain top-level JavaScript, so
 * this is sound for test purposes.
 */
function bundleAppSource() {
  const read = (rel) =>
    fs
      .readFileSync(path.join(here, "..", rel), "utf8")
      .replace(/^import[^;]+;\s*$/gm, "")
      .replace(/^export\s+/gm, "")
      .replace(/^\s*$/gm, "\n");
  return [read("src/scoring.js"), read("src/storage.js"), read("src/app.js")].join("\n;\n");
}

function bootApp(inheritedStorage) {
  const storage = inheritedStorage ?? new StubLocalStorage();
  const documentStub = new StubDocument(SCREEN_TAGS);
  const context = {
    document: documentStub,
    localStorage: storage,
    setTimeout,
    clearTimeout,
    console,
  };
  context.globalThis = context;
  vm.runInNewContext(bundleAppSource(), context, { filename: "app-bundle.js" });
  return { ctx: context, doc: documentStub, storage };
}

/** Start a game through the real form handler. */
function startGame(app, gameName, names) {
  const doc = app.doc;
  doc.get("game-name").value = gameName;
  doc.get("players-input").value = names.join("\n");
  doc.get("setup-form").dispatch("submit");
}

/** Click the plus/minus button in a player row. */
function tapPlus(app, playerName) {
  const row = app.doc
    .get("player-list")
    .findDescendants((el) => el.className.includes("player-row"))
    .find((r) => r.findDescendants((el) => el.className.includes("player-name"))[0]?._text === playerName);
  const plus = row.findDescendants(
    (el) => el.className.includes("btn-plus") && el.tagName === "BUTTON"
  )[0];
  plus.dispatch("click");
}

function tapMinus(app, playerName) {
  const row = app.doc
    .get("player-list")
    .findDescendants((el) => el.className.includes("player-row"))
    .find((r) => r.findDescendants((el) => el.className.includes("player-name"))[0]?._text === playerName);
  const minus = row.findDescendants(
    (el) => el.className.includes("btn-minus") && el.tagName === "BUTTON"
  )[0];
  minus.dispatch("click");
}

function playerRowScore(app, playerName) {
  const row = app.doc
    .get("player-list")
    .findDescendants((el) => el.className.includes("player-row"))
    .find((r) => r.findDescendants((el) => el.className.includes("player-name"))[0]?._text === playerName);
  return row.findDescendants((el) => el.className.includes("player-score"))[0]._text;
}

function visibleScreen(app) {
  const ids = ["setup-screen", "game-screen", "results-screen"];
  return ids.find((id) => app.doc.get(id).hidden === false);
}

beforeEach(() => {
  // Each test boots a fresh app instance.
});

test("app boots to the setup screen with a populated saved list", () => {
  const app = bootApp();
  assert.equal(visibleScreen(app), "setup-screen");
  assert.match(app.doc.get("saved-list").text, /No finished games yet/i);
});

test("starting a game shows rows with giant plus/minus buttons", () => {
  const app = bootApp();
  startGame(app, "", ["Alice", "Bob"]);
  assert.equal(visibleScreen(app), "game-screen");
  const doc = app.doc;
  assert.equal(doc.get("game-title")._text, "Game Night"); // blank name -> default
  const rows = doc.get("player-list").findDescendants((el) => el.className.includes("player-row"));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.findDescendants((el) => el.className.includes("btn-plus"))[0].tagName, "BUTTON");
    assert.equal(row.findDescendants((el) => el.className.includes("btn-minus"))[0].tagName, "BUTTON");
  }
});

test("setup rejects a form with no player names", () => {
  const app = bootApp();
  doc: {
    /* noop */
  }
  app.doc.get("game-name").value = "Yolo";
  app.doc.get("players-input").value = "";
  app.doc.get("setup-form").dispatch("submit");
  assert.equal(visibleScreen(app), "setup-screen");
  assert.match(app.doc.get("toast")._text, /at least one player/i);
});

test("tapping plus scores points and updates the leader banner", () => {
  const app = bootApp();
  startGame(app, "Catan", ["Alice", "Bob"]);
  tapPlus(app, "Bob");
  tapPlus(app, "Bob");
  tapPlus(app, "Bob");
  assert.equal(playerRowScore(app, "Bob"), "3");
  assert.match(app.doc.get("leader-banner")._text, /Leader: Bob \(3\)/);
  // History lists the change, newest first, with running totals.
  assert.match(app.doc.get("history-list").text, /Bob \+1 \(3\)/);
});

test("tapping minus subtracts points", () => {
  const app = bootApp();
  startGame(app, "Hearts", ["Ann", "Bea"]);
  tapMinus(app, "Ann");
  assert.equal(playerRowScore(app, "Ann"), "-1");
  assert.match(app.doc.get("leader-banner")._text, /Leader: Bea \(0\)/);
});

test("undo button walks the stack back and disables at zero", () => {
  const app = bootApp();
  startGame(app, "Mwah", ["Alice", "Bob"]);
  const undoBtn = app.doc.get("undo-btn");
  assert.equal(undoBtn.disabled, true);

  tapPlus(app, "Alice");
  tapMinus(app, "Bob");
  tapPlus(app, "Bob");
  assert.equal(undoBtn.disabled, false);

  undoBtn.dispatch("click");
  assert.equal(playerRowScore(app, "Bob"), "-1"); // Bob's +1 undone

  undoBtn.dispatch("click");
  assert.equal(playerRowScore(app, "Bob"), "0"); // Bob's -1 undone

  undoBtn.dispatch("click");
  assert.equal(playerRowScore(app, "Alice"), "0"); // Alice's +1 undone
  assert.equal(undoBtn.disabled, true); // empty stack disables the button
});

test("undo after undo restores the leader banner", () => {
  const app = bootApp();
  startGame(app, "Qi", ["Xu", "Yi"]);
  tapPlus(app, "Xu");
  assert.match(app.doc.get("leader-banner")._text, /Leader: Xu \(1\)/);
  app.doc.get("undo-btn").dispatch("click");
  // Back to an all-tie at zero.
  assert.match(app.doc.get("leader-banner")._text, /Tie: Xu & Yi \(0\)/);
});

test("end game shows results, saves locally, and disables state", () => {
  const app = bootApp();
  startGame(app, "Codenames", ["Dara", "Emil"]);
  tapPlus(app, "Emil");
  tapPlus(app, "Emil");
  tapPlus(app, "Dara");
  app.doc.get("end-btn").dispatch("click");

  assert.equal(visibleScreen(app), "results-screen");
  assert.match(app.doc.get("winner-banner")._text, /Emil wins with 2 points!/);
  assert.match(app.doc.get("standings-list").text, /Emil: 2/);

  // Result was saved to local storage.
  const saved = JSON.parse(app.storage.getItem("tsk.finishedGames.v1"));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].gameName, "Codenames");
  assert.deepEqual(saved[0].winnerNames, ["Emil"]);
  assert.equal(saved[0].standings[0].name, "Emil");

  // Clearing works.
  app.doc.get("again-btn").dispatch("click");
  app.doc.get("clear-saved").dispatch("click");
  assert.equal(app.storage.getItem("tsk.finishedGames.v1"), null);
  assert.match(app.doc.get("saved-list").text, /No finished games yet/i);
});

test("finished game results render on the next boot", () => {
  const app = bootApp();
  startGame(app, "Sushi Go", ["Gus", "Hal"]);
  tapPlus(app, "Gus");
  app.doc.get("end-btn").dispatch("click");

  const app2 = bootApp(app.storage);
  assert.match(app2.doc.get("saved-list").text, /Sushi Go: Gus won \(1\)/);
});

test("an in-progress game is restored as a draft after reboot", () => {
  const app = bootApp();
  startGame(app, "Azul", ["Ivy", "Jo"]);
  tapPlus(app, "Ivy");
  tapPlus(app, "Ivy");
  tapMinus(app, "Jo");

  const app2 = bootApp(app.storage);
  assert.equal(visibleScreen(app2), "game-screen"); // draft restored, not setup
  assert.equal(app2.doc.get("game-title")._text, "Azul");
  assert.equal(playerRowScore(app2, "Ivy"), "2");
  assert.equal(playerRowScore(app2, "Jo"), "-1");
  // Undo stack is intact — undo restores Jo's -1.
  app2.doc.get("undo-btn").dispatch("click");
  assert.equal(playerRowScore(app2, "Jo"), "0");

  // New game clears the draft.
  app2.doc.get("back-setup-btn").dispatch("click");
  assert.equal(visibleScreen(app2), "setup-screen");
  assert.equal(app2.storage.getItem("tsk.currentGame.v1"), null);
});

test("duplicate player names are rejected with a toast", () => {
  const app = bootApp();
  startGame(app, "Uno", ["Sam", "Sam"]);
  assert.equal(visibleScreen(app), "setup-screen");
  assert.match(app.doc.get("toast")._text, /unique/i);
});

test("leader row is visually highlighted", () => {
  const app = bootApp();
  startGame(app, "Ra", ["Kit", "Luz"]);
  tapPlus(app, "Luz");
  const rows = app.doc.get("player-list").findDescendants((el) => el.className.includes("player-row"));
  const luzRow = rows.find((r) => r.findDescendants((el) => el.className.includes("player-name"))[0]?._text === "Luz");
  assert.ok(luzRow.className.includes("is-leader"));
  const kitRow = rows.find((r) => r.findDescendants((el) => el.className.includes("player-name"))[0]?._text === "Kit");
  assert.ok(!kitRow.className.includes("is-leader"));
});
