CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS event_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  details TEXT DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT,
  start_time TEXT,
  end_time TEXT,
  all_day INTEGER NOT NULL DEFAULT 1,
  type_id INTEGER NOT NULL REFERENCES event_types(id),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_people (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, person_id)
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_date TEXT NOT NULL,
  slot TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grocery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  qty TEXT DEFAULT '',
  aisle TEXT DEFAULT '',
  checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_grocery_checked ON grocery_items(checked);

INSERT OR IGNORE INTO people (email, display_name, short_name) VALUES
  ('sacredholyhis@gmail.com', 'Jason', 'Jason'),
  ('mmj060504@gmail.com', 'Melanie', 'Melanie'),
  ('sethmartin142@gmail.com', 'Seth', 'Seth'),
  ('P.w.martin2007@gmail.com', 'Peyton', 'Peyton'),
  ('queenstaciegrace@gmail.com', 'Stacie', 'Stacie');

INSERT OR IGNORE INTO event_types (name, color, sort_order) VALUES
  ('Work', '#16a34a', 1),
  ('Out of Town', '#2563eb', 2),
  ('Doctor', '#ca8a04', 3),
  ('Recreational', '#dc2626', 4);

INSERT OR IGNORE INTO lists (id, name) VALUES
  (1, 'Family to-do'),
  (2, 'Packing');
