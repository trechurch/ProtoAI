const API_BASE = window.location.origin;

/* ============================================================
   GLOBAL STATE
============================================================ */
let state = {
  projects: [],
  currentProject: null,

  chats: [],
  currentChatId: null,

  profiles: {},
  currentProfile: null,

  engines: [
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.5-haiku",
    "google/gemini-pro",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-coder",
    "qwen/qwen2.5-coder"
  ],
  currentEngine: null,

  currentMode: "default",

  files: [],

  shortcutOverlayVisible: false
};

const els = {};
let monacoEditor = null;

/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadInitialData();
});

/* ============================================================
   ELEMENT CACHE
============================================================ */
function cacheElements() {
  // Sidebar
  els.projectList = document.getElementById("projectList");
  els.newProjectBtn = document.getElementById("newProjectBtn");
  els.profileSelect = document.getElementById("profileSelect");
  els.currentProfileName = document.getElementById("currentProfileName");
  els.chatTabs = document.getElementById("chatTabs");
  els.newChatBtn = document.getElementById("newChatBtn");

  // Workspace
  els.workspace = document.getElementById("workspace");
  els.topbar = document.getElementById("topbar");
  els.currentProjectName = document.getElementById("currentProjectName");
  els.canvas = document.getElementById("canvas");
  els.chatContainer = document.getElementById("chatContainer");

  els.splitToggleBtn = document.getElementById("splitToggleBtn");
  els.toggleCanvasBtn = document.getElementById("toggleCanvasBtn");

  // Input bar
  els.modeSelect = document.getElementById("modeSelect");
  els.messageInput = document.getElementById("messageInput");
  els.sendBtn = document.getElementById("sendBtn");
  els.attachFileBtn = document.getElementById("attachFileBtn");
  els.addSourceBtn = document.getElementById("addSourceBtn");
  els.fileInput = document.getElementById("fileInput");

  // Jump controls
  els.jumpLatestBtn = document.getElementById("jumpLatestBtn");
  els.jumpPrevBtn = document.getElementById("jumpPrevBtn");

  // Right sidebar
  els.otfmsEngineSelect = document.getElementById("otfmsEngineSelect");
  els.applyEngineBtn = document.getElementById("applyEngineBtn");

  els.contextFileList = document.getElementById("contextFileList");
  els.contextFilesEmpty = document.getElementById("contextFilesEmpty");

  els.contextBubble = document.getElementById("contextBubble");
  els.toolsBubble = document.getElementById("toolsBubble");

  els.shortcutOverlay = document.getElementById("shortcutOverlay");
}

/* ============================================================
   EVENT BINDINGS
============================================================ */
function bindEvents() {
  // Projects & chats
  els.newProjectBtn.addEventListener("click", onNewProject);
  els.newChatBtn.addEventListener("click", onNewChat);

  // Profiles
  els.profileSelect.addEventListener("change", onProfileChange);

  // Engine / OTFMS
  els.otfmsEngineSelect.addEventListener("change", onOTFMSEngineChange);
  els.applyEngineBtn.addEventListener("click", onApplyEngineToChat);

  // Input
  els.sendBtn.addEventListener("click", onSend);
  els.attachFileBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", onFilesSelected);

  els.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });

  // Mode selector
  els.modeSelect.addEventListener("change", () => {
    state.currentMode = els.modeSelect.value;
  });

  // Layout controls
  els.splitToggleBtn.addEventListener("click", onSplitToggle);
  els.toggleCanvasBtn.addEventListener("click", toggleCanvas);

  // Jump controls
  els.jumpLatestBtn.addEventListener("click", scrollChatToBottom);
  els.jumpPrevBtn.addEventListener("click", jumpToPreviousResponse);

  // Bubbles (Context & Tools)
  document.querySelectorAll(".bubble-header[data-target]").forEach((header) => {
    header.addEventListener("click", () => {
      const targetId = header.dataset.target;
      const bubble = header.closest(".bubble");
      bubble.classList.toggle("collapsed");
    });
  });

  // Tools
  document.querySelectorAll(".tool-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      onActionChip(action);
    });
  });

  // Global shortcuts
  document.addEventListener("keydown", onGlobalKeyDown);

  // Shortcut overlay click
  els.shortcutOverlay.addEventListener("click", (e) => {
    if (e.target === els.shortcutOverlay) hideShortcutOverlay();
  });
}

/* ============================================================
   INITIAL LOAD
============================================================ */
async function loadInitialData() {
  console.log("Initializing ProtoAI...");
  
  // Use a safer sequence to ensure one failure doesn't kill the whole UI
  try {
    await loadProfiles();
    renderProfiles();
  } catch (e) { console.error("Profiles failed:", e); }

  try {
    await loadProjects();
    renderProjects();
  } catch (e) { console.error("Projects failed:", e); }

  renderEngines();
  
  // Auto-select first project if available
  if (state.projects.length > 0 && !state.currentProject) {
    selectProject(state.projects[0]);
  }
}

/* ============================================================
   PROJECTS
============================================================ */
async function loadProjects() {
  try {
    // We use the current window origin to ensure portability
    const res = await fetch(`${window.location.origin}/projects`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const data = await res.json();
    
    // Crucial: server.js returns { projects: [...] }, so we grab .projects
    state.projects = Array.isArray(data.projects) ? data.projects : [];
    
    console.log("Successfully loaded projects:", state.projects);
  } catch (err) {
    console.error("Critical error loading projects from server:", err);
    state.projects = [];
  }
}

function renderProjects() {
  if (!els.projectList) {
    console.error("UI Error: 'projectList' element not found in HTML.");
    return;
  }

  els.projectList.innerHTML = "";
  
  if (state.projects.length === 0) {
    els.projectList.innerHTML = '<li class="empty-state">No projects found</li>';
    return;
  }

  state.projects.forEach((name) => {
    const li = document.createElement("li");
    li.className = "project-item"; // Matches your VS Code style CSS
    if (state.currentProject === name) li.classList.add("active");
    
    // Simple icon + text for that "Sidebar" look
    li.innerHTML = `
      <span class="icon">📁</span>
      <span class="name">${name}</span>
    `;
    
    li.addEventListener("click", () => selectProject(name));
    els.projectList.appendChild(li);
  });
}

async function onNewProject() {
  const name = prompt("Enter unique project name:");
  if (!name || name.trim() === "") return;

  try {
    const response = await fetch(`${window.location.origin}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: name,
        filename: "init.txt",
        content: `Project ${name} created on ${new Date().toLocaleString()}`
      })
    });

    if (response.ok) {
      // Refresh the list from the server to be sure
      await loadProjects();
      renderProjects();
      selectProject(name);
    }
  } catch (err) {
    alert("Could not create project. Is the server running?");
    console.error("Error creating project:", err);
  }
}

async function selectProject(name) {
  state.currentProject = name;
  els.currentProjectName.textContent = name || "No project selected";
  renderProjects();

  // 1. Clear current UI state so old project data doesn't linger
  state.chats = [];
  state.files = [];
  state.currentChatId = null;

  // 2. Load History (This populates the center panel)
  await loadHistory(name); 
  
  // 3. NEW: Load Files (This populates the Right Sidebar)
  try {
    const res = await fetch(`${window.location.origin}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: name })
    });
    const data = await res.json();
    state.files = data.files || []; 
    console.log(`Ingested ${state.files.length} files for ${name}`);
  } catch (err) {
    console.error("Ingest failed:", err);
  }

  // 4. Refresh all UI components
  ensureDefaultChat();
  renderChatTabs();
  renderHistory();
  renderContextFiles(); // This is the call that was missing!
}
/* ============================================================
   CHAT HISTORY
============================================================ */
async function loadHistory(projectName) {
  try {
    const res = await fetch(`${window.location.origin}/history/${projectName}`);
    const data = await res.json();

    // If it's a flat array (from your server.js), wrap it so the UI can draw it
    if (Array.isArray(data) && data.length > 0) {
      state.chats = [{
        id: "default",
        name: "Latest Session",
        messages: data
      }];
      state.currentChatId = "default";
    } else {
      state.chats = [];
    }
  } catch (err) {
    console.error("Error loading history:", err);
    state.chats = [];
  }
}

function getCurrentChat() {
  return state.chats.find((c) => c.id === state.currentChatId) || null;
}

function ensureDefaultChat() {
  if (!state.currentProject) return;
  if (!state.chats.length) {
    const id = "chat-1";
    state.chats = [{ id, name: "Chat 1", history: [] }];
    state.currentChatId = id;
  }
}

function renderChatTabs() {
  if (!els.chatTabs) return;
  els.chatTabs.innerHTML = "";

  state.chats.forEach((chat) => {
    const btn = document.createElement("button");
    // Use the ID to check for active state
    btn.className = "tab" + (chat.id === state.currentChatId ? " active" : "");
    
    // FALLBACK: If chat.name is missing, use a default string
    btn.textContent = chat.name || chat.title || "New Chat";
    
    btn.addEventListener("click", () => selectChat(chat.id));
    els.chatTabs.appendChild(btn);
  });
}

function selectChat(chatId) {
  state.currentChatId = chatId;
  renderChatTabs();
  renderHistory();
}

/* ============================================================
   CHAT RENDERING
============================================================ */
function renderHistory() {
  els.chatContainer.innerHTML = "";
  const chat = getCurrentChat();
  const history = chat ? chat.history || [] : [];
  history.forEach((msg) => appendMessage(msg.role, msg.content, false));
  scrollChatToBottom();
}

function appendMessage(role, content, pushToState = true) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const header = document.createElement("div");
  header.className = "message-header";
  header.innerHTML = `<span>${
    role === "user" ? "You" : "Assistant"
  }</span><span>${new Date().toLocaleTimeString()}</span>`;

  const body = document.createElement("div");
  body.className = "message-body";
  body.innerHTML = marked.parse(content || "");

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  els.chatContainer.appendChild(wrapper);

  if (pushToState) {
    const chat = getCurrentChat();
    if (chat) {
      chat.history = chat.history || [];
      chat.history.push({ role, content });
    }
  }

  scrollChatToBottom();
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    els.canvas.scrollTop = els.canvas.scrollHeight;
  });
}

/* Jump to previous major assistant response */
function jumpToPreviousResponse() {
  const messages = Array.from(
    els.chatContainer.querySelectorAll(".message.assistant")
  );
  if (!messages.length) return;

  const currentScroll = els.canvas.scrollTop;
  const candidates = messages.filter(
    (m) => m.offsetTop < currentScroll - 10
  );

  if (!candidates.length) {
    // If none above, go to first
    els.canvas.scrollTop = 0;
    return;
  }

  const target = candidates[candidates.length - 1];
  els.canvas.scrollTop = target.offsetTop - 8;
}

/* ============================================================
   SENDING MESSAGES
============================================================ */
async function onSend() {
  const message = els.chatInput.value.trim();
  if (!message || !state.currentProject) return;

  // Grab OTFMP values right now
  const profile = els.profileSelect.value;
  const engine = els.engineSelect.value;

  // Add user message to UI immediately
  appendMessage("user", message);
  els.chatInput.value = "";

  try {
    const res = await fetch(`${window.location.origin}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: state.currentProject,
        profile: profile,
        engine: engine,
        message: message
      })
    });
    
    const data = await res.json();
    appendMessage("assistant", data.response);
  } catch (err) {
    appendMessage("assistant", "❌ Error: Could not reach the backend.");
  }
}

function appendLoadingMessage() {
  const id = `loading-${Date.now()}`;
  const wrapper = document.createElement("div");
  wrapper.className = "message assistant";
  wrapper.dataset.loadingId = id;

  const header = document.createElement("div");
  header.className = "message-header";
  header.innerHTML = `<span>Assistant</span><span>Thinking…</span>`;

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = "…";

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  els.chatContainer.appendChild(wrapper);
  scrollChatToBottom();
  return id;
}

function removeLoadingMessage(id) {
  const el = els.chatContainer.querySelector(`[data-loading-id="${id}"]`);
  if (el) el.remove();
}

/* ============================================================
   PROFILES + ENGINES
============================================================ */
async function loadProfiles() {
  try {
    const res = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    state.profiles = data.profiles || {};

    if (!state.currentProfile && Object.keys(state.profiles).length > 0) {
      state.currentProfile = Object.keys(state.profiles)[0];
    }
  } catch (err) {
    console.error("Error loading profiles:", err);
    state.profiles = {};
  }
}

function renderProfiles() {
  if (!els.profileSelect) return;
  els.profileSelect.innerHTML = "";

  // Extract the profile keys from state.profiles.profiles
  const profileKeys = Object.keys(state.profiles.profiles || {});

  if (profileKeys.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No profiles found";
    els.profileSelect.appendChild(opt);
    return;
  }

  profileKeys.forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    els.profileSelect.appendChild(opt);
  });

  // Set default if not set
  if (!state.currentProfile && profileKeys.length > 0) {
    state.currentProfile = profileKeys[0];
  }
  els.profileSelect.value = state.currentProfile;
}
function updateProfileBadge() {
  els.currentProfileName.textContent = state.currentProfile || "No profile";
}

function onProfileChange() {
  state.currentProfile = els.profileSelect.value;
  updateProfileBadge();
}

ffunction renderEngines() {
  if (!els.engineSelect) return;
  els.engineSelect.innerHTML = "";

  state.engines.forEach((eng) => {
    const opt = document.createElement("option");
    opt.value = eng;
    // Display a cleaner name (e.g., "claude-3.5-sonnet")
    opt.textContent = eng.split('/').pop(); 
    els.engineSelect.appendChild(opt);
  });

  if (!state.currentEngine) state.currentEngine = state.engines[0];
  els.engineSelect.value = state.currentEngine;
}

function onOTFMSEngineChange() {
  state.currentEngine = els.otfmsEngineSelect.value;
}

function onApplyEngineToChat() {
  alert(
    `Engine set to:\n${state.currentEngine}\n\nAll subsequent messages will use this engine.`
  );
}

/* ============================================================
   FILE UPLOAD + CONTEXT
============================================================ */
function onFilesSelected(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  if (!state.currentProject) {
    alert("Select or create a project first.");
    return;
  }

  files.forEach((file) => {
    const rel = file.webkitRelativePath || file.name;
    uploadFileToProject(state.currentProject, file, rel);
  });

  els.fileInput.value = "";
}

async function uploadFileToProject(project, file, relPath) {
  try {
    const content = await file.text();

    await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        filename: relPath,
        content
      })
    });

    state.files.push({ filename: relPath });
    renderContextFiles();
  } catch (err) {
    console.error("Error uploading file:", err);
  }
}

function renderContextFiles() {
  if (!els.contextFileList) return;
  els.contextFileList.innerHTML = "";

  const emptyMsg = document.getElementById("contextFilesEmpty");

  if (state.files.length === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";

  state.files.forEach((file) => {
    const li = document.createElement("li");
    li.className = "file-item";
    
    // Get just the filename for display, keep full path for the tooltip
    const displayName = file.filename.split('/').pop();
    
    li.innerHTML = `
      <span class="file-icon">📄</span>
      <span class="file-name" title="${file.filename}">${displayName}</span>
    `;
    
    els.contextFileList.appendChild(li);
  });
}
/* ============================================================
   LAYOUT CONTROLS
============================================================ */
function onSplitToggle() {
  // Placeholder: you can wire this to a real split view later
  alert("Split view toggle clicked (hook up to Monaco / layout when ready).");
}

function toggleCanvas() {
  const collapsed = els.workspace.classList.toggle("canvas-collapsed");
  els.toggleCanvasBtn.classList.toggle("active", collapsed);
}

/* ============================================================
   ACTION CHIPS
============================================================ */
function onActionChip(action) {
  switch (action) {
    case "image":
      appendMessage("assistant", "🖼 Image generation requested.");
      break;
    case "deepsearch":
      appendMessage("assistant", "🔎 Deep search requested.");
      break;
    case "podcast":
      appendMessage("assistant", "🎙 Podcast creation requested.");
      break;
    case "quiz":
      appendMessage("assistant", "🧠 Quiz requested.");
      break;
    case "connectors":
      appendMessage("assistant", "🔌 Connectors requested.");
      break;
  }
}

/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */
function onGlobalKeyDown(e) {
  // Show shortcuts overlay: Shift + ?
  if (e.key === "?" && e.shiftKey) {
    showShortcutOverlay();
    return;
  }

  // Hide overlay
  if (state.shortcutOverlayVisible && e.key === "Escape") {
    hideShortcutOverlay();
    return;
  }

  // Send message: Ctrl+Enter
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    onSend();
  }

  // Jump to latest: Alt+End
  if (e.altKey && e.key === "End") {
    e.preventDefault();
    scrollChatToBottom();
  }

  // Previous response: Alt+ArrowUp
  if (e.altKey && e.key === "ArrowUp") {
    e.preventDefault();
    jumpToPreviousResponse();
  }
}

/* ============================================================
   SHORTCUT OVERLAY
============================================================ */
function showShortcutOverlay() {
  state.shortcutOverlayVisible = true;
  els.shortcutOverlay.classList.remove("hidden");
  els.shortcutOverlay.style.display = "block";
}

function hideShortcutOverlay() {
  state.shortcutOverlayVisible = false;
  els.shortcutOverlay.classList.add("hidden");
  els.shortcutOverlay.style.display = "none";
}
