import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import {
  authenticate,
  createActivity,
  createSession,
  databasePath,
  deleteSession,
  getRecord,
  getSession,
  getState,
  insertRecord,
  updateRecord,
} from "./database.mjs";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const json = (response, status, payload) => {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const bearerToken = (request) => {
  const value = request.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
};

const requireSession = (request, response, roles = []) => {
  const session = getSession(bearerToken(request));
  if (!session) {
    json(response, 401, { error: "Your session has expired. Please sign in again." });
    return null;
  }
  if (roles.length && !roles.includes(session.role)) {
    json(response, 403, { error: "Your role does not have permission for this action." });
    return null;
  }
  return session;
};

const routeId = (pathname, prefix) => decodeURIComponent(pathname.slice(prefix.length));

const stateForSession = (session) => {
  const state = getState();
  if (session.role === "student") {
    state.questions = [];
    state.users = [];
    state.activity = [];
    state.complaints = state.complaints.filter((item) => item.submittedBy === session.name);
  }
  if (session.role === "faculty") {
    state.tasks = [];
    state.complaints = [];
    state.lostFound = [];
    state.users = [];
  }
  return state;
};

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    json(response, 200, { ok: true, database: "sqlite" });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const { role, email, password } = await readBody(request);
    const user = authenticate(role, email, password);
    if (!user) {
      json(response, 401, { error: "Invalid email, password, or role." });
      return true;
    }
    const token = createSession(user.id);
    json(response, 200, { token, user });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    deleteSession(bearerToken(request));
    json(response, 200, { ok: true });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/state") {
    const session = requireSession(request, response);
    if (!session) return true;
    json(response, 200, stateForSession(session));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/notices") {
    const session = requireSession(request, response, ["faculty", "admin"]);
    if (!session) return true;
    const notice = await readBody(request);
    notice.createdBy = session.name;
    insertRecord("notices", notice);
    createActivity("New verified notice published", notice.title, "blue");
    json(response, 201, notice);
    return true;
  }

  if (request.method === "POST" && pathname === "/api/tasks") {
    if (!requireSession(request, response, ["student"])) return true;
    const task = await readBody(request);
    insertRecord("tasks", task);
    json(response, 201, task);
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/tasks/")) {
    if (!requireSession(request, response, ["student"])) return true;
    const updated = updateRecord("tasks", routeId(pathname, "/api/tasks/"), await readBody(request));
    json(response, updated ? 200 : 404, updated || { error: "Task not found." });
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/events/") && pathname.endsWith("/registration")) {
    if (!requireSession(request, response, ["student"])) return true;
    const id = pathname.slice("/api/events/".length, -"/registration".length);
    const current = getRecord("events", id);
    if (!current) {
      json(response, 404, { error: "Event not found." });
      return true;
    }
    const { registered } = await readBody(request);
    const seats = registered && !current.registered
      ? Math.max(0, current.seats - 1)
      : !registered && current.registered
        ? current.seats + 1
        : current.seats;
    json(response, 200, updateRecord("events", id, { registered: Boolean(registered), seats }));
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/questions/") && pathname.endsWith("/answer")) {
    if (!requireSession(request, response, ["faculty"])) return true;
    const id = pathname.slice("/api/questions/".length, -"/answer".length);
    const { answer } = await readBody(request);
    const updated = updateRecord("questions", id, { answer, status: "Answered" });
    if (updated) createActivity("Student question answered", updated.question, "green");
    json(response, updated ? 200 : 404, updated || { error: "Question not found." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/complaints") {
    const session = requireSession(request, response, ["student"]);
    if (!session) return true;
    const complaint = { ...(await readBody(request)), submittedBy: session.name };
    insertRecord("complaints", complaint);
    json(response, 201, complaint);
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/complaints/") && pathname.endsWith("/resolve")) {
    if (!requireSession(request, response, ["admin"])) return true;
    const id = pathname.slice("/api/complaints/".length, -"/resolve".length);
    const updated = updateRecord("complaints", id, { status: "Resolved" });
    json(response, updated ? 200 : 404, updated || { error: "Request not found." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/lost-found") {
    const session = requireSession(request, response, ["student"]);
    if (!session) return true;
    const item = { ...(await readBody(request)), contact: session.name };
    insertRecord("lostFound", item);
    json(response, 201, item);
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/lost-found/") && pathname.endsWith("/close")) {
    if (!requireSession(request, response, ["admin"])) return true;
    const id = pathname.slice("/api/lost-found/".length, -"/close".length);
    const updated = updateRecord("lostFound", id, { status: "Closed" });
    json(response, updated ? 200 : 404, updated || { error: "Post not found." });
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/users/") && pathname.endsWith("/status")) {
    if (!requireSession(request, response, ["admin"])) return true;
    const id = pathname.slice("/api/users/".length, -"/status".length);
    const { status } = await readBody(request);
    const updated = updateRecord("users", id, { status });
    json(response, updated ? 200 : 404, updated || { error: "User not found." });
    return true;
  }

  json(response, 404, { error: "API endpoint not found." });
  return true;
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, pathname);
      return;
    }

    const requested = pathname === "/" ? "/index.html" : pathname;
    if (requested !== "/index.html" && !requested.startsWith("/src/")) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const filepath = normalize(join(root, requested));

    if (!filepath.startsWith(root) || !existsSync(filepath) || statSync(filepath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": types[extname(filepath)] || "application/octet-stream",
    });
    createReadStream(filepath).pipe(response);
  } catch (error) {
    console.error(error);
    json(response, 500, { error: "The server could not complete this request." });
  }
}).listen(port, () => {
  console.log(`CampusCopilot is running at http://localhost:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});
