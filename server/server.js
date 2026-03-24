// ===============================
// ProtoAI — Fully Portable Server
// Dynamic paths, recursive ingest,
// folder‑aware upload, clean routes
// ===============================

const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "200mb" }));

// ---------------------------------------
// DYNAMIC ROOT — NO HARD‑CODED DRIVE LETTERS
// ---------------------------------------
const ROOT = path.resolve(__dirname, "..");          // ProtoAI/
const SERVER_DIR = path.join(ROOT, "server");        // ProtoAI/server
const UI_DIR = path.join(ROOT, "ui");                // ProtoAI/ui
const DATA_DIR = path.join(ROOT, "data");            // ProtoAI/data
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const LOGS_DIR = path.join(DATA_DIR, "logs");
const LOG_FILE = path.join(LOGS_DIR, "server.log");

const CLI_DIR = path.join(ROOT, "cli");
const PROFILES_FILE = path.join(CLI_DIR, "helpers", "profiles.json");
const CLAUDE_CMD = path.join(CLI_DIR, "claude-select.cmd");

// Ensure required directories exist
[DATA_DIR, PROJECTS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ---------------------------------------
// LOGGING
// ---------------------------------------
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

// ---------------------------------------
// STATIC UI
// ---------------------------------------
app.use("/", express.static(UI_DIR));

// ---------------------------------------
// LIST PROJECTS
// ---------------------------------------
app.get("/projects", (req, res) => {
  const list = fs.readdirSync(PROJECTS_DIR).filter(f =>
    fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory()
  );
  res.json({ projects: list });
});

// ---------------------------------------
// LOAD PROFILES
// ---------------------------------------
app.get("/profiles", (req, res) => {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, "utf8");
    const profiles = JSON.parse(raw);
    res.json({ profiles });
  } catch (err) {
    res.json({ profiles: {} });
  }
});

// ---------------------------------------
// CREATE DIRECTORIES RECURSIVELY
// ---------------------------------------
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------
// UPLOAD FILE (supports nested folders)
// ---------------------------------------
app.post("/upload", (req, res) => {
  const { project, filename, content } = req.body;
  if (!project || !filename) return res.status(400).send("Missing fields");

  const projectRoot = path.join(PROJECTS_DIR, project);
  const fullPath = path.join(projectRoot, filename);

  ensureDir(fullPath);
  fs.writeFileSync(fullPath, content, "utf8");

  log(`Uploaded: ${filename} → ${project}`);
  res.json({ ok: true });
});

// ---------------------------------------
// RECURSIVE INGEST
// Returns: { files: [ { filename, content } ] }
// ---------------------------------------
function walkRecursive(dir, base = "") {
  let results = [];

  fs.readdirSync(dir).forEach(entry => {
    const full = path.join(dir, entry);
    const rel = path.join(base, entry);

    if (fs.statSync(full).isDirectory()) {
      results = results.concat(walkRecursive(full, rel));
    } else {
      const content = fs.readFileSync(full, "utf8");
      results.push({ filename: rel.replace(/\\/g, "/"), content });
    }
  });

  return results;
}

app.post("/ingest", (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).send("Missing project");

  const projectRoot = path.join(PROJECTS_DIR, project);
  if (!fs.existsSync(projectRoot)) return res.json({ files: [] });

  const files = walkRecursive(projectRoot);
  res.json({ files });
});

// ---------------------------------------
// LOAD HISTORY
// ---------------------------------------
app.get("/history/:project", (req, res) => {
  const project = req.params.project;
  const file = path.join(PROJECTS_DIR, project, "history.json");

  if (!fs.existsSync(file)) return res.json([]);

  try {
    const raw = fs.readFileSync(file, "utf8");
    res.json(JSON.parse(raw));
  } catch {
    res.json([]);
  }
});

// ---------------------------------------
// SAVE HISTORY
// ---------------------------------------
function saveHistory(project, history) {
  const file = path.join(PROJECTS_DIR, project, "history.json");
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(history, null, 2), "utf8");
}

// ---------------------------------------
// CHAT ENDPOINT
// Calls CLI → returns assistant response
// ---------------------------------------
app.post("/chat", (req, res) => {
  const { project, profile, engine, message } = req.body;

  if (!project || !profile || !message)
    return res.status(400).send("Missing fields");

  const cmd = `"${CLAUDE_CMD}" --profile "${profile}" --engine "${engine}" --project "${project}" --chat "${message.replace(/"/g, '\\"')}"`;

  log(`EXEC: ${cmd}`);

  exec(cmd, { cwd: CLI_DIR }, (err, stdout, stderr) => {
    if (err) {
      log(`ERROR: ${err}`);
      return res.json({ response: "⚠️ Backend error. Check server.log." });
    }

    const reply = stdout.trim() || "[No response]";

    // Save to history
    const histFile = path.join(PROJECTS_DIR, project, "history.json");
    let history = [];
    if (fs.existsSync(histFile)) {
      try {
        history = JSON.parse(fs.readFileSync(histFile, "utf8"));
      } catch {}
    }

    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });
    saveHistory(project, history);

    res.json({ response: reply });
  });
});

// ---------------------------------------
// START SERVER
// ---------------------------------------
const PORT = 17890;

// This makes http://localhost:17890/ load your index.html
app.use(express.static(UI_DIR)); 

app.get("/", (req, res) => {
  res.sendFile(path.join(UI_DIR, "index.html"));
});

app.listen(PORT, () => {
  log(`ProtoAI server running on port ${PORT}`);
  log(`ROOT: ${ROOT}`);
});
