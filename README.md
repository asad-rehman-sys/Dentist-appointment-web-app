# Brightside Dental — reservation web app

A lightweight dental clinic web app: a plain HTML/CSS/JS frontend (no build step,
no framework) talking to a small Express + SQLite backend (no external database
server to install — SQLite is just a file).

```
dental-app/
├── backend/          Express API + SQLite storage
│   ├── server.js
│   ├── package.json
│   └── .gitignore
└── frontend/         Static site (open directly or serve with any static server)
    ├── index.html
    ├── style.css
    └── app.js
```

## What it does

- **Clinic info**: services (with durations), doctor bios, weekly hours, address/contact —
  all served from one `/api/info` endpoint and rendered on the page.
- **Reservations**: pick a service and date, see real open time slots (computed from clinic
  hours minus existing bookings, duration-aware so a 90-minute root canal blocks the right
  amount of time), fill in contact details, and confirm. Each booking gets a short
  confirmation code.
- **Manage a booking**: look up or cancel a reservation using the confirmation code —
  no accounts or passwords needed.
- **Admin listing**: `GET /api/admin/reservations` with header `x-admin-key: admin123`
  (change the key via the `ADMIN_KEY` env var) returns every booking, for the front desk.
- **Preferred dentist**: patients can optionally select a dentist while booking; the
  preference is saved with the reservation and returned by booking lookup/admin APIs.
- **Visit guide & treatment gallery**: the frontend includes service-specific preparation
  guidance, patient stories, and treatment imagery loaded from Unsplash.

## Running it

### 1. Backend

```bash
cd backend
npm install
npm start
```

This starts the API on `http://localhost:4000` and creates `dental.db` (a single
SQLite file) automatically on first run — nothing else to configure.

Optional environment variables:
- `PORT` — API port (default `4000`)
- `ADMIN_KEY` — key required for the admin listing endpoint (default `admin123`)

### 2. Frontend

The frontend is static, so any static file server works. From the `frontend/` folder:

```bash
npx serve .
# or: python3 -m http.server 5500
```

Then open the printed URL (e.g. `http://localhost:5500`). The frontend expects the
backend to be running at `http://localhost:4000` — see the `API_BASE` constant at the
top of `app.js` if you deploy them separately (e.g. backend on Render/Fly, frontend on
Netlify/Vercel/GitHub Pages) and need to point it at a different URL.

## Customizing the clinic

Everything about the clinic — name, services, prices/durations, doctors, and weekly
hours — lives in one place: the `CLINIC`, `SERVICES`, `DOCTORS`, and `HOURS` objects near
the top of `backend/server.js`. Edit those and restart the server; the frontend pulls
everything from the API so no frontend changes are needed for a re-brand.

## Notes on the "lightweight" design

- No React/build tooling on the frontend — just HTML/CSS/vanilla JS.
- No Postgres/MySQL — SQLite is a single file (`dental.db`), zero setup.
- No auth system for patients — a random confirmation code is enough for a small
  clinic's self-service cancel/lookup flow. The admin endpoint uses a single shared
  key rather than a full user/role system.
