# STATUS

**Project:** Tabletop Score Keeper — big-button offline score keeper for game night
**Owner:** Asdale Dynamics, LLC
**Date:** 2026-11-07
**Status:** Complete and verified

## What was built

A zero-dependency, offline-capable web app for keeping score in tabletop
games:

- **Setup screen** — name the game (defaults to "Game Night" if blank),
  enter player names one per line; duplicate or missing names are rejected
  with friendly toasts.
- **Scorekeeping screen** — each player row shows rank, name, running total,
  and a giant green **+** / red **−** button (76×104px tap targets).
- **Undo stack** — "Undo last tap" step-by-step reverts every point change;
  the button disables once the stack is empty and after the game ends.
- **Bold leader display** — accent-colored banner shows the leader or tie
  after every tap; leader rows get an accent border. (0–0 ties are not
  highlighted until points are scored.)
- **Round history** — every change listed newest-first with signed deltas
  and running totals.
- **End-of-game results** — "End game" freezes the game, shows a winner/tie
  banner with final standings, and saves the result to local storage
  (capped at 100 entries). Results survive reloads and are listed on the
  setup screen.
- **Draft recovery** — an in-progress game is saved and restored
  automatically (including its undo history) if the page is reloaded.
- **Offline support** — service worker (`sw.js`, cache-first, versioned
  precache) plus a web app manifest; installable, fully usable with no
  network.
- **Accessibility** — skip link, semantic landmarks/headings, real buttons
  with aria-labels naming the player, live-region banners and toasts,
  visible focus outlines, `prefers-reduced-motion` support.
- **Privacy** — no accounts, no backend, no network calls beyond serving the
  app shell; all data stays in the browser's local storage.

Deliberately distinct from sibling projects: `chess-two-player-board-webapp`
(plays chess) and `free-game-night-hosting-pack` (printable hosting kit) —
this one scores any tabletop game.

## How to run it

```bash
npm start          # serves at http://localhost:8080 (Node 18+)
# or: node server.js <port>
```

No dependencies, no build step. `npm test` runs the test suite.

## Verification (all green on 2026-11-07)

- `npm test` — 34/34 passing, 0 failing:
  - `tests/scoring.test.js` (22): creation, scoring (+/-), invalid deltas,
    undo stack step-by-step, undo safety, leader/tie detection, standings,
    end-game snapshot & idempotence, formatting, id uniqueness.
  - `tests/ui.test.js` (12): full wiring through the real `src/app.js` in a
    DOM stub — setup → taps → undo → end game → saved results → draft
    restore on reload → undo of a restored draft.
- Headless Chrome (real browser): page loads, module script executes, setup
  screen renders with saved-list populated, other screens correctly hidden.
- Static server smoke test: all app files serve HTTP 200; path-traversal
  attempts are blocked (403/404).
- `node --check` passes on every JS file.

## Known gaps

- A game name containing `-1`-style notation could look odd in history
  lines (cosmetic only). Player names including `"&"` render literally via
  `textContent` (safe, no HTML injection).
- Negative scores are allowed (intentional — many games go below zero); no
  UI toggle to disable.
- The "clear saved results" button deletes all finished games at once; no
  per-result delete or undo of the clear.
- Service worker caching is cache-first: deploy new versions by bumping
  `CACHE` version in `sw.js`.
- No automated end-to-end browser-driver test (e.g. Playwright); coverage
  relies on unit + DOM-stub integration tests and a manual headless-Chrome
  boot check.
- Data is per-browser-profile only (standard for local-first apps); there
  is no export/import of saved results yet.

## Files

`index.html`, `styles.css`, `src/app.js`, `src/scoring.js`,
`src/storage.js`, `sw.js`, `manifest.json`, `favicon.svg`, `server.js`,
`tests/` (scoring, ui, dom-stub), `README.md`, `LICENSE`, `package.json`,
`.gitignore`.
