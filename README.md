# Tabletop Score Keeper

A big-button score keeper for game night. Tap **plus** or **minus** for each
player, undo mistakes with one press, watch the bold leader banner, and save
final results right on your device.

Built for real tables: giant touch targets, no accounts, no backend, and it
works offline. Made by [Asdale Dynamics, LLC](https://dylanasdale.github.io)
— friendly tools, explained like a friend would.

## What it does

- **Add players and name the game** — one name per line, at least one player.
- **Tap to score** — each row has a giant green **+** and red **−** button.
- **Undo stack** — "Undo last tap" walks back as many steps as you need.
- **Bold leader display** — the leader (or the tie) updates after every tap.
- **Round history** — every point change, newest first, with running totals.
- **End-of-game results** — finish the game to crown a winner; results are
  saved in your browser's local storage (nothing leaves your device).
- **Won't lose your progress** — an in-progress game is restored if you
  reload or reopen the app.

## How to run it

You need Node.js (18+; any recent version works). In this folder:

```bash
npm start
```

Then open <http://localhost:8080>. Two options for phones on the same Wi-Fi:

```bash
node server.js 8080     # then visit http://<your-computer-ip>:8080 on your phone
```

No build step and no dependencies — plain HTML, CSS, and JavaScript. You can
also just open `index.html` in most browsers, but serving over HTTP lets the
service worker install, which is what makes it fully offline-capable.

## Tests

The scoring engine (points, undo behavior, leader/tie detection, results) and
the full app wiring (setup screen, taps, undo, results, local saves) are
tested with Node's built-in test runner — no test framework to install:

```bash
npm test
```

34 tests total: `tests/scoring.test.js` covers the pure scoring engine, and
`tests/ui.test.js` drives the real `src/app.js` through a DOM stub to prove
the end-to-end flow works.

## How it's built

| File | Role |
| --- | --- |
| `index.html` | App shell: setup, scorekeeping, and results screens |
| `styles.css` | Big-button, high-contrast, mobile-first styling |
| `src/scoring.js` | Pure scoring engine (tested) |
| `src/app.js` | DOM wiring, keyboard/accessibility behavior |
| `src/storage.js` | Local-storage helpers for results + in-progress draft |
| `tests/scoring.test.js` | 22 tests covering scoring and undo behavior |
| `tests/ui.test.js` | 12 end-to-end tests driving the real app wiring |
| `tests/dom-stub.js` | Minimal DOM/localStorage stubs for the UI tests |
| `sw.js` | Service worker that precaches the app shell for offline use |
| `server.js` | Zero-dependency static file server for local use |

Fully offline (service worker precache), no accounts, no backend, no
tracking, no secrets — everything lives in your browser's local storage.

## Accessibility

- Skip link to main content, semantic headings and landmarks
- Giant touch targets (76px+ tap buttons, 64px+ buttons everywhere)
- Every **+**/**−** button is a real `<button>` with an aria-label that
  includes the player name, so screen readers announce each action
- Leader banner and toasts use `role="status"` with polite/assertive live
  regions so point changes are announced
- Visible focus outlines, `prefers-reduced-motion` support

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Asdale Dynamics, LLC.

Related tools from the same family: `chess-two-player-board-webapp` (plays
chess) and `free-game-night-hosting-pack` (printable hosting kit).
