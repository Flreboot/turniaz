const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const usersPath = path.join(__dirname, "data", "users.json");
const turniPath = path.join(__dirname, "data", "turni2026.json");

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(usersPath, "utf8"));
}

function loadTurni() {
  return JSON.parse(fs.readFileSync(turniPath, "utf8"));
}

function getAllRows() {
  const db = loadTurni();

  return db.resources.flatMap((r) =>
    r.shifts.map((s) => ({
      resource_name: r.name,
      contract_hours: r.contract_hours,
      page: r.page,
      ...s
    }))
  );
}

function getMonthName(month) {
  const mesi = [
    "",
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre"
  ];
  return mesi[Number(month)] || "";
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  try {
    const users = loadUsers();

    const user = users.find(
      (u) =>
        normalize(u.username) === normalize(username) &&
        normalize(u.password) === normalize(password)
    );

    if (user) {
      return res.json({
        success: true,
        nome: user.nome
      });
    }

    return res.json({
      success: false,
      message: "Username o password non corretti"
    });
  } catch (err) {
    console.error("Errore users:", err);

    return res.status(500).json({
      success: false,
      message: "Errore interno server"
    });
  }
});

app.get("/api/resources", (req, res) => {
  try {
    const db = loadTurni();

    const resources = db.resources.map((r) => ({
      name: r.name,
      contract_hours: r.contract_hours,
      page: r.page,
      shifts_count: r.shifts_count
    }));

    res.json({
      year: db.year,
      count: resources.length,
      resources
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore lettura database" });
  }
});

app.get("/api/turni/resource/:name/day/:date", (req, res) => {
  try {
    const db = loadTurni();
    const name = normalize(req.params.name);
    const date = req.params.date;

    const resource = db.resources.find((r) => normalize(r.name) === name);

    if (!resource) {
      return res.status(404).json({ error: "Risorsa non trovata" });
    }

    const shift = resource.shifts.find((s) => s.date === date);

    if (!shift) {
      return res.status(404).json({ error: "Turno non trovato" });
    }

    res.json({
      type: "single-day-resource",
      resource: resource.name,
      contract_hours: resource.contract_hours,
      date,
      shift
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore query turno giornaliero" });
  }
});

app.get("/api/turni/resource/:name/month/:month", (req, res) => {
  try {
    const db = loadTurni();
    const name = normalize(req.params.name);
    const month = Number(req.params.month);

    const resource = db.resources.find((r) => normalize(r.name) === name);

    if (!resource) {
      return res.status(404).json({ error: "Risorsa non trovata" });
    }

    const shifts = resource.shifts.filter((s) => Number(s.month) === month);

    res.json({
      type: "month-resource",
      resource: resource.name,
      contract_hours: resource.contract_hours,
      month,
      month_name: getMonthName(month),
      count: shifts.length,
      shifts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore query mensile" });
  }
});

app.get("/api/turni/resource/:name/year/2026", (req, res) => {
  try {
    const db = loadTurni();
    const name = normalize(req.params.name);

    const resource = db.resources.find((r) => normalize(r.name) === name);

    if (!resource) {
      return res.status(404).json({ error: "Risorsa non trovata" });
    }

    res.json({
      type: "year-resource",
      resource: resource.name,
      contract_hours: resource.contract_hours,
      year: 2026,
      count: resource.shifts.length,
      shifts: resource.shifts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore query annuale" });
  }
});

app.get("/api/turni/all/day/:date", (req, res) => {
  try {
    const date = req.params.date;
    const rows = getAllRows().filter((r) => r.date === date);

    res.json({
      type: "all-day",
      date,
      count: rows.length,
      rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore query giornaliera generale" });
  }
});

app.get("/api/turni/all/week", (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "Servono start ed end" });
    }

    const rows = getAllRows().filter((r) => r.date >= start && r.date <= end);

    res.json({
      type: "all-week",
      start,
      end,
      count: rows.length,
      rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore query settimanale" });
  }
});

app.listen(PORT, () => {
  console.log("Server attivo su http://localhost:" + PORT);
});