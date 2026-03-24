// ProtoAI CLI Selector — Portable Version
// Dynamic paths, no drive letters, fully self-contained

const fs = require("fs");
const path = require("path");
const https = require("https");

// -------------------------------
// RESOLVE ROOTS DYNAMICALLY
// -------------------------------
const CLI_DIR = __dirname;                          // ProtoAI/cli
const ROOT = path.resolve(CLI_DIR, "..");           // ProtoAI/
const DATA_DIR = path.join(ROOT, "data");           // ProtoAI/data
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const HELPERS_DIR = path.join(CLI_DIR, "helpers");

// -------------------------------
// ARGUMENT PARSING
// -------------------------------
const args = process.argv.slice(2);
let profile = "default";
let message = "";
let project = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "--profile") profile = args[i + 1];
    if (args[i] === "--chat") message = args[i + 1];
    if (args[i] === "--project") project = args[i + 1];
}

// -------------------------------
// LOAD PROFILES
// -------------------------------
const profileFile = path.join(HELPERS_DIR, "profiles.json");

if (!fs.existsSync(profileFile)) {
    console.error("Missing profiles.json");
    process.exit(1);
}

const profiles = JSON.parse(fs.readFileSync(profileFile, "utf8"));

if (!profiles[profile]) {
    console.error("Unknown profile:", profile);
    process.exit(1);
}

const p = profiles[profile];

// -------------------------------
// LOAD API KEY
// -------------------------------
const keyFile = path.join(DATA_DIR, "secret.key");

if (!fs.existsSync(keyFile)) {
    console.error("Missing decrypted key file.");
    process.exit(1);
}

const apiKey = fs.readFileSync(keyFile, "utf8").trim();

// -------------------------------
// LOAD MEMORY
// -------------------------------
let memoryText = "";

function loadMemory() {
    let globalMemory = [];
    let projectMemory = [];

    if (p.memory_mode === "global" || p.memory_mode === "global+project") {
        const globalMemoryFile = path.join(DATA_DIR, "memory-global.json");
        if (fs.existsSync(globalMemoryFile)) {
            globalMemory = JSON.parse(fs.readFileSync(globalMemoryFile, "utf8")).facts || [];
        }
    }

    if ((p.memory_mode === "project" || p.memory_mode === "global+project") && project) {
        const projectMemoryFile = path.join(PROJECTS_DIR, project, "memory.json");
        if (fs.existsSync(projectMemoryFile)) {
            projectMemory = JSON.parse(fs.readFileSync(projectMemoryFile, "utf8")).facts || [];
        }
    }

    const combined = [...globalMemory, ...projectMemory];
    memoryText = combined.length > 0
        ? combined.map(f => "- " + f).join("\n")
        : "(no memory)";
}

loadMemory();

// -------------------------------
// FILE INGESTION
// -------------------------------
let fileIngestion = [];

if (p.file_ingestion && project) {
    const projectDir = path.join(PROJECTS_DIR, project);

    if (fs.existsSync(projectDir)) {
        const files = fs.readdirSync(projectDir).filter(f => {
            const full = path.join(projectDir, f);
            return fs.statSync(full).isFile();
        });

        fileIngestion = files.map(f => {
            const full = path.join(projectDir, f);
            return {
                filename: f,
                content: fs.readFileSync(full, "utf8")
            };
        });
    }
}

// -------------------------------
// VERBOSITY + OUTPUT FORMATTING
// -------------------------------
function applyVerbosity(text) {
    if (p.verbosity === "concise") return text.slice(0, 800);
    if (p.verbosity === "expanded") return text + "\n\n(Expanded output mode)";
    return text;
}

function applyFormat(text) {
    if (p.format === "code") return "```txt\n" + text + "\n```";
    return text;
}

// -------------------------------
// CHAIN-OF-THOUGHT SUPPRESSION
// -------------------------------
function suppressCoT(text) {
    if (p.cot === "suppress") {
        return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
    }
    return text;
}

// -------------------------------
// BUILD MESSAGE PAYLOAD
// -------------------------------
function buildMessages() {
    const messages = [];

    messages.push({
        role: "system",
        content: `${p.system}\n\nProject Memory:\n${memoryText}`
    });

    messages.push({
        role: "user",
        content: message
    });

    if (p.file_ingestion) {
        fileIngestion.forEach(f => {
            messages.push({
                role: "user",
                content: `File: ${f.filename}\n\n${f.content}`
            });
        });
    }

    return messages;
}

// -------------------------------
// OPENROUTER REQUEST
// -------------------------------
function sendRequest(model, callback) {
    const payload = JSON.stringify({
        model,
        temperature: p.temperature,
        max_tokens: p.max_tokens,
        messages: buildMessages()
    });

    const options = {
        hostname: "openrouter.ai",
        path: "/api/v1/chat/completions",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "Content-Length": Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, res => {
        let data = "";

        res.on("data", chunk => data += chunk);
        res.on("end", () => {
            try {
                const json = JSON.parse(data);
                const reply = json.choices?.[0]?.message?.content || "";
                callback(null, reply);
            } catch (e) {
                callback(e, null);
            }
        });
    });

    req.on("error", err => callback(err, null));
    req.write(payload);
    req.end();
}

// -------------------------------
// FALLBACK CHAIN
// -------------------------------
const modelsToTry = [p.model, ...(p.fallback || [])];

function tryNextModel(index = 0) {
    if (index >= modelsToTry.length) {
        console.error("All models failed.");
        process.exit(1);
    }

    const model = modelsToTry[index];

    sendRequest(model, (err, reply) => {
        if (err || !reply) {
            return tryNextModel(index + 1);
        }

        let output = reply;
        output = suppressCoT(output);
        output = applyVerbosity(output);
        output = applyFormat(output);

        console.log(output);
    });
}

// -------------------------------
// START
// -------------------------------
tryNextModel();
