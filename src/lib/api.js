export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body !== "string") {
    headers["content-type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const res = await fetch(`/api${path}`, { ...options, headers });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("API is not connected yet. Redeploy from the fam-app folder so /functions is included.");
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function todayISO() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  const z = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function startOfWeek(iso) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const z = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      const z = (x) => String(x).padStart(2, "0");
      days.push({
        date: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`,
        inMonth: d.getMonth() === month,
        day: d.getDate(),
      });
    }
    weeks.push(days);
  }
  return weeks;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function lastDateOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function occurrenceDates(ev, rangeFrom, rangeTo) {
  const rule = ev.repeat || ev.repeat_rule || "none";
  const until = ev.repeat_until || "2099-12-31";
  const start = ev.start_date;
  if (!rule || rule === "none") {
    const dates = [];
    let d = ev.start_date;
    const end = ev.end_date || ev.start_date;
    while (d <= end) {
      if (d >= rangeFrom && d <= rangeTo) dates.push(d);
      d = addDays(d, 1);
      if (dates.length > 60) break;
    }
    return dates.length ? dates : [start];
  }
  const out = [];
  if (rule === "weekly" || rule === "biweekly") {
    const step = rule === "weekly" ? 7 : 14;
    let d = start;
    while (d <= rangeTo && d <= until) {
      if (d >= rangeFrom) out.push(d);
      d = addDays(d, step);
      if (out.length > 80) break;
    }
    return out;
  }
  if (rule === "monthly") {
    const day = Number(start.slice(8, 10));
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    for (let i = 0; i < 48; i++) {
      const dim = lastDateOfMonth(y, m);
      const d = `${y}-${pad2(m)}-${pad2(Math.min(day, dim))}`;
      if (d > until || d > rangeTo) break;
      if (d >= rangeFrom && d >= start) out.push(d);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }
  if (rule === "semimonthly") {
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    for (let i = 0; i < 48; i++) {
      const last = lastDateOfMonth(y, m);
      for (const day of [15, last]) {
        const d = `${y}-${pad2(m)}-${pad2(day)}`;
        if (d >= start && d <= until && d >= rangeFrom && d <= rangeTo) out.push(d);
      }
      const monthStart = `${y}-${pad2(m)}-01`;
      if (monthStart > rangeTo && monthStart > until) break;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }
  return [start];
}

export function formatNice(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
