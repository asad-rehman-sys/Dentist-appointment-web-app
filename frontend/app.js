// Brightside Dental — frontend logic (vanilla JS, no build step)

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4000"
  : ""; // in production, point this at your deployed backend URL

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let SERVICES = [];
let CLINIC = {};
let HOURS = {};
let DOCTORS = [];
let selectedTime = null;

const VISIT_GUIDES = {
  checkup: { title: "Checkup & Cleaning", items: ["Brush as usual before you arrive.", "Bring a list of any symptoms or questions.", "Plan for a relaxed 30-minute visit."] },
  whitening: { title: "Teeth Whitening", items: ["Avoid strongly coloured food or drinks for 24 hours after treatment.", "Tell us about any tooth sensitivity.", "Plan for a 60-minute appointment."] },
  filling: { title: "Cavity Filling", items: ["Eat a light meal beforehand unless we advise otherwise.", "Bring details of current medication.", "Numbness can last for a few hours afterwards."] },
  extraction: { title: "Tooth Extraction", items: ["Share your medical history and medication details.", "Arrange a calm journey home if needed.", "We will provide after-care instructions before you leave."] },
  rootcanal: { title: "Root Canal", items: ["Have a light meal before your visit.", "Set aside 90 minutes for treatment.", "Ask us about any concerns before we begin."] },
  consult: { title: "New Patient Consult", items: ["Bring any previous dental records if available.", "Tell us your goals and any discomfort.", "We will discuss suitable next steps together."] },
};

// Common patient-facing symptoms mapped to the service that best fits them
const SYMPTOMS = [
  { icon: "🦷", name: "Toothache", serviceId: "filling", suggests: "Cavity Filling" },
  { icon: "🩸", name: "Bleeding gums", serviceId: "checkup", suggests: "Checkup & Cleaning" },
  { icon: "🧊", name: "Sensitivity to cold", serviceId: "checkup", suggests: "Checkup & Cleaning" },
  { icon: "💥", name: "Chipped or broken tooth", serviceId: "extraction", suggests: "Tooth Extraction" },
  { icon: "😬", name: "Severe, throbbing pain", serviceId: "rootcanal", suggests: "Root Canal" },
  { icon: "✨", name: "Want a brighter smile", serviceId: "whitening", suggests: "Teeth Whitening" },
];

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Load clinic info: services, hours, doctors, contact
// ---------------------------------------------------------------------------
async function loadInfo() {
  const info = await api("/api/info");
  SERVICES = info.services;
  CLINIC = info.clinic;
  HOURS = info.hours;
  DOCTORS = info.doctors;

  document.getElementById("clinicAddress").textContent = info.clinic.address;
  const phoneEl = document.getElementById("clinicPhone");
  phoneEl.textContent = info.clinic.phone;
  phoneEl.href = `tel:${info.clinic.phone.replace(/\s+/g, "")}`;
  const emailEl = document.getElementById("clinicEmail");
  emailEl.textContent = info.clinic.email;
  emailEl.href = `mailto:${info.clinic.email}`;

  // Services grid
  const grid = document.getElementById("serviceGrid");
  grid.innerHTML = info.services
    .map(
      (s) => `
      <div class="service-card">
        <h3>${s.name}</h3>
        <p>${s.description}</p>
        <span class="service-duration">${s.durationMin} min</span>
      </div>`
    )
    .join("");

  // Service select in booking form
  const select = document.getElementById("serviceSelect");
  select.innerHTML = info.services.map((s) => `<option value="${s.id}">${s.name} (${s.durationMin} min)</option>`).join("");

  const doctorSelect = document.getElementById("doctorSelect");
  doctorSelect.insertAdjacentHTML("beforeend", info.doctors.map((d) => `<option value="${d.id}">${d.name} — ${d.role}</option>`).join(""));
  renderVisitGuide(info.services[0].id);
  document.getElementById("guideTabs").innerHTML = info.services.map((s, index) => `<button class="guide-tab${index === 0 ? " active" : ""}" type="button" data-service="${s.id}">${s.name}</button>`).join("");

  // Hours table
  const tbody = document.querySelector("#hoursTable tbody");
  tbody.innerHTML = DAY_NAMES.map((name, idx) => {
    const h = info.hours[idx];
    return `<tr><td>${name}</td><td>${h ? `${fmtTime(h.open)} – ${fmtTime(h.close)}` : "Closed"}</td></tr>`;
  }).join("");

  // Doctors
  const docList = document.getElementById("doctorsList");
  docList.innerHTML = info.doctors
    .map((d) => `<li>${d.name}<span class="doc-role">${d.role}</span></li>`)
    .join("");

  // Set date input min to today
  document.getElementById("dateInput").min = todayStr();
}

function renderVisitGuide(serviceId) {
  const guide = VISIT_GUIDES[serviceId] || VISIT_GUIDES.checkup;
  document.getElementById("guideCard").innerHTML = `<p class="guide-label">Before your appointment</p><h3>${guide.title}</h3><ul>${guide.items.map((item) => `<li>${item}</li>`).join("")}</ul><a class="btn btn-primary btn-small" href="#book">Book this visit</a>`;
}

// ---------------------------------------------------------------------------
// Symptom checker → pre-selects a service and jumps to the booking form
// ---------------------------------------------------------------------------
function renderSymptomChecker() {
  const grid = document.getElementById("symptomGrid");
  grid.innerHTML = SYMPTOMS.map(
    (s, i) => `
    <button type="button" class="symptom-card" data-index="${i}">
      <span class="symptom-icon">${s.icon}</span>
      <span class="symptom-name">${s.name}</span>
      <span class="symptom-suggests">Suggests: ${s.suggests}</span>
    </button>`
  ).join("");

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".symptom-card");
    if (!card) return;
    const symptom = SYMPTOMS[Number(card.dataset.index)];
    const select = document.getElementById("serviceSelect");
    select.value = symptom.serviceId;
    refreshSlots();
    document.getElementById("book").scrollIntoView({ behavior: "smooth" });
  });
}

// ---------------------------------------------------------------------------
// Theme toggle (light/dark), remembered across visits
// ---------------------------------------------------------------------------
function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const saved = localStorage.getItem("brightside-theme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);

  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("brightside-theme", next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
}

// ---------------------------------------------------------------------------
// Hero "next opening" ticket
// ---------------------------------------------------------------------------
async function loadNextOpening() {
  const statusEl = document.getElementById("ticketStatus");
  const dateEl = document.getElementById("ticketDate");
  const timeEl = document.getElementById("ticketTime");

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const result = await api(`/api/availability?date=${dateStr}&serviceId=checkup`);
      if (result.slots && result.slots.length > 0) {
        statusEl.textContent = "open now";
        dateEl.textContent = fmtDate(dateStr);
        timeEl.textContent = fmtTime(result.slots[0]);
        return;
      }
    } catch {
      // ignore and keep scanning
    }
  }
  statusEl.textContent = "fully booked";
  dateEl.textContent = "—";
  timeEl.textContent = "—";
}

// ---------------------------------------------------------------------------
// Booking form
// ---------------------------------------------------------------------------
async function refreshSlots() {
  const serviceId = document.getElementById("serviceSelect").value;
  const date = document.getElementById("dateInput").value;
  const slotGrid = document.getElementById("slotGrid");
  const timeInput = document.getElementById("timeInput");
  selectedTime = null;
  timeInput.value = "";

  if (!serviceId || !date) {
    slotGrid.innerHTML = `<p class="slot-hint">Choose a service and date to see open times.</p>`;
    return;
  }

  slotGrid.innerHTML = `<p class="slot-hint">Loading available times…</p>`;
  try {
    const result = await api(`/api/availability?date=${date}&serviceId=${serviceId}`);
    if (!result.open) {
      slotGrid.innerHTML = `<p class="slot-hint">The clinic is closed on that date. Please choose another day.</p>`;
      return;
    }
    if (result.slots.length === 0) {
      slotGrid.innerHTML = `<p class="slot-hint">No open times left that day — try another date.</p>`;
      return;
    }
    slotGrid.innerHTML = result.slots
      .map((slot) => `<button type="button" class="slot-btn" data-time="${slot}">${fmtTime(slot)}</button>`)
      .join("");
  } catch (err) {
    slotGrid.innerHTML = `<p class="slot-hint">Couldn't load times: ${err.message}</p>`;
  }
}

function handleSlotClick(e) {
  const btn = e.target.closest(".slot-btn");
  if (!btn) return;
  document.querySelectorAll(".slot-btn").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectedTime = btn.dataset.time;
  document.getElementById("timeInput").value = selectedTime;
}

function renderConfirmation(res) {
  document.getElementById("confirmEmpty").hidden = true;
  const ticket = document.getElementById("confirmTicket");
  ticket.hidden = false;
  document.getElementById("confDate").textContent = fmtDate(res.date);
  document.getElementById("confTime").textContent = fmtTime(res.time);
  document.getElementById("confService").textContent = res.service.name;
  const doctorEl = document.getElementById("confDoctor");
  doctorEl.hidden = !res.doctor;
  doctorEl.textContent = res.doctor ? `Preferred dentist: ${res.doctor.name}` : "";
  document.getElementById("confCode").textContent = res.confirmation;
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("formError");
  errorEl.textContent = "";

  const form = e.target;
  const payload = {
    serviceId: form.serviceId.value,
    date: form.date.value,
    time: form.time.value,
    patientName: form.patientName.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    doctorId: form.doctorId.value,
    notes: form.notes.value.trim(),
  };

  if (!payload.time) {
    errorEl.textContent = "Please choose an available time.";
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Booking…";

  try {
    const res = await api("/api/reservations", { method: "POST", body: JSON.stringify(payload) });
    renderConfirmation(res);
    form.reset();
    selectedTime = null;
    document.getElementById("slotGrid").innerHTML = `<p class="slot-hint">Choose a service and date to see open times.</p>`;
    loadNextOpening();
  } catch (err) {
    errorEl.textContent = err.message;
    if (err.message.toLowerCase().includes("no longer available")) refreshSlots();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm reservation";
  }
}

// ---------------------------------------------------------------------------
// Manage / lookup booking
// ---------------------------------------------------------------------------
async function handleLookupSubmit(e) {
  e.preventDefault();
  const code = document.getElementById("lookupCode").value.trim();
  const resultEl = document.getElementById("lookupResult");
  resultEl.innerHTML = `<p class="slot-hint">Looking up…</p>`;

  try {
    const r = await api(`/api/reservations/lookup?confirmation=${encodeURIComponent(code)}`);
    const isCancelled = r.status === "cancelled";
    resultEl.innerHTML = `
      <div class="lookup-card">
        <span class="status-pill ${isCancelled ? "status-cancelled" : "status-confirmed"}">${r.status}</span>
        <h3>${r.service.name}</h3>
        <p>${fmtDate(r.date)} at ${fmtTime(r.time)}</p>
        <p>${r.patient_name} · ${r.phone}</p>
        ${!isCancelled ? `<button class="cancel-btn" id="cancelBtn">Cancel this reservation</button>` : ""}
      </div>`;

    const cancelBtn = document.getElementById("cancelBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        cancelBtn.disabled = true;
        cancelBtn.textContent = "Cancelling…";
        try {
          await api(`/api/reservations/${encodeURIComponent(r.confirmation)}`, { method: "DELETE" });
          handleLookupSubmit(e);
          loadNextOpening();
        } catch (err) {
          resultEl.insertAdjacentHTML("beforeend", `<p class="lookup-error">${err.message}</p>`);
        }
      });
    }
  } catch (err) {
    resultEl.innerHTML = `<p class="lookup-error">${err.message}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Chatbot — lightweight, rule-based, answers from the same data already
// loaded from the API (no external AI service, no extra backend calls)
// ---------------------------------------------------------------------------
function addChatMessage(text, sender = "bot", quickReplies = null) {
  const container = document.getElementById("chatMessages");
  const msg = document.createElement("div");
  msg.className = `chat-msg ${sender}`;
  msg.textContent = text;
  container.appendChild(msg);

  if (quickReplies && quickReplies.length) {
    const row = document.createElement("div");
    row.className = "chat-quick-replies";
    quickReplies.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => handleChatInput(label));
      row.appendChild(btn);
    });
    container.appendChild(row);
  }
  container.scrollTop = container.scrollHeight;
}

function chatAnswer(rawText) {
  const text = rawText.toLowerCase();

  if (/\b(hi|hello|hey)\b/.test(text)) {
    return { reply: `Hi! I'm the Brightside Assistant. Ask me about hours, services, or how to book.`, quick: ["Book a visit", "Hours", "Services"] };
  }

  if (text.includes("hour") || text.includes("open") || text.includes("close")) {
    const day = new Date().getDay();
    const today = HOURS[day];
    const todayStr2 = today ? `${fmtTime(today.open)} – ${fmtTime(today.close)}` : "closed";
    return { reply: `We're ${today ? "open" : "closed"} today (${DAY_NAMES[day]}): ${todayStr2}. We're closed Sundays.` };
  }

  if (text.includes("service") || text.includes("offer") || text.includes("treatment")) {
    const names = SERVICES.map((s) => s.name).join(", ");
    return { reply: `We offer: ${names}. Want me to take you to booking for one of these?`, quick: ["Book a visit"] };
  }

  if (text.includes("cancel") || text.includes("manage") || text.includes("confirmation")) {
    document.getElementById("manage").scrollIntoView({ behavior: "smooth" });
    return { reply: "I've scrolled you to the 'Manage an existing booking' section — enter your confirmation code there." };
  }

  if (text.includes("book") || text.includes("appoint") || text.includes("reserv") || text.includes("schedule")) {
    document.getElementById("book").scrollIntoView({ behavior: "smooth" });
    return { reply: "Scrolled you to the booking form — pick a service and date and I'll show you open times." };
  }

  if (text.includes("address") || text.includes("location") || text.includes("where")) {
    return { reply: `We're at ${CLINIC.address}.` };
  }

  if (text.includes("phone") || text.includes("call") || text.includes("email") || text.includes("contact")) {
    return { reply: `You can reach us at ${CLINIC.phone} or ${CLINIC.email}.` };
  }

  if (text.includes("doctor") || text.includes("dentist")) {
    const names = DOCTORS.map((d) => `${d.name} (${d.role})`).join("; ");
    return { reply: `Our dentists: ${names}.` };
  }

  if (text.includes("pain") || text.includes("hurt") || text.includes("ache") || text.includes("emergency")) {
    return { reply: "Sorry to hear that! For tooth pain, a checkup or filling visit is a good place to start — for anything severe, please call us directly.", quick: ["Book a visit", "Call the clinic"] };
  }

  if (text.includes("call the clinic")) {
    return { reply: `Give us a call: ${CLINIC.phone}` };
  }

  if (text.includes("thank")) {
    return { reply: "You're welcome! Anything else I can help with?" };
  }

  return {
    reply: "I can help with hours, services, booking, or contact info — try one of these:",
    quick: ["Hours", "Services", "Book a visit", "Contact"],
  };
}

function handleChatInput(text) {
  if (!text.trim()) return;
  addChatMessage(text, "user");
  const { reply, quick } = chatAnswer(text);
  setTimeout(() => addChatMessage(reply, "bot", quick), 300);
}

function initChatbot() {
  const toggle = document.getElementById("chatToggle");
  const closeBtn = document.getElementById("chatClose");
  const win = document.getElementById("chatWindow");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  let greeted = false;

  toggle.addEventListener("click", () => {
    win.hidden = !win.hidden;
    if (!win.hidden && !greeted) {
      greeted = true;
      addChatMessage("Hi! I'm the Brightside Assistant. Ask me about hours, services, or how to book.", "bot", ["Book a visit", "Hours", "Services"]);
    }
    if (!win.hidden) input.focus();
  });
  closeBtn.addEventListener("click", () => { win.hidden = true; });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    handleChatInput(text);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.getElementById("year").textContent = new Date().getFullYear();

initTheme();
renderSymptomChecker();
initChatbot();

loadInfo().then(loadNextOpening).catch((err) => {
  console.error(err);
  document.getElementById("ticketStatus").textContent = "unavailable";
});

document.getElementById("serviceSelect").addEventListener("change", refreshSlots);
document.getElementById("dateInput").addEventListener("change", refreshSlots);
document.getElementById("slotGrid").addEventListener("click", handleSlotClick);
document.getElementById("bookingForm").addEventListener("submit", handleBookingSubmit);
document.getElementById("lookupForm").addEventListener("submit", handleLookupSubmit);
document.getElementById("guideTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".guide-tab");
  if (!tab) return;
  document.querySelectorAll(".guide-tab").forEach((item) => item.classList.toggle("active", item === tab));
  renderVisitGuide(tab.dataset.service);
});
