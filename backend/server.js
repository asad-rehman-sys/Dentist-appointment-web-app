// Brightside Dental — backend
// Lightweight Express + SQLite (file-based, zero external DB server needed)

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 4000;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin123"; // change in production
const DB_PATH = path.join(__dirname, "dental.db");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmation    TEXT UNIQUE NOT NULL,
    patient_name    TEXT NOT NULL,
    phone           TEXT NOT NULL,
    email           TEXT,
    service_id      TEXT NOT NULL,
    doctor_id       TEXT,
    date            TEXT NOT NULL,   -- YYYY-MM-DD
    time            TEXT NOT NULL,   -- HH:MM (24h)
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// Keep existing demo databases compatible with the doctor-preference feature.
const reservationColumns = db.prepare("PRAGMA table_info(reservations)").all().map((column) => column.name);
if (!reservationColumns.includes("doctor_id")) db.exec("ALTER TABLE reservations ADD COLUMN doctor_id TEXT");

// ---------------------------------------------------------------------------
// Static clinic data — kept in code so there's no admin CMS to stand up.
// Edit this block to re-brand or re-configure the clinic.
// ---------------------------------------------------------------------------
const CLINIC = {
  name: "Brightside Dental",
  tagline: "Straightforward dental care, on your schedule.",
  address: "42 Meridian Ave, Bahawalpur",
  phone: "+92 300 1234567",
  email: "hello@brightsidedental.example",
};

// 0 = Sunday ... 6 = Saturday
const HOURS = {
  0: null, // closed Sunday
  1: { open: "09:00", close: "17:00" },
  2: { open: "09:00", close: "17:00" },
  3: { open: "09:00", close: "17:00" },
  4: { open: "09:00", close: "17:00" },
  5: { open: "09:00", close: "17:00" },
  6: { open: "10:00", close: "14:00" }, // Saturday, shorter day
};

const SLOT_MINUTES = 30; // grid resolution; a service may span multiple slots

const SERVICES = [
  { id: "checkup", name: "Checkup & Cleaning", durationMin: 30, description: "Routine exam, polish, and a cavity check." },
  { id: "whitening", name: "Teeth Whitening", durationMin: 60, description: "In-office whitening for a brighter smile." },
  { id: "filling", name: "Cavity Filling", durationMin: 45, description: "Composite filling for a single tooth." },
  { id: "extraction", name: "Tooth Extraction", durationMin: 45, description: "Simple extraction with local anesthesia." },
  { id: "rootcanal", name: "Root Canal", durationMin: 90, description: "Full root canal treatment, single tooth." },
  { id: "consult", name: "New Patient Consult", durationMin: 30, description: "First visit exam and treatment planning." },
];

const DOCTORS = [
  { id: "dr-amina", name: "Dr. Amina Farooq", role: "General & Cosmetic Dentistry" },
  { id: "dr-hassan", name: "Dr. Hassan Raza", role: "Oral Surgery & Extractions" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function getService(serviceId) {
  return SERVICES.find((s) => s.id === serviceId);
}
function isPastDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + "T00:00:00") < today;
}

function generateDaySlots(dateStr) {
  const day = new Date(dateStr + "T00:00:00").getDay();
  const hours = HOURS[day];
  if (!hours) return [];
  const start = toMinutes(hours.open);
  const end = toMinutes(hours.close);
  const slots = [];
  for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
    slots.push(toHHMM(t));
  }
  return slots;
}

// Returns true if [startMin, startMin+duration) overlaps an existing booking
function hasConflict(dateStr, startMin, durationMin, excludeId = null) {
  const dayEnd = (() => {
    const day = new Date(dateStr + "T00:00:00").getDay();
    return HOURS[day] ? toMinutes(HOURS[day].close) : 0;
  })();
  if (startMin + durationMin > dayEnd) return true; // would run past closing

  const rows = db
    .prepare(
      `SELECT time, service_id, id FROM reservations
       WHERE date = ? AND status = 'confirmed' ${excludeId ? "AND id != ?" : ""}`
    )
    .all(...(excludeId ? [dateStr, excludeId] : [dateStr]));

  return rows.some((r) => {
    const existingStart = toMinutes(r.time);
    const existingDuration = getService(r.service_id)?.durationMin || SLOT_MINUTES;
    const existingEnd = existingStart + existingDuration;
    const newEnd = startMin + durationMin;
    return startMin < existingEnd && newEnd > existingStart;
  });
}

function requireAdmin(req, res, next) {
  if (req.header("x-admin-key") !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Clinic info, services, doctors, hours — everything the info pages need in one call
app.get("/api/info", (req, res) => {
  res.json({ clinic: CLINIC, services: SERVICES, doctors: DOCTORS, hours: HOURS, slotMinutes: SLOT_MINUTES });
});

app.get("/api/services", (req, res) => {
  res.json(SERVICES);
});

// Available slots for a given date + service (duration-aware)
app.get("/api/availability", (req, res) => {
  const { date, serviceId } = req.query;
  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const service = serviceId ? getService(serviceId) : null;
  if (serviceId && !service) return res.status(400).json({ error: "Unknown serviceId" });

  const duration = service?.durationMin || SLOT_MINUTES;
  const allSlots = generateDaySlots(date);

  if (isPastDate(date)) {
    return res.json({ date, open: allSlots.length > 0, slots: [] });
  }

  const available = allSlots.filter((slot) => !hasConflict(date, toMinutes(slot), duration));
  res.json({ date, open: allSlots.length > 0, slots: available });
});

// Create a reservation
app.post("/api/reservations", (req, res) => {
  const { patientName, phone, email, serviceId, doctorId, date, time, notes } = req.body || {};

  if (!patientName || !phone || !serviceId || !date || !time) {
    return res.status(400).json({ error: "patientName, phone, serviceId, date, and time are required" });
  }
  const service = getService(serviceId);
  if (!service) return res.status(400).json({ error: "Unknown serviceId" });
  const doctor = doctorId ? DOCTORS.find((d) => d.id === doctorId) : null;
  if (doctorId && !doctor) return res.status(400).json({ error: "Unknown doctorId" });
  if (isPastDate(date)) return res.status(400).json({ error: "Cannot book a date in the past" });

  const daySlots = generateDaySlots(date);
  if (daySlots.length === 0) return res.status(400).json({ error: "Clinic is closed on that date" });

  const startMin = toMinutes(time);
  if (hasConflict(date, startMin, service.durationMin)) {
    return res.status(409).json({ error: "That time is no longer available. Please pick another slot." });
  }

  const confirmation = crypto.randomBytes(4).toString("hex").toUpperCase();

  const stmt = db.prepare(`
    INSERT INTO reservations (confirmation, patient_name, phone, email, service_id, doctor_id, date, time, notes)
    VALUES (@confirmation, @patientName, @phone, @email, @serviceId, @doctorId, @date, @time, @notes)
  `);
  const info = stmt.run({
    confirmation,
    patientName,
    phone,
    email: email || null,
    serviceId,
    doctorId: doctorId || null,
    date,
    time,
    notes: notes || null,
  });

  res.status(201).json({
    id: info.lastInsertRowid,
    confirmation,
    patientName,
    service,
    doctor,
    date,
    time,
    status: "confirmed",
  });
});

// Look up reservations by confirmation code (for a patient checking their own booking)
app.get("/api/reservations/lookup", (req, res) => {
  const { confirmation } = req.query;
  if (!confirmation) return res.status(400).json({ error: "confirmation is required" });

  const row = db.prepare(`SELECT * FROM reservations WHERE confirmation = ?`).get(confirmation.toUpperCase());
  if (!row) return res.status(404).json({ error: "No reservation found for that confirmation code" });

  res.json({ ...row, service: getService(row.service_id), doctor: DOCTORS.find((d) => d.id === row.doctor_id) || null });
});

// Cancel a reservation by confirmation code
app.delete("/api/reservations/:confirmation", (req, res) => {
  const confirmation = req.params.confirmation.toUpperCase();
  const row = db.prepare(`SELECT * FROM reservations WHERE confirmation = ?`).get(confirmation);
  if (!row) return res.status(404).json({ error: "No reservation found for that confirmation code" });
  if (row.status === "cancelled") return res.json({ ok: true, alreadyCancelled: true });

  db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE confirmation = ?`).run(confirmation);
  res.json({ ok: true });
});

// Simple admin listing (protected by a static key header) — for the clinic's front desk
app.get("/api/admin/reservations", requireAdmin, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM reservations ORDER BY date, time`)
    .all()
    .map((r) => ({ ...r, service: getService(r.service_id), doctor: DOCTORS.find((d) => d.id === r.doctor_id) || null }));
  res.json(rows);
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Brightside Dental backend running on http://localhost:${PORT}`);
});
