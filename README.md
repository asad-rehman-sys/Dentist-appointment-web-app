# Brightside Dental — reservation web app

A lightweight dental clinic web app: a plain HTML/CSS/JS frontend (no build step or framework) connected to a small Express + SQLite backend.

```
dental-app/
├── backend/          Express API and SQLite storage
│   ├── server.js
│   ├── package.json
│   └── .gitignore
└── frontend/         Static patient and admin pages
    ├── index.html
    ├── admin.html
    ├── style.css
    ├── app.js
    └── admin.js
```

## What it does

- Shows clinic information, services, doctors, weekly hours, and a treatment gallery.
- Lets patients find duration-aware available slots and make a reservation.
- Gives each reservation a confirmation code for lookup or cancellation.
- Lets patients optionally select a preferred dentist and leave notes.
- Provides a protected front-desk page at `admin.html` to view all reservations.

## Running it

### 1. Backend

```bash
cd backend
npm install
npm start
```

The API runs at `http://localhost:4000` and creates `dental.db` automatically.

### 2. Frontend

From a second terminal:

```bash
cd frontend
npx serve .
```

Open the URL printed by the command. The patient site is `index.html` and the front-desk page is `admin.html`.

The frontend expects the backend at `http://localhost:4000`. If they are deployed separately, set `API_BASE` in `frontend/app.js` and `frontend/admin.js` to the deployed backend URL.

## Admin access

Open `admin.html` and enter the configured admin key. The demo default is `admin123`; change it before real use:

```bash
ADMIN_KEY=a-long-secret-value npm start
```

## Configuration

Clinic name, services, doctors, and opening hours are defined near the top of `backend/server.js`. Update them there and restart the backend.

## Notes

- SQLite is file based—no external database server is required.
- `backend/dental.db` and its working files are intentionally ignored by Git so patient data is never committed.
- This project is a lightweight demo. A production clinic deployment needs HTTPS, stronger authentication, secret management, backups, and appropriate privacy controls.
