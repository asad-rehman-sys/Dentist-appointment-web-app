const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4000"
  : "";

let adminKey = "";

function formatDateTime(date, time) {
  const formatted = new Date(`${date}T${time}:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${formatted}, ${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value || "—";
  return td;
}

function renderReservations(reservations) {
  const body = document.getElementById("reservationsBody");
  body.replaceChildren();
  const confirmed = reservations.filter((item) => item.status === "confirmed").length;
  document.getElementById("reservationCount").textContent = `${confirmed} active · ${reservations.length} total`;

  if (!reservations.length) {
    const row = document.createElement("tr");
    const empty = cell("No reservations yet.");
    empty.colSpan = 7;
    empty.className = "admin-empty";
    row.appendChild(empty);
    body.appendChild(row);
    return;
  }

  reservations.forEach((reservation) => {
    const row = document.createElement("tr");
    row.append(cell(formatDateTime(reservation.date, reservation.time)));
    row.append(cell(reservation.patient_name));
    row.append(cell([reservation.phone, reservation.email].filter(Boolean).join(" · ")));
    row.append(cell(reservation.service?.name));
    row.append(cell(reservation.doctor?.name));
    row.append(cell(reservation.notes));
    const status = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `status-pill status-${reservation.status}`;
    pill.textContent = reservation.status;
    status.appendChild(pill);
    row.appendChild(status);
    body.appendChild(row);
  });
}

async function loadReservations() {
  const error = document.getElementById("adminError");
  const refresh = document.getElementById("refreshBtn");
  error.textContent = "";
  refresh.disabled = true;
  refresh.textContent = "Refreshing…";
  try {
    const response = await fetch(`${API_BASE}/api/admin/reservations`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? "That admin key is not correct." : "Could not load reservations.");
    }
    renderReservations(await response.json());
    document.getElementById("reservationsPanel").hidden = false;
  } catch (err) {
    document.getElementById("reservationsPanel").hidden = true;
    error.textContent = err.message;
  } finally {
    refresh.disabled = false;
    refresh.textContent = "Refresh";
  }
}

document.getElementById("adminLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  adminKey = document.getElementById("adminKey").value;
  loadReservations();
});
document.getElementById("refreshBtn").addEventListener("click", loadReservations);
