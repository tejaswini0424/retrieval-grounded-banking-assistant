const byId = (id) => document.getElementById(id);
const auth = byId("auth");
const messages = byId("messages");
const sources = new Map();
let user = null;
let mode = "login";
let busy = false;

async function api(path, payload) {
  const options = payload === undefined ? {} : {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  };
  const response = await fetch("/api/" + path, options);
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path.startsWith("chat")) setUser(null);
    throw new Error(data.error);
  }
  return data;
}

function status(message = "") {
  byId("status").textContent = message;
  byId("status").hidden = !message;
}

function renderTurn(turn) {
  const question = document.createElement("div");
  question.className = "turn question";
  question.textContent = turn.question;
  const answer = document.createElement("div");
  answer.className = "turn";
  answer.textContent = turn.answer;
  const source = sources.get(turn.source);
  if (source) {
    const link = document.createElement("a");
    link.href = "#" + source.id;
    link.textContent = "Source · " + source.title;
    link.addEventListener("click", () => { byId(source.id).open = true; });
    answer.append(link);
  }
  messages.append(question, answer);
  messages.scrollTop = messages.scrollHeight;
}

function setUser(profile) {
  user = profile;
  byId("profile").textContent = user?.name ?? "";
  for (const id of ["profile", "logout", "clear", "chat-form"]) byId(id).hidden = !user;
  for (const id of ["login", "register", "guest"]) byId(id).hidden = Boolean(user);
  messages.replaceChildren();
  byId("question").value = "";
  if (user) messages.textContent = "Ask a banking question or choose a topic below.";
}

async function loadHistory() {
  const profile = user;
  const turns = await api("chat");
  if (profile !== user || !turns.length) return;
  messages.replaceChildren();
  turns.forEach(renderTurn);
}

function openAuth(nextMode) {
  mode = nextMode;
  byId("auth-form").reset();
  const creating = mode === "register";
  byId("name-field").hidden = !creating;
  byId("name").required = creating;
  byId("password").autocomplete = creating ? "new-password" : "current-password";
  byId("auth-error").hidden = true;
  byId("auth-title").textContent = byId("auth-submit").textContent = creating ? "Create account" : "Log in";
  auth.showModal();
}

byId("login").onclick = () => openAuth("login");
byId("register").onclick = () => openAuth("register");
byId("close").onclick = () => { if (!busy) auth.close(); };
auth.addEventListener("cancel", (event) => { if (busy) event.preventDefault(); });

async function action(button, work, report = status) {
  if (busy) return;
  busy = true;
  button.disabled = true;
  report("");
  try {
    await work();
  } catch (error) {
    report(error.message);
  } finally {
    button.disabled = false;
    busy = false;
  }
}

byId("auth-form").onsubmit = (event) => {
  event.preventDefault();
  action(byId("auth-submit"), async () => {
    const {user: profile} = await api(mode, {
      name: byId("name").value,
      email: byId("email").value,
      password: byId("password").value,
    });
    byId("auth-form").reset();
    auth.close();
    status();
    setUser(profile);
    await loadHistory().catch((error) => status(error.message));
    byId("question").focus();
  }, (message) => {
    byId("auth-error").textContent = message;
    byId("auth-error").hidden = !message;
  });
};

byId("logout").onclick = () => action(byId("logout"), async () => {
  await api("logout", {});
  setUser(null);
  byId("login").focus();
});

byId("clear").onclick = () => {
  if (!busy && confirm("Delete your saved conversation?")) action(byId("clear"), async () => {
    await api("chat/clear", {});
    setUser(user);
  });
};

byId("chat-form").onsubmit = (event) => {
  event.preventDefault();
  const input = byId("question");
  action(event.submitter, async () => {
    const turn = await api("chat", {question: input.value.trim()});
    if (!messages.querySelector(".turn")) messages.replaceChildren();
    renderTurn(turn);
    if (input.value.trim() === turn.question) input.value = "";
    input.focus();
  });
};

document.querySelectorAll("[data-question]").forEach((button) => {
  button.onclick = () => {
    if (!user) return openAuth("login");
    byId("question").value = button.dataset.question;
    byId("question").focus();
  };
});

async function start() {
  const library = await api("sources");
  for (const source of library) {
    sources.set(source.id, source);
    const details = document.createElement("details");
    details.id = source.id;
    const title = document.createElement("summary");
    title.textContent = source.title;
    const text = document.createElement("p");
    text.textContent = source.answer;
    details.append(title, text);
    byId("sources").append(details);
  }
  const {user: profile} = await api("session");
  setUser(profile);
  if (user) await loadHistory();
}

start().catch((error) => status(error.message));
