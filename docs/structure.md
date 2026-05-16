# Project Structure

Full file tree of the project with a description of every file's responsibility.

---

## Overview

```
.
├── server.js
├── app.js
├── .env.example
├── package.json
├── config/
│   └── index.js
├── db/
│   └── connection.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── utils/
│   └── validate.js
├── models/
│   ├── Player.js
│   ├── Hero.js
│   ├── Card.js
│   └── PlayerHeroStats.js
├── controllers/
│   ├── authController.js
│   ├── cardsController.js
│   ├── playersController.js
│   └── infoController.js
├── routes/
│   ├── auth.js
│   ├── cards.js
│   ├── players.js
│   └── info.js
├── socket/
│   ├── index.js
│   ├── lobbyHandlers.js
│   ├── gameHandlers.js
│   ├── gameEngine.js
│   ├── reconnectHandlers.js
│   └── statsHandlers.js
└── public/                          ← served as static files by Express
    ├── index.html
    ├── assets/
    │   └── images/                  ← card artwork (one .jpg per card)
    ├── css/
    │   ├── base.css
    │   ├── layout.css
    │   ├── components.css
    │   ├── game.css
    │   └── auth.css
    ├── data/
    │   └── tips.json
    └── js/
        ├── state.js
        ├── api.js
        ├── router.js
        ├── socket.js
        ├── main.js
        ├── views/
        │   ├── auth.js
        │   ├── lobby.js
        │   ├── heroes.js
        │   ├── profile.js
        │   ├── top10.js
        │   └── waiting.js
        └── game/
            ├── renderer.js
            ├── animation.js
            ├── actions.js
            ├── timer.js
            └── socketListeners.js
```

---

## Server

### Entry points

**`server.js`** — HTTP server entry point. Creates the HTTP server from the Express app, attaches Socket.IO, and calls `server.listen()`. Contains no business logic, no route registration, no direct DB access.

**`app.js`** — Express application factory. Configures middleware (CORS, JSON body parsing, static files), mounts all routers under `/api/*`, registers the `/health` endpoint, and attaches the error handler middleware last. Does not call `server.listen()`.

**`.env.example`** — Template listing all required and optional environment variables with placeholder values. Committed to the repo; the real `.env` is gitignored.

---

### `config/index.js`

Reads all environment variables, validates that required ones are present (throws on startup if missing), and exports a single config object used everywhere else. No other file reads `process.env` directly.

Exported keys: `db`, `jwt`, `port`, `clientOrigin`.

Required env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`.
Optional: `DB_NAME` (default: `marvel_card_game`), `PORT` (default: `3000`), `CLIENT_ORIGIN`.

---

### `db/connection.js`

Creates and exports a `mysql2` connection pool configured from `config/`. All DB access goes through this pool via `db.query()`. Never use `db.getConnection()` without releasing it.

---

### Middleware

**`middleware/auth.js`** — JWT verification middleware for HTTP routes. Reads the `Authorization: Bearer <token>` header, verifies the token using `config.jwt.secret`, and attaches `req.user = { userId, username }` for downstream handlers. Returns `401` if the header is missing or the token is invalid. Applied per-route in `routes/`, not globally.

**`middleware/errorHandler.js`** — Centralized Express error handler (4-argument signature). Catches errors passed via `next(err)` or thrown in async controllers (Express 5 catches these automatically). Always responds with `{ "error": "..." }` and logs to `console.error`. Never exposes stack traces. Mounted last in `app.js`.

---

### `utils/validate.js`

Pure validation functions with no side effects. Each returns `{ valid: boolean, message: string }`. Used in controllers as the first step before any business logic or DB calls.

Functions: `validateNickname`, `validatePassword`, `validateUrl`, `validateHeroId`, `validateRoomName`.

---

### Models

One file per database table. Models contain only SQL queries — no HTTP, no socket logic, no validation. They receive plain arguments and return plain data or throw on error.

**`models/Player.js`** — CRUD and stats for the `Player` table.
Methods: `findByNickname`, `create`, `findById`, `getProfile` (with hero stats join), `getTopPlayers`, `updateHero`, `updateSettings`, `recordWin`, `recordLoss`, `recordDraw`.

**`models/Hero.js`** — Read-only access to the `Heroes` table (static seed data).
Methods: `getAll`, `getAllWithCards` (with JSON_ARRAYAGG of cards), `findById`.

**`models/Card.js`** — Read-only access to the `Cards` table.
Methods: `getAll` (with `hero_alias` join), `getByHeroId`, `getExcluding` (used by draw-card logic in the game engine).

**`models/PlayerHeroStats.js`** — Per-hero statistics for each player.
Methods: `upsertResult` (INSERT … ON DUPLICATE KEY UPDATE), `getByPlayer`.

---

### Controllers

Controllers handle `(req, res, next)`. Their structure is always: validate inputs → call model → respond. They do not contain SQL. They do not catch errors — those propagate to `errorHandler`.

**`controllers/authController.js`** — `register` and `login`. Handles password hashing with bcrypt and JWT signing.

**`controllers/playersController.js`** — `getTop`, `getProfile`, `updateHero`, `updateSettings`. The mutation endpoints also check ownership (`req.user.username === req.params.nickname`) and return `403` if the token belongs to a different player.

**`controllers/cardsController.js`** — `getAll`. Returns all 21 cards with their hero alias.

**`controllers/infoController.js`** — `getHeroes`. Returns all heroes with their associated cards.

---

### Routes

Route files only register paths, attach middleware, and wire controllers. No logic here.

**`routes/auth.js`** — `POST /api/auth/register`, `POST /api/auth/login`.

**`routes/players.js`** — `GET /api/players/top`, `GET /api/players/:nickname` (public); `PUT /api/players/:nickname/hero`, `PUT /api/players/:nickname/settings` (auth-protected).

**`routes/cards.js`** — `GET /api/cards` (auth-protected).

**`routes/info.js`** — `GET /api/info/heroes` (auth-protected).

---

### Socket

**`socket/index.js`** — Socket.IO setup. Creates the `io` instance with CORS config, registers the JWT auth middleware (`io.use()`), creates the shared `rooms` and `reconnectTimers` objects, and wires handler modules inside `io.on('connection')`. Exports a function that receives the HTTP server.

**`socket/lobbyHandlers.js`** — Handles room management before a game starts. Registers: `create-room`, `join-room`, `leave-room`, `get-rooms`. Calls `gameEngine.dealCards()` when the second player joins, emits `game-start` to both players.

**`socket/gameHandlers.js`** — Handles in-game player actions during a turn. Registers: `play-card`, `revoke-card`, `board-attack`, `pass-turn`. Each handler verifies the room exists, the socket is the active turn player, and the player belongs to the room. Delegates round resolution to `gameEngine.resolveRound()`.

**`socket/gameEngine.js`** — All game business logic. Pure/quasi-pure functions, no `socket.on()` registrations. Called by handlers.

Functions: `resolveRound`, `applyPassives`, `resolveAttacks`, `resolveStaged`, `drawCard`, `dealCards`, `checkWinCondition`, `removePlayerFromRoom`, `removePlayerByNickname`, `syncGameState`, `getPublicRooms`.

`syncGameState` emits `sync-game-state` separately to each player with personalized state (full hand for self, count only for opponent).

**`socket/reconnectHandlers.js`** — Handles disconnects and reconnects. Registers: `disconnect`, `check-game-state`. On disconnect, starts a countdown timer; if the player reconnects in time, restores their game state. `check-game-state` is also used on page reload to determine whether to restore a game session, show the waiting room, or redirect to lobby.

**`socket/statsHandlers.js`** — Async functions that record game results to the DB after a game ends. Called from `gameEngine` after `checkWinCondition`. Does not register `socket.on()`.

Functions: `recordResult(winner, loser)`, `recordDraw(p1, p2)`.

---

## Client (`public/`)

The client is a plain HTML/CSS/JS single-page app. No bundler, no ES modules. Script load order in `index.html` is the only dependency mechanism — a file may only use functions defined in scripts loaded before it.

### `index.html`

Shell page. Contains all view `<div>` containers (one per screen), all `<link rel="stylesheet">` tags in the head, and all `<script>` tags at the bottom of `<body>` in the required order:

1. `socket.io/socket.io.js` (external)
2. `js/state.js`
3. `js/api.js`
4. `js/router.js`
5. `js/game/renderer.js`
6. `js/game/animation.js`
7. `js/game/actions.js`
8. `js/game/timer.js`
9. `js/game/socketListeners.js`
10. `js/views/auth.js`
11. `js/views/lobby.js`
12. `js/views/heroes.js`
13. `js/views/profile.js`
14. `js/views/top10.js`
15. `js/views/waiting.js`
16. `js/socket.js`
17. `js/main.js`

---

### CSS

**`css/base.css`** — CSS custom properties (design tokens: colors, fonts, spacing, radii, shadows), box-sizing reset, body defaults, Google Fonts import. Never overridden by other CSS files.

**`css/layout.css`** — Header, nav, view containers, show/hide logic for the SPA views (`.view` / `.view.active`), loading spinner.

**`css/components.css`** — Reusable UI components shared across views: buttons, game card UI, modals, AP bubbles, toast notifications, avatars, hero stat grids, top-10 table.

**`css/game.css`** — Game board layout, player/enemy halves, hand fan layout, hero background overlays, combat and coin-flip overlays, turn banners, reconnect banner, game result overlay, and all `@keyframes` animations.

**`css/auth.css`** — Login/register forms, profile settings form, form error styles.

---

### Core JS modules

**`js/state.js`** — Defines and exports the `AppState` singleton object. Holds all global state: auth (`currentUser`, `token`), room and game status, current game state (HP, AP, hand, board, staged cards for both players), timer, and waiting tips. All other files read and write state exclusively through `AppState.*`. When state changes affect the UI, the relevant render function must be called explicitly.

**`js/api.js`** — Centralized HTTP client. All `fetch` calls to the REST API go through the `Api` object. No view file calls `fetch` directly. Handles auth headers automatically using `AppState.token`.

**`js/router.js`** — `navigate(viewName)` function. Shows the requested view, hides others, updates the header, and calls the appropriate data-loading function for the view (e.g., `loadProfile()` when navigating to `'profile'`). Prevents navigation away from the game when `AppState.inRoom` is true.

**`js/socket.js`** — Initializes the Socket.IO connection with `auth: { token }` and registers all `socket.on()` listeners. Routes each incoming event to the appropriate module function. Does not contain game logic. `AppState.socket.emit(...)` is the only way to send socket events from any file.

**`js/main.js`** — `DOMContentLoaded` entry point. Restores session from `localStorage`, silently refreshes the player profile from the API, initializes the socket, checks `sessionStorage` for an active game session (triggers reconnect flow if found), and calls the initial `navigate()`.

---

### Views

Each view file is responsible for exactly one screen. Views use `Api.*` for HTTP, `AppState.socket.emit(...)` for WebSocket, and `AppState.*` for state. They do not register `socket.on()`.

**`js/views/auth.js`** — `handleLogin`, `handleRegister`, `handleLogout`. Updates `AppState` and `localStorage` on login, clears everything on logout.

**`js/views/lobby.js`** — `handleCreateRoom`, `attemptJoinRoom`, `submitJoinPrivate`, `renderRoomList`. `renderRoomList` is called by `socket.js` on `rooms-update`.

**`js/views/heroes.js`** — `loadCharacterInfo` (fetches heroes + cards, renders character info sections), `selectHero` (updates selected hero via API and `AppState`), `initCardPreview` (hover tooltip for cards).

**`js/views/profile.js`** — `loadProfile` (renders public stats and, if it's the current user, the settings form), `saveProfileSettings` (validates avatar URL client-side before sending), `saveSettingsToDB` (calls `Api.updateSettings`).

**`js/views/top10.js`** — `loadTop10` (fetches and renders the leaderboard table), `viewUserProfile` (stores target nickname in `AppState` and navigates to the profile view).

**`js/views/waiting.js`** — `startWaitingTips` (fetches `tips.json`, rotates tips every 5 seconds with a fade), `handleLeaveWaiting` (emits `leave-room` and returns to lobby), `onWaitingRestore` (called by `socket.js` on `waiting-room-restore`).

---

### Game modules

**`js/game/renderer.js`** — Renders the game board from `AppState.*`. Handles `game-start`: sets `AppState`, applies hero background overlays, calls the initial render. Handles `sync-game-state`: updates `AppState` and re-renders the full board. Contains `renderCard`, `renderBoardCard`, and card image URL resolution. Also triggers the deal animation when new cards appear in hand.

**`js/game/animation.js`** — All animation sequences: deal animation (`animateDrawCards`), single flying card token (`spawnFlyingCard`), coin flip on game start, and the multi-phase async combat animation driven by the `combat-animation` socket event. Also owns the turn overlay animation.

**`js/game/actions.js`** — Player action handlers during a turn: playing a card (AP check → emit `play-card`), revoking a staged card (emit `revoke-card`), board attacks (emit `board-attack`), end-turn confirmation flow (modal or direct pass), resign flow. Also owns game entry/exit lifecycle: `enterGame` (sets `AppState.inRoom`, saves to `sessionStorage`, navigates to game view) and `exitRoom` (clears game state, intervals, hero backgrounds, `sessionStorage`).

**`js/game/timer.js`** — 60-second per-turn countdown timer. Starts on the player's turn, auto-passes when it reaches zero. Updates the timer DOM element each tick, clears the interval on turn end or game over.

**`js/game/socketListeners.js`** — Registers all game-specific `socket.on()` handlers: `game-start`, `coin-flip`, `sync-game-state`, `combat-animation`, `turn-order-change`, `game-over`, `opponent-reconnecting`, `opponent-reconnected`, `room-gone`. Routes each event to the appropriate function in `renderer.js`, `animation.js`, `actions.js`, or `timer.js`. Contains no logic of its own — pure event routing.

---

### `public/assets/images/`

Card artwork — one `.jpg` per card, filename matches the card name in snake_case (e.g. `unibeam.jpg`, `nova_blast.jpg`). Referenced by `renderer.js` to display card images on the board and in hand. Static files, never modified at runtime.

---

### `data/tips.json`

Static JSON file with a list of tip strings displayed in the waiting room while a player waits for an opponent. Fetched client-side by `views/waiting.js`.
