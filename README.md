# Brightside Dental — reservation web app

A lightweight dental clinic web app: a plain HTML/CSS/JS frontend (no build step,
no framework) talking to a small Express + SQLite backend (no external database
server to install — SQLite is just a file). Everything here runs for free, locally,
with no paid services required.

```
dental-app/
├── backend/
│   ├── server.js       Express API + SQLite storage
│   ├── mailer.js        Email helper (console-log by default, real SMTP optional)
│   ├── package.json
│   └── .gitignore
└── frontend/
    ├── index.html        Patient-facing site
    ├── admin.html         Admin dashboard
    ├── style.css
    ├── app.js
    └── admin.js
```

## What it does

- **Clinic info**: services (with durations), doctor bios, weekly hours, address/contact.
- **Reservations**: pick a service and date, see real open time slots (duration-aware),
  fill in contact details, confirm. Each booking gets a short confirmation code.
- **Manage a booking**: look up, **reschedule**, or cancel a reservation using the
  confirmation code — no accounts or passwords needed.
- **Email confirmations**: booking confirmed / rescheduled / cancelled emails. By default
  these just print to the server console (free, no setup). Point it at a real SMTP
  server (see below) to actually send them.
- **Waitlist**: if a day is fully booked, patients can join a waitlist. When that slot
  cancels or moves, the next waitlisted patient is emailed automatically.
- **Reviews**: patients can leave a star rating + comment; the site shows the average
  rating and recent reviews.
- **Admin dashboard**: a real page at `/admin` (not just raw JSON) showing all
  reservations, the waitlist, and reviews, with a one-click cancel button. Protected
  by the `x-admin-key` header (default `admin123`, change via `ADMIN_KEY` env var).
  The raw API (`GET /api/admin/reservations`, `GET /api/admin/waitlist`) still works too.

## Running it

### 1. Backend

```bash
cd backend
npm install
npm start
```

This starts the API **and serves the frontend** on `http://localhost:4000` — open that
URL directly, you don't need a separate static server. It creates `dental.db` (a single
SQLite file) automatically on first run.

Admin dashboard: `http://localhost:4000/admin` (key: `admin123` unless you changed it).

Optional environment variables:
- `PORT` — API port (default `4000`)
- `ADMIN_KEY` — key required for admin endpoints (default `admin123`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — set all of these to
  send real emails (any free SMTP works, e.g. a Gmail account with an
  ["app password"](https://myaccount.google.com/apppasswords), or a free test inbox at
  [ethereal.email](https://ethereal.email)). Leave unset and emails just print to the
  console — nothing to sign up for.

Example with real email:
```bash
SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@gmail.com SMTP_PASS=xxxxxxxxxxxxxxxx npm start
```

### 2. Frontend (only if you want it served separately)

The frontend is static. The backend already serves it for you at `http://localhost:4000`,
but if you deploy backend and frontend separately (e.g. backend on Render/Fly free tier,
frontend on Netlify/Vercel/GitHub Pages free tier), serve `frontend/` with any static
host and update `API_BASE` at the top of `app.js` and `admin.js` to point at your
deployed backend URL.

## Customizing the clinic

Everything about the clinic — name, services, prices/durations, doctors, and weekly
hours — lives in one place: the `CLINIC`, `SERVICES`, `DOCTORS`, and `HOURS` objects near
the top of `backend/server.js`. Edit those and restart the server; the frontend pulls
everything from the API so no frontend changes are needed for a re-brand.

## Notes on the "lightweight" / zero-cost design

- No React/build tooling on the frontend — just HTML/CSS/vanilla JS.
- No Postgres/MySQL — SQLite is a single file (`dental.db`), zero setup.
- No auth system for patients — a random confirmation code is enough for a small
  clinic's self-service lookup/reschedule/cancel flow. The admin dashboard uses a
  single shared key rather than a full user/role system.
- Email defaults to console logging, so there is nothing to pay for or sign up for
  to try the whole app end-to-end. Real SMTP is opt-in via env vars.
- Everything can run entirely on your own machine — no cloud account, credit card,
  or free-tier limits to worry about unless you choose to deploy it somewhere.
