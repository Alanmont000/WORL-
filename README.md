WORLΔ — Final Prototype (NO PAYMENTS)
====================================

This package contains a functional prototype of WORLΔ without payment endpoints.
It includes:
- Static client in /public (Three.js) with 10 portal scenes, Nexo, HUD and campaign.
- Server (server.js) with REST endpoints for auth, save, and a WebSocket server for realtime players.
- SQLite persistence (data.sqlite3 created at runtime).
- No Stripe or simulated purchase endpoints — shop works with fragments only (earned in-game).

Quick start (local):
1. Ensure Node.js v16+ is installed.
2. Unzip package.
3. Run:
   npm install
   node server.js
4. Open http://localhost:4000 in your browser.

Deploy:
- Deploy to Render, Railway or any Node host.
- Start command: node server.js
- Ensure port 4000 is open.

Notes:
- This prototype is intended for testing and small groups. For production you must add security, rate-limiting,
  authentication hardening (password hashing), HTTPS, and proper scaling.
