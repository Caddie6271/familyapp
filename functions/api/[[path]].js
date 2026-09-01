const ALLOWED = new Set([
  "sacredholyhis@gmail.com",
  "mmj060504@gmail.com",
  "sethmartin142@gmail.com",
  "p.w.martin2007@gmail.com",
  "queenstaciegrace@gmail.com",
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function getEmail(request) {
  const cf = request.headers.get("Cf-Access-Authenticated-User-Email");
  const dev = request.headers.get("X-Dev-Email");
  return (cf || dev || "").trim().toLowerCase();
}

function requireUser(request) {
  const email = getEmail(request);
  if (!email || !ALLOWED.has(email)) {
    return { error: json({ error: "unauthorized" }, 401) };
  }
  return { email };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function eventWithPeople(db, ev) {
  const people = await db
    .prepare(
      `SELECT p.id, p.email, p.display_name, p.short_name
       FROM event_people ep JOIN people p ON p.id = ep.person_id
       WHERE ep.event_id = ?`
    )
    .bind(ev.id)
    .all();
  const type = await db.prepare("SELECT * FROM event_types WHERE id = ?").bind(ev.type_id).first();
  return { ...ev, people: people.results || [], type };
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 binding DB is missing. Set database_id in wrangler.toml and bind D1 in Pages." }, 500);

  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method.toUpperCase();

  const auth = requireUser(request);
  if (auth.error && !(parts[0] === "health")) return auth.error;

  try {
    if (parts[0] === "health") {
      return json({ ok: true });
    }

    if (parts[0] === "me" && method === "GET") {
      const person = await db.prepare("SELECT * FROM people WHERE lower(email) = ?").bind(auth.email).first();
      return json({ email: auth.email, person });
    }

    if (parts[0] === "people" && method === "GET") {
      const r = await db.prepare("SELECT * FROM people WHERE active = 1 ORDER BY display_name").all();
      return json(r.results || []);
    }

    if (parts[0] === "people" && parts[1] && method === "PUT") {
      const body = await readJson(request);
      await db
        .prepare("UPDATE people SET display_name = ?, short_name = ? WHERE id = ?")
        .bind(body.display_name, body.short_name || body.display_name, Number(parts[1]))
        .run();
      return json({ ok: true });
    }

    if (parts[0] === "event-types" && method === "GET") {
      const r = await db.prepare("SELECT * FROM event_types ORDER BY sort_order, name").all();
      return json(r.results || []);
    }

    if (parts[0] === "event-types" && method === "POST") {
      const body = await readJson(request);
      if (!body.name || !body.color) return json({ error: "name and color required" }, 400);
      const res = await db
        .prepare("INSERT INTO event_types (name, color, sort_order) VALUES (?, ?, 99)")
        .bind(body.name.trim(), body.color.trim())
        .run();
      return json({ id: res.meta.last_row_id }, 201);
    }

    if (parts[0] === "events" && method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = "SELECT * FROM events";
      const binds = [];
      if (from && to) {
        q += " WHERE start_date <= ? AND COALESCE(end_date, start_date) >= ?";
        binds.push(to, from);
      }
      q += " ORDER BY start_date, start_time";
      const stmt = binds.length ? db.prepare(q).bind(...binds) : db.prepare(q);
      const r = await stmt.all();
      const out = [];
      for (const ev of r.results || []) out.push(await eventWithPeople(db, ev));
      return json(out);
    }

    if (parts[0] === "events" && method === "POST") {
      const body = await readJson(request);
      if (!body.title || !body.start_date || !body.type_id) {
        return json({ error: "title, start_date, and type_id required" }, 400);
      }
      const res = await db
        .prepare(
          `INSERT INTO events (title, details, start_date, end_date, start_time, end_time, all_day, type_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          body.title.trim(),
          body.details || "",
          body.start_date,
          body.end_date || body.start_date,
          body.start_time || null,
          body.end_time || null,
          body.all_day === false ? 0 : 1,
          Number(body.type_id),
          auth.email
        )
        .run();
      const id = res.meta.last_row_id;
      for (const pid of body.person_ids || []) {
        await db.prepare("INSERT OR IGNORE INTO event_people (event_id, person_id) VALUES (?, ?)").bind(id, Number(pid)).run();
      }
      const ev = await db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
      return json(await eventWithPeople(db, ev), 201);
    }

    if (parts[0] === "events" && parts[1] && method === "PUT") {
      const id = Number(parts[1]);
      const body = await readJson(request);
      await db
        .prepare(
          `UPDATE events SET title=?, details=?, start_date=?, end_date=?, start_time=?, end_time=?, all_day=?, type_id=?, updated_at=datetime('now')
           WHERE id=?`
        )
        .bind(
          body.title.trim(),
          body.details || "",
          body.start_date,
          body.end_date || body.start_date,
          body.start_time || null,
          body.end_time || null,
          body.all_day === false ? 0 : 1,
          Number(body.type_id),
          id
        )
        .run();
      await db.prepare("DELETE FROM event_people WHERE event_id = ?").bind(id).run();
      for (const pid of body.person_ids || []) {
        await db.prepare("INSERT INTO event_people (event_id, person_id) VALUES (?, ?)").bind(id, Number(pid)).run();
      }
      const ev = await db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
      return json(await eventWithPeople(db, ev));
    }

    if (parts[0] === "events" && parts[1] && method === "DELETE") {
      await db.prepare("DELETE FROM event_people WHERE event_id = ?").bind(Number(parts[1])).run();
      await db.prepare("DELETE FROM events WHERE id = ?").bind(Number(parts[1])).run();
      return json({ ok: true });
    }

    if (parts[0] === "meals" && method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const r = await db
        .prepare("SELECT * FROM meals WHERE meal_date >= ? AND meal_date <= ? ORDER BY meal_date, slot")
        .bind(from || "1970-01-01", to || "2099-12-31")
        .all();
      return json(r.results || []);
    }

    if (parts[0] === "meals" && method === "POST") {
      const body = await readJson(request);
      const res = await db
        .prepare("INSERT INTO meals (meal_date, slot, title, notes) VALUES (?, ?, ?, ?)")
        .bind(body.meal_date, body.slot, body.title.trim(), body.notes || "")
        .run();
      return json({ id: res.meta.last_row_id }, 201);
    }

    if (parts[0] === "meals" && parts[1] && method === "PUT") {
      const body = await readJson(request);
      await db
        .prepare("UPDATE meals SET meal_date=?, slot=?, title=?, notes=? WHERE id=?")
        .bind(body.meal_date, body.slot, body.title.trim(), body.notes || "", Number(parts[1]))
        .run();
      return json({ ok: true });
    }

    if (parts[0] === "meals" && parts[1] && method === "DELETE") {
      await db.prepare("DELETE FROM meals WHERE id = ?").bind(Number(parts[1])).run();
      return json({ ok: true });
    }

    if (parts[0] === "groceries" && method === "GET") {
      const r = await db.prepare("SELECT * FROM grocery_items ORDER BY checked, aisle, name").all();
      return json(r.results || []);
    }

    if (parts[0] === "groceries" && method === "POST") {
      const body = await readJson(request);
      const res = await db
        .prepare("INSERT INTO grocery_items (name, qty, aisle) VALUES (?, ?, ?)")
        .bind(body.name.trim(), body.qty || "", body.aisle || "")
        .run();
      return json({ id: res.meta.last_row_id }, 201);
    }

    if (parts[0] === "groceries" && parts[1] && method === "PUT") {
      const body = await readJson(request);
      await db
        .prepare("UPDATE grocery_items SET name=?, qty=?, aisle=?, checked=? WHERE id=?")
        .bind(body.name, body.qty || "", body.aisle || "", body.checked ? 1 : 0, Number(parts[1]))
        .run();
      return json({ ok: true });
    }

    if (parts[0] === "groceries" && parts[1] && method === "DELETE") {
      await db.prepare("DELETE FROM grocery_items WHERE id = ?").bind(Number(parts[1])).run();
      return json({ ok: true });
    }

    if (parts[0] === "groceries" && parts[1] === "clear-checked" && method === "POST") {
      await db.prepare("DELETE FROM grocery_items WHERE checked = 1").run();
      return json({ ok: true });
    }

    if (parts[0] === "lists" && method === "GET") {
      const lists = (await db.prepare("SELECT * FROM lists ORDER BY id").all()).results || [];
      const out = [];
      for (const list of lists) {
        const items = await db
          .prepare("SELECT * FROM list_items WHERE list_id = ? ORDER BY checked, sort_order, id")
          .bind(list.id)
          .all();
        out.push({ ...list, items: items.results || [] });
      }
      return json(out);
    }

    if (parts[0] === "lists" && method === "POST") {
      const body = await readJson(request);
      const res = await db.prepare("INSERT INTO lists (name) VALUES (?)").bind(body.name.trim()).run();
      return json({ id: res.meta.last_row_id }, 201);
    }

    if (parts[0] === "lists" && parts[1] && method === "DELETE") {
      await db.prepare("DELETE FROM list_items WHERE list_id = ?").bind(Number(parts[1])).run();
      await db.prepare("DELETE FROM lists WHERE id = ?").bind(Number(parts[1])).run();
      return json({ ok: true });
    }

    if (parts[0] === "lists" && parts[1] === "items" && method === "POST") {
      const body = await readJson(request);
      const res = await db
        .prepare("INSERT INTO list_items (list_id, text, sort_order) VALUES (?, ?, 0)")
        .bind(Number(body.list_id), body.text.trim())
        .run();
      return json({ id: res.meta.last_row_id }, 201);
    }

    if (parts[0] === "lists" && parts[1] === "items" && parts[2] && method === "PUT") {
      const body = await readJson(request);
      await db
        .prepare("UPDATE list_items SET text=?, checked=? WHERE id=?")
        .bind(body.text, body.checked ? 1 : 0, Number(parts[2]))
        .run();
      return json({ ok: true });
    }

    if (parts[0] === "lists" && parts[1] === "items" && parts[2] && method === "DELETE") {
      await db.prepare("DELETE FROM list_items WHERE id = ?").bind(Number(parts[2])).run();
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
