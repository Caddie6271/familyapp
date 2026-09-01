import { useEffect, useMemo, useState } from "react";
import { addDays, api, formatNice, monthMatrix, startOfWeek, todayISO } from "./lib/api.js";

const TABS = [
  { id: "calendar", label: "Calendar", ico: "📅" },
  { id: "menu", label: "Menu", ico: "🍽️" },
  { id: "groceries", label: "Groceries", ico: "🛒" },
  { id: "lists", label: "Lists", ico: "✓" },
];

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
        <p className="login-tag">Calendar · Menu · Groceries · Lists</p>
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

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [me, setMe] = useState(null);
  const [people, setPeople] = useState([]);
  const [types, setTypes] = useState([]);
  const [err, setErr] = useState("");
  const [booting, setBooting] = useState(true);

  async function boot() {
    try {
      const [m, p, t] = await Promise.all([api("/me"), api("/people"), api("/event-types")]);
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
      </header>
      {tab === "calendar" && <CalendarPage people={people} types={types} onTypes={setTypes} />}
      {!err && tab === "menu" && <MenuPage />}
      {!err && tab === "groceries" && <GroceryPage />}
      {!err && tab === "lists" && <ListsPage />}
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
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);
  const [addingType, setAddingType] = useState(false);

  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = addDays(`${year}-${String(month + 1).padStart(2, "0")}-28`, 10);

  async function load() {
    setEvents(await api(`/events?from=${from}&to=${to}`));
  }
  useEffect(() => {
    load();
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      let d = ev.start_date;
      const end = ev.end_date || ev.start_date;
      while (d <= end) {
        (map[d] ||= []).push(ev);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [events]);

  const weeks = monthMatrix(year, month);
  const label = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shift(n) {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <div className="page">
      <div className="row space" style={{ marginBottom: 10 }}>
        <button className="ghost small" onClick={() => shift(-1)}>‹</button>
        <h2 className="h2" style={{ margin: 0 }}>{label}</h2>
        <button className="ghost small" onClick={() => shift(1)}>›</button>
      </div>
      <div className="month-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div className="dow" key={i}>{d}</div>
        ))}
        {weeks.flat().map((day) => (
          <button
            key={day.date}
            className={`day ${day.inMonth ? "" : "off"} ${day.date === todayISO() ? "today" : ""}`}
            onClick={() => setOpen({ date: day.date })}
          >
            <div className="n">{day.day}</div>
            {(byDate[day.date] || []).slice(0, 3).map((ev) => (
              <span key={ev.id} className="pill" style={{ background: ev.type?.color || "#64748b" }}>
                {ev.title}
              </span>
            ))}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setOpen({ date: todayISO() })}>Add event</button>
        <button className="ghost" onClick={() => setAddingType(true)}>New type</button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {types.map((t) => (
          <span key={t.id} className="chip">
            <span style={{ width: 10, height: 10, borderRadius: 99, background: t.color, display: "inline-block" }} />
            {t.name}
          </span>
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
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: ev.type?.color, marginRight: 8 }} />
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
        <label>Associated to</label>
        <div className="row">
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

function ListsPage() {
  const [lists, setLists] = useState([]);
  const [newList, setNewList] = useState("");
  const [drafts, setDrafts] = useState({});

  async function load() {
    setLists(await api("/lists"));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <h2 className="h2">Family lists</h2>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/lists", { method: "POST", body: { name: newList } });
          setNewList("");
          load();
        }}
      >
        <input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="New list name" required />
        <button type="submit">Create</button>
      </form>
      {lists.map((list) => (
        <div className="card" key={list.id} style={{ marginTop: 12 }}>
          <div className="row space">
            <strong>{list.name}</strong>
            <button
              className="ghost small"
              onClick={async () => {
                if (!confirm("Delete this list?")) return;
                await api(`/lists/${list.id}`, { method: "DELETE" });
                load();
              }}
            >
              Delete
            </button>
          </div>
          {list.items.map((it) => (
            <div key={it.id} className={`check-row ${it.checked ? "done" : ""}`}>
              <input
                type="checkbox"
                checked={!!it.checked}
                onChange={async (e) => {
                  await api(`/lists/items/${it.id}`, { method: "PUT", body: { text: it.text, checked: e.target.checked } });
                  load();
                }}
              />
              <span style={{ flex: 1 }}>{it.text}</span>
              <button className="ghost small" onClick={async () => { await api(`/lists/items/${it.id}`, { method: "DELETE" }); load(); }}>✕</button>
            </div>
          ))}
          <form
            className="row"
            style={{ marginTop: 8 }}
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/lists/items", { method: "POST", body: { list_id: list.id, text: drafts[list.id] } });
              setDrafts({ ...drafts, [list.id]: "" });
              load();
            }}
          >
            <input
              value={drafts[list.id] || ""}
              onChange={(e) => setDrafts({ ...drafts, [list.id]: e.target.value })}
              placeholder="Add item"
              required
            />
            <button className="small" type="submit">Add</button>
          </form>
        </div>
      ))}
    </div>
  );
}
