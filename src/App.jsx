import { useEffect, useMemo, useState } from "react";
import { addDays, api, formatNice, monthMatrix, occurrenceDates, startOfWeek, todayISO } from "./lib/api.js";

const TABS = [
  { id: "calendar", label: "Calendar", ico: "📅" },
  { id: "menu", label: "Menu", ico: "🍽️" },
  { id: "recipes", label: "Recipes", ico: "📖" },
  { id: "groceries", label: "Groceries", ico: "🛒" },
  { id: "lists", label: "Lists", ico: "✓" },
];

const PERSON_COLORS = {
  Jason: "#dc143c",
  Melanie: "#ec4899",
  Stacie: "#7c3aed",
  Seth: "#16a34a",
  Peyton: "#2563eb",
};

function personColor(p) {
  if (!p) return "#64748b";
  return p.color || PERSON_COLORS[p.display_name] || PERSON_COLORS[p.short_name] || "#64748b";
}

const ALL_COLOR = "#eab308";

function isAssignedToAll(ev, peopleList) {
  const assigned = ev?.people || [];
  const all = peopleList || [];
  if (!all.length || assigned.length !== all.length) return false;
  const ids = new Set(assigned.map((p) => p.id));
  return all.every((p) => ids.has(p.id));
}

function eventColor(ev, peopleList) {
  if (isAssignedToAll(ev, peopleList)) return ALL_COLOR;
  return personColor(ev?.people?.[0]);
}

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

function FamilyMark({ className }) {
  return (
    <img
      className={className}
      src="/brand/family-mark.svg"
      alt="Martin family home — five of us under one roof"
    />
  );
}

function LoginPage({ message }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <FamilyMark className="login-mark" />
        <p className="login-tag">Calendar · Menu · Recipes · Groceries · Lists</p>
        <p className="login-copy">
          {message || "Sign in with your family Google account to open the hub."}
        </p>
        <a className="btn login-btn" href="/cdn-cgi/access/login">
          Continue with Google
        </a>
        <p className="login-fine">fam.jascmartin.com · Martin family only</p>
      </div>
    </div>
  );
}

function SearchResults({ q, hits, searching, onClose, onOpen }) {
  if (hits?.error) {
    return (
      <div className="search-panel">
        <div className="row space"><strong>Search</strong><button className="ghost small" onClick={onClose}>Close</button></div>
        <p className="muted">{hits.error}</p>
      </div>
    );
  }
  const sections = [
    { key: "events", tab: "calendar", label: "Calendar" },
    { key: "meals", tab: "menu", label: "Menu" },
    { key: "recipes", tab: "recipes", label: "Recipes" },
    { key: "groceries", tab: "groceries", label: "Groceries" },
    { key: "lists", tab: "lists", label: "Lists" },
  ];
  const total = sections.reduce((n, s) => n + (hits[s.key] || []).length, 0);
  return (
    <div className="search-panel">
      <div className="row space">
        <strong>{searching ? "Searching…" : `${total} result${total === 1 ? "" : "s"} for “${q}”`}</strong>
        <button className="ghost small" onClick={onClose}>Close</button>
      </div>
      {sections.map((s) => {
        const items = hits[s.key] || [];
        if (!items.length) return null;
        return (
          <div key={s.key} style={{ marginTop: 12 }}>
            <div className="muted">{s.label}</div>
            {items.map((it, i) => (
              <button key={i} className="ghost" style={{ width: "100%", textAlign: "left", marginTop: 6 }} onClick={() => onOpen(s.tab)}>
                {it.title || it.name || it.text}
                {it.start_date ? ` · ${it.start_date}` : ""}
                {it.meal_date ? ` · ${it.meal_date}` : ""}
                {it.list_name ? ` · ${it.list_name}` : ""}
              </button>
            ))}
          </div>
        );
      })}
      {!total && !searching ? <p className="muted">Nothing matched.</p> : null}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [q, setQ] = useState("");
  const [searchHits, setSearchHits] = useState(null);
  const [searching, setSearching] = useState(false);
  const [me, setMe] = useState(null);
  const [people, setPeople] = useState([]);
  const [types, setTypes] = useState([]);
  const [err, setErr] = useState("");
  const [booting, setBooting] = useState(true);

  async function boot() {
    try {
      const [m, p, t] = await Promise.all([api("/me"), api("/people"), api("/event-types")]);
      if (!Array.isArray(p) || !Array.isArray(t)) {
        throw new Error("API is not connected yet. Redeploy from the fam-app folder so /functions is included.");
      }
      setMe(m);
      setPeople(p);
      setTypes(t);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    boot();
  }, []);

  if (booting) {
    return (
      <div className="login-page">
        <FamilyMark className="login-mark pulse" />
      </div>
    );
  }

  if (err) {
    const msg =
      err === "unauthorized"
        ? "Only the Martin family Google accounts can come in."
        : err;
    return <LoginPage message={msg} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-lockup">
          <img className="topbar-mark" src="/brand/family-mark-square.png" alt="" />
          <div>
            <h1>Martin Family</h1>
            <div className="who">{me?.person?.display_name || me?.email || "fam.jascmartin.com"}</div>
          </div>
        </div>
        <form
          className="search-box"
          onSubmit={async (e) => {
            e.preventDefault();
            const query = q.trim();
            if (!query) {
              setSearchHits(null);
              return;
            }
            setSearching(true);
            try {
              setSearchHits(await api(`/search?q=${encodeURIComponent(query)}`));
            } catch (err) {
              setSearchHits({ error: err.message });
            } finally {
              setSearching(false);
            }
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything…" />
        </form>
      </header>
      {searchHits && (
        <SearchResults
          q={q}
          hits={searchHits}
          searching={searching}
          onClose={() => { setSearchHits(null); setQ(""); }}
          onOpen={(next) => { setSearchHits(null); setTab(next); }}
        />
      )}
      {tab === "calendar" && <CalendarPage people={people} types={types} onTypes={setTypes} />}
      {!err && tab === "menu" && <MenuPage />}
      {!err && tab === "recipes" && <RecipesPage />}
      {!err && tab === "groceries" && <GroceryPage />}
      {!err && tab === "lists" && <ListsPage people={people} />}
      <nav className="nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function CalendarPage({ people, types, onTypes }) {
  const [anchor, setAnchor] = useState(todayISO());
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.innerWidth < 720 ? "week" : "month"));
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);
  const [addingType, setAddingType] = useState(false);
  const [filterWho, setFilterWho] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1;
  const weekStart = startOfWeek(anchor);
  const from = view === "day" ? anchor : view === "week" ? weekStart : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = view === "day" ? anchor : view === "week" ? addDays(weekStart, 6) : addDays(`${year}-${String(month + 1).padStart(2, "0")}-28`, 10);

  async function load() {
    setEvents(await api(`/events?from=${addDays(from, -7)}&to=${addDays(to, 7)}`));
  }
  useEffect(() => {
    load();
  }, [from, to]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterWho !== "all") {
        if (filterWho === "none" && ev.people?.length) return false;
        if (filterWho !== "none" && !(ev.people || []).some((p) => String(p.id) === String(filterWho))) return false;
      }
      if (filterType !== "all" && String(ev.type_id || ev.type?.id) !== String(filterType)) return false;
      return true;
    });
  }, [events, filterWho, filterType]);

  const byDate = useMemo(() => {
    const map = {};
    const rangeFrom = addDays(from, -7);
    const rangeTo = addDays(to, 7);
    for (const ev of filteredEvents) {
      const dates = occurrenceDates(ev, rangeFrom, rangeTo);
      for (const d of dates) (map[d] ||= []).push({ ...ev, occurrence_date: d });
    }
    return map;
  }, [filteredEvents, from, to]);

  const weeks = monthMatrix(year, month);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const label =
    view === "day"
      ? formatNice(anchor)
      : view === "week"
        ? `${formatNice(weekStart)} – ${formatNice(addDays(weekStart, 6))}`
        : new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shift(n) {
    if (view === "day") setAnchor(addDays(anchor, n));
    else if (view === "week") setAnchor(addDays(anchor, n * 7));
    else {
      const d = new Date(year, month + n, 1);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  function EventCards({ date }) {
    const items = byDate[date] || [];
    if (!items.length) return <p className="muted">Nothing planned</p>;
    return items.map((ev) => (
      <button
        key={`${ev.id}-${ev.occurrence_date || ev.start_date}`}
        className="agenda-item"
        onClick={() => setOpen(ev)}
      >
        <span className="dot" style={{ background: eventColor(ev, people) }} />
        <span>
          <strong>{ev.title}</strong>
          <span className="muted">
            {ev.all_day === 0 && ev.start_time ? ` ${ev.start_time.slice(0, 5)}` : " All day"}
            {ev.people?.length ? ` · ${ev.people.map((p) => p.short_name).join(", ")}` : ""}
            {ev.type?.name ? ` · ${ev.type.name}` : ""}
            {ev.repeat && ev.repeat !== "none" ? ` · ${ev.repeat}` : ""}
          </span>
        </span>
      </button>
    ));
  }

  return (
    <div className="page">
      <div className="view-toggle" role="tablist">
        {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([id, label]) => (
          <button key={id} type="button" className={view === id ? "on" : ""} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      <div className="row space" style={{ marginBottom: 10 }}>
        <button className="ghost small" onClick={() => shift(-1)}>‹</button>
        <h2 className="h2" style={{ margin: 0, textAlign: "center", flex: 1 }}>{label}</h2>
        <button className="ghost small" onClick={() => shift(1)}>›</button>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="ghost small" onClick={() => setAnchor(todayISO())}>Today</button>
      </div>

      {view === "day" && (
        <div className="card">
          <EventCards date={anchor} />
        </div>
      )}

      {view === "week" && (
        <div className="agenda">
          {weekDays.map((d) => (
            <div className={`card ${d === todayISO() ? "today-card" : ""}`} key={d}>
              <button className="ghost" style={{ padding: 0, fontWeight: 700 }} onClick={() => { setAnchor(d); setView("day"); }}>
                {formatNice(d)}
              </button>
              <EventCards date={d} />
            </div>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="month-grid">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div className="dow" key={i}>{d}</div>
          ))}
          {weeks.flat().map((day) => (
            <button
              key={day.date}
              className={`day ${day.inMonth ? "" : "off"} ${day.date === todayISO() ? "today" : ""}`}
              onClick={() => { setAnchor(day.date); setView("day"); }}
            >
              <div className="n">{day.day}</div>
              {(byDate[day.date] || []).slice(0, 2).map((ev) => (
                <span key={`${ev.id}-${ev.occurrence_date || ev.start_date}`} className="pill" style={{ background: eventColor(ev, people) }}>
                  {ev.title}
                </span>
              ))}
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setOpen({ date: view === "day" ? anchor : todayISO() })}>Add event</button>
        <button className="ghost" onClick={() => setAddingType(true)}>New type</button>
      </div>
      <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className={"chip " + (filterWho === "all" ? "on" : "")} onClick={() => setFilterWho("all")}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: ALL_COLOR, display: "inline-block" }} />
          Everyone
        </button>
        {people.map((p) => (
          <button key={p.id} type="button" className={"chip " + (String(filterWho) === String(p.id) ? "on" : "")} onClick={() => setFilterWho(p.id)}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: personColor(p), display: "inline-block" }} />
            {p.short_name}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className={"chip " + (filterType === "all" ? "on" : "")} onClick={() => setFilterType("all")}>All types</button>
        {types.map((t) => (
          <button key={t.id} type="button" className={"chip " + (String(filterType) === String(t.id) ? "on" : "")} onClick={() => setFilterType(t.id)}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: t.color, display: "inline-block" }} />
            {t.name}
          </button>
        ))}
      </div>
      {open && (
        <EventModal
          initial={typeof open === "object" && open.id ? open : { start_date: open.date, all_day: true }}
          events={(byDate[open.date] || []).concat(open.id ? [] : [])}
          date={open.date || open.start_date}
          people={people}
          types={types}
          onClose={() => setOpen(null)}
          onPick={(ev) => setOpen(ev)}
          onSaved={() => {
            setOpen(null);
            load();
          }}
        />
      )}
      {addingType && <TypeModal onClose={() => setAddingType(false)} onSaved={(t) => { onTypes([...types, t]); setAddingType(false); }} />}
    </div>
  );
}
function EventModal({ initial, events, date, people, types, onClose, onPick, onSaved }) {
  const editing = Boolean(initial.id);
  const [title, setTitle] = useState(initial.title || "");
  const [details, setDetails] = useState(initial.details || "");
  const [start, setStart] = useState(initial.start_date || date);
  const [end, setEnd] = useState(initial.end_date || initial.start_date || date);
  const [allDay, setAllDay] = useState(initial.all_day !== 0);
  const [startTime, setStartTime] = useState(initial.start_time || "");
  const [endTime, setEndTime] = useState(initial.end_time || "");
  const [typeId, setTypeId] = useState(initial.type_id || types[0]?.id);
  const [personIds, setPersonIds] = useState((initial.people || []).map((p) => p.id));
  const [repeat, setRepeat] = useState(initial.repeat || "none");
  const [repeatUntil, setRepeatUntil] = useState(initial.repeat_until || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial.id) {
      setTitle(initial.title || "");
      setDetails(initial.details || "");
      setStart(initial.start_date);
      setEnd(initial.end_date || initial.start_date);
      setAllDay(initial.all_day !== 0);
      setStartTime(initial.start_time || "");
      setEndTime(initial.end_time || "");
      setTypeId(initial.type_id);
      setPersonIds((initial.people || []).map((p) => p.id));
      setRepeat(initial.repeat || "none");
      setRepeatUntil(initial.repeat_until || "");
    }
  }, [initial.id]);

  function togglePerson(id) {
    setPersonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setBusy(true);
    const payload = {
      title,
      details,
      start_date: start,
      end_date: end,
      all_day: allDay,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      type_id: Number(typeId),
      person_ids: personIds,
      repeat,
      repeat_until: repeat === "none" ? null : repeatUntil || null,
    };
    if (editing) await api(`/events/${initial.id}`, { method: "PUT", body: payload });
    else await api("/events", { method: "POST", body: payload });
    onSaved();
  }

  async function remove() {
    if (!confirm("Delete this event?")) return;
    await api(`/events/${initial.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row space">
          <h2 className="h2">{editing ? "Edit event" : `Events · ${formatNice(date)}`}</h2>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>
        {!editing && events?.length > 0 && (
          <div className="card">
            {events.map((ev) => (
              <button
                key={ev.id}
                className="ghost"
                style={{ width: "100%", marginBottom: 6, textAlign: "left", borderRadius: 12 }}
                onClick={() => onPick(ev)}
              >
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: eventColor(ev, people), marginRight: 8 }} />
                {ev.title}
                {ev.people?.length ? ` · ${ev.people.map((p) => p.short_name).join(", ")}` : ""}
              </button>
            ))}
          </div>
        )}
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Soccer practice" />
        <label>Details</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What, where, notes…" />
        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Start</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label>End</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <label>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ width: 18, height: 18, marginRight: 8 }} />
          All day
        </label>
        {!allDay && (
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>From</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>To</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        )}
        <label>Type</label>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <label>Repeats</label>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
          <option value="none">Does not repeat</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="semimonthly">Semi-monthly (15th and last day)</option>
          <option value="monthly">Monthly</option>
        </select>
        {repeat !== "none" && (
          <>
            <label>Repeat until (optional)</label>
            <input type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
          </>
        )}
        <label>Associated to</label>
        <div className="row">
          <button
            type="button"
            className={`chip ${people.length && people.every((p) => personIds.includes(p.id)) ? "on" : ""}`}
            onClick={() => {
              const allOn = people.length && people.every((p) => personIds.includes(p.id));
              setPersonIds(allOn ? [] : people.map((p) => p.id));
            }}
          >
            All
          </button>
          {people.map((p) => (
            <button key={p.id} type="button" className={`chip ${personIds.includes(p.id) ? "on" : ""}`} onClick={() => togglePerson(p.id)}>
              {p.short_name}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button disabled={busy || !title} onClick={save}>{editing ? "Save" : "Add event"}</button>
          {editing && <button className="danger" onClick={remove}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

function TypeModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7c3aed");
  async function save() {
    const r = await api("/event-types", { method: "POST", body: { name, color } });
    onSaved({ id: r.id, name, color });
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="h2">New event type</h2>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="School" />
        <label>Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ height: 44, padding: 4 }} />
        <div className="row" style={{ marginTop: 12 }}>
          <button disabled={!name} onClick={save}>Add type</button>
          <button className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function MenuPage() {
  const [anchor, setAnchor] = useState(startOfWeek(todayISO()));
  const [meals, setMeals] = useState([]);
  const [form, setForm] = useState({ meal_date: todayISO(), slot: "dinner", title: "", notes: "" });

  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));

  async function load() {
    setMeals(await api(`/meals?from=${days[0]}&to=${days[6]}`));
  }
  useEffect(() => {
    load();
  }, [anchor]);

  async function add(e) {
    e.preventDefault();
    await api("/meals", { method: "POST", body: form });
    setForm({ ...form, title: "", notes: "" });
    load();
  }

  return (
    <div className="page">
      <div className="row space">
        <h2 className="h2">This week’s menu</h2>
        <div className="row">
          <button className="ghost small" onClick={() => window.print()}>Print week</button>
          <button className="ghost small" onClick={() => setAnchor(addDays(anchor, -7))}>‹</button>
          <button className="ghost small" onClick={() => setAnchor(addDays(anchor, 7))}>›</button>
        </div>
      </div>
      <div className="week-strip">
        {days.map((d) => (
          <button key={d} className={`week-day ${form.meal_date === d ? "on" : ""}`} onClick={() => setForm({ ...form, meal_date: d })}>
            <div style={{ fontSize: ".7rem" }}>{formatNice(d).split(" ")[0]}</div>
            <strong>{d.slice(8)}</strong>
          </button>
        ))}
      </div>
      {days.map((d) => {
        const items = meals.filter((m) => m.meal_date === d);
        return (
          <div className="card" key={d}>
            <strong>{formatNice(d)}</strong>
            {items.length === 0 && <div className="muted">Nothing planned</div>}
            {items.map((m) => (
              <div key={m.id} className="row space" style={{ marginTop: 8 }}>
                <div>
                  <div className="muted" style={{ textTransform: "capitalize" }}>{m.slot}</div>
                  {m.title}
                  {m.notes ? <div className="muted">{m.notes}</div> : null}
                </div>
                <button className="ghost small" onClick={async () => { await api(`/meals/${m.id}`, { method: "DELETE" }); load(); }}>✕</button>
              </div>
            ))}
          </div>
        );
      })}
      <form className="card" onSubmit={add}>
        <h2 className="h2">Add meal</h2>
        <label>Date</label>
        <input type="date" value={form.meal_date} onChange={(e) => setForm({ ...form, meal_date: e.target.value })} />
        <label>Slot</label>
        <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}>
          {SLOTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label>What’s cooking</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Tacos" />
        <label>Notes</label>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Need sour cream" />
        <button style={{ marginTop: 12 }} type="submit">Save meal</button>
      </form>
    </div>
  );
}

function parseIngredientLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+[–-]\s+|,\s+/);
      if (parts.length >= 2) return { qty: parts[0].trim(), name: parts.slice(1).join(" - ").trim() };
      return { qty: "", name: line };
    });
}

function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [menuDate, setMenuDate] = useState(todayISO());
  const [menuSlot, setMenuSlot] = useState("dinner");
  const [msg, setMsg] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  async function load() {
    try {
      setRecipes(await api("/recipes"));
    } catch (err) {
      setMsg(err.message || "Could not load recipes");
      setRecipes([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/recipes", {
        method: "POST",
        body: {
          title,
          servings,
          instructions,
          ingredients: parseIngredientLines(ingredients),
        },
      });
      setTitle("");
      setServings("");
      setIngredients("");
      setInstructions("");
      setMsg("Recipe saved.");
      await load();
    } catch (err) {
      setMsg(err.message || "Could not save recipe");
    }
  }

  async function toGrocery(id) {
    const r = await api(`/recipes/${id}/to-grocery`, { method: "POST" });
    setMsg(`Added ${r.added} ingredient${r.added === 1 ? "" : "s"} to groceries.`);
  }

  async function toMenu(e) {
    e.preventDefault();
    await api(`/recipes/${menuFor.id}/to-menu`, {
      method: "POST",
      body: { meal_date: menuDate, slot: menuSlot },
    });
    setMenuFor(null);
    setMsg(`${menuFor.title} added to the menu.`);
  }

  return (
    <div className="page">
      <h2 className="h2">Recipes</h2>
      {msg ? <p className="muted">{msg}</p> : null}
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          setImporting(true);
          try {
            const rec = await api("/recipes/import", { method: "POST", body: { url: importUrl } });
            setTitle(rec.title || "");
            setServings(rec.servings || "");
            setIngredients(
              (rec.ingredients || []).map((ing) => (ing.qty ? `${ing.qty} ${ing.name}` : ing.name)).join("\n")
            );
            setInstructions(rec.instructions || "");
            setMsg(rec.source ? `Imported from ${rec.source}. Check it, then Save recipe.` : "Imported. Check it, then Save recipe.");
          } catch (err) {
            setMsg(err.message || "Could not read that recipe link");
          } finally {
            setImporting(false);
          }
        }}
      >
        <label>Import from a recipe link</label>
        <div className="row">
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://…"
            required
          />
          <button type="submit" disabled={importing}>{importing ? "Reading…" : "Import"}</button>
        </div>
        <p className="muted">Works best on pages that publish a recipe card (Allrecipes, Food Network, many blogs).</p>
      </form>
      <form className="card" onSubmit={add}>
        <label>Recipe name</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Taco night" />
        <label>Servings</label>
        <input value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
        <label>Ingredients (one per line, optional “2 cups - rice”)</label>
        <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"1 lb - ground beef\nTaco shells\nCheese"} />
        <label>Instructions</label>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Brown the beef…" />
        <button style={{ marginTop: 12 }} type="submit">Save recipe</button>
      </form>
      {recipes.map((rec) => (
        <div className="card" key={rec.id}>
          <div className="row space">
            <strong>{rec.title}</strong>
            <button className="ghost small" onClick={async () => { if (confirm("Delete recipe?")) { await api(`/recipes/${rec.id}`, { method: "DELETE" }); load(); } }}>Delete</button>
          </div>
          {rec.servings ? <div className="muted">Serves {rec.servings}</div> : null}
          <ul>
            {(rec.ingredients || []).map((ing) => (
              <li key={ing.id}>{ing.qty ? `${ing.qty} ` : ""}{ing.name}</li>
            ))}
          </ul>
          {rec.instructions ? <p className="muted">{rec.instructions}</p> : null}
          <div className="row">
            <button className="small" onClick={() => toGrocery(rec.id)}>Add to grocery list</button>
            <button className="ghost small" onClick={() => setMenuFor(rec)}>Add to menu</button>
          </div>
        </div>
      ))}
      {menuFor && (
        <div className="modal-bg" onClick={() => setMenuFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">Add “{menuFor.title}” to menu</h2>
            <form onSubmit={toMenu}>
              <label>Date</label>
              <input type="date" value={menuDate} onChange={(e) => setMenuDate(e.target.value)} required />
              <label>Slot</label>
              <select value={menuSlot} onChange={(e) => setMenuSlot(e.target.value)}>
                {SLOTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <div className="row" style={{ marginTop: 12 }}>
                <button type="submit">Add to menu</button>
                <button className="ghost" type="button" onClick={() => setMenuFor(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GroceryPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  async function load() {
    setItems(await api("/groceries"));
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    await api("/groceries", { method: "POST", body: { name, qty } });
    setName("");
    setQty("");
    load();
  }

  return (
    <div className="page">
      <h2 className="h2">Grocery list</h2>
      <form className="row" onSubmit={add} style={{ marginBottom: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Milk" required style={{ flex: 2 }} />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="qty" style={{ flex: 1 }} />
        <button type="submit">Add</button>
      </form>
      <div className="card">
        {items.length === 0 && <div className="muted">List is empty</div>}
        {items.map((it) => (
          <div key={it.id} className={`check-row ${it.checked ? "done" : ""}`}>
            <input
              type="checkbox"
              checked={!!it.checked}
              onChange={async (e) => {
                await api(`/groceries/${it.id}`, { method: "PUT", body: { ...it, checked: e.target.checked } });
                load();
              }}
            />
            <span style={{ flex: 1 }}>
              {it.name} {it.qty ? <em className="muted">· {it.qty}</em> : null}
            </span>
            <button className="ghost small" onClick={async () => { await api(`/groceries/${it.id}`, { method: "DELETE" }); load(); }}>✕</button>
          </div>
        ))}
      </div>
      <button className="ghost" onClick={async () => { await api("/groceries/clear-checked", { method: "POST" }); load(); }}>
        Clear checked
      </button>
    </div>
  );
}

function ListsPage({ people = [] }) {
  const [lists, setLists] = useState([]);
  const [newList, setNewList] = useState("");
  const [drafts, setDrafts] = useState({});
  const [assignees, setAssignees] = useState({});
  const [dues, setDues] = useState({});
  const [filterWho, setFilterWho] = useState("all");

  async function load() {
    try {
      setLists(await api("/lists"));
    } catch (err) {
      alert(err.message || "Could not load lists");
    }
  }
  useEffect(() => { load(); }, []);

  function whoName(it) {
    const p = (people || []).find((x) => String(x.id) === String(it.person_id));
    return p?.short_name || it.assignee_short || "";
  }
  function whoColor(it) {
    const p = (people || []).find((x) => String(x.id) === String(it.person_id));
    return p?.color || it.assignee_color || personColor(p);
  }
  function visibleItems(list) {
    return (list.items || []).filter((it) => {
      if (filterWho === "all") return true;
      if (filterWho === "none") return !it.person_id;
      return String(it.person_id) === String(filterWho);
    });
  }

  return (
    <div className="page">
      <h2 className="h2">Family lists</h2>
      <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        <button type="button" className={"chip " + (filterWho === "all" ? "on" : "")} onClick={() => setFilterWho("all")}>Everyone</button>
        <button type="button" className={"chip " + (filterWho === "none" ? "on" : "")} onClick={() => setFilterWho("none")}>Unassigned</button>
        {(people || []).map((p) => (
          <button key={p.id} type="button" className={"chip " + (String(filterWho) === String(p.id) ? "on" : "")} onClick={() => setFilterWho(p.id)}>{p.short_name}</button>
        ))}
      </div>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = newList.trim();
          if (!name) return;
          try {
            await api("/lists", { method: "POST", body: { name } });
            setNewList("");
            await load();
          } catch (err) {
            alert(err.message || "Could not create list");
          }
        }}
      >
        <label>Add a list</label>
        <div className="row">
          <input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="Packing, Chores, Christmas…" required />
          <button type="submit">Add list</button>
        </div>
      </form>
      {lists.map((list) => (
        <div className="card" key={list.id} style={{ marginTop: 12 }}>
          <div className="row space">
            <strong>{list.name}</strong>
            <button className="ghost small" onClick={async () => { if (!confirm("Delete this list?")) return; await api(`/lists/${list.id}`, { method: "DELETE" }); load(); }}>Delete</button>
          </div>
          {visibleItems(list).length === 0 ? <p className="muted">No tasks for this filter.</p> : null}
          {visibleItems(list).map((it) => (
            <div key={it.id} className={"check-row " + (it.checked ? "done" : "")} style={{ flexWrap: "wrap" }}>
              <input type="checkbox" checked={!!it.checked} onChange={async (e) => { await api(`/lists/items/${it.id}`, { method: "PUT", body: { text: it.text, checked: e.target.checked, person_id: it.person_id, due_date: it.due_date } }); load(); }} />
              <span style={{ flex: 1 }}>{it.text}</span>
              <strong style={{ fontSize: 12, color: whoName(it) ? whoColor(it) : "#64748b" }}>{whoName(it) || "Anyone"}</strong>
              {it.due_date ? <span className="muted" style={{ fontSize: 12 }}>Due {it.due_date}</span> : <span className="muted" style={{ fontSize: 12 }}>No due date</span>}
              <select value={it.person_id || ""} onChange={async (e) => { await api(`/lists/items/${it.id}`, { method: "PUT", body: { text: it.text, checked: it.checked, person_id: e.target.value || null, due_date: it.due_date } }); load(); }} style={{ width: 110, margin: 0 }}>
                <option value="">Anyone</option>
                {(people || []).map((p) => <option key={p.id} value={p.id}>{p.short_name}</option>)}
              </select>
              <input type="date" value={it.due_date || ""} onChange={async (e) => { await api(`/lists/items/${it.id}`, { method: "PUT", body: { text: it.text, checked: it.checked, person_id: it.person_id, due_date: e.target.value || null } }); load(); }} style={{ width: 140, margin: 0 }} />
              <button className="ghost small" onClick={async () => { await api(`/lists/items/${it.id}`, { method: "DELETE" }); load(); }}>✕</button>
            </div>
          ))}
          <form className="row" style={{ marginTop: 8, flexWrap: "wrap" }} onSubmit={async (e) => {
            e.preventDefault();
            const text = (drafts[list.id] || "").trim();
            if (!text) return;
            try {
              await api("/lists/items", { method: "POST", body: { list_id: list.id, text, person_id: assignees[list.id] || null, due_date: dues[list.id] || null } });
              setDrafts({ ...drafts, [list.id]: "" });
              await load();
            } catch (err) {
              alert(err.message || "Could not add item");
            }
          }}>
            <input value={drafts[list.id] || ""} onChange={(e) => setDrafts({ ...drafts, [list.id]: e.target.value })} placeholder="Add item" required />
            <select value={assignees[list.id] || ""} onChange={(e) => setAssignees({ ...assignees, [list.id]: e.target.value })} style={{ width: 120, margin: 0 }}>
              <option value="">Anyone</option>
              {(people || []).map((p) => <option key={p.id} value={p.id}>{p.short_name}</option>)}
            </select>
            <input type="date" value={dues[list.id] || ""} onChange={(e) => setDues({ ...dues, [list.id]: e.target.value })} style={{ width: 140, margin: 0 }} />
            <button className="small" type="submit">Add</button>
          </form>
        </div>
      ))}
    </div>
  );
}
