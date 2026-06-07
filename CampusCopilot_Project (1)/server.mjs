import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createTransport } from "nodemailer";
import {
  approveUser,
  authenticate,
  createRegistration,
  createSession,
  deleteSession,
  getDashboardState,
  getSession,
  recordLogin,
  rejectUser,
  upsertAttendance,
  admissionRecord,
  isEmailTaken,
  addAdmissionRecord,
  listAdmissions,
  getUserByEmail,
  updatePassword,
  addSubject,
  upsertClassAttendance,
  addOrUpdateMark,
  createAssignment,
  updateSubmissionStatus,
  getAssignmentStudents,
  getAllSubjects,
  getAllTeachers,
  assignSubjectToTeacher,
  addSubjectForAdmin,
  addTeacherByAdmin,
} from "./database.mjs";

import { createRequire } from "node:module";

const port = Number(process.env.PORT || 4173);

import { defaultState } from "./src/data.js";
let noticesStore   = structuredClone(defaultState.notices);
let tasksStore     = structuredClone(defaultState.tasks);
let eventsStore    = structuredClone(defaultState.events);
let questionsStore = structuredClone(defaultState.questions);
let complaintsStore= structuredClone(defaultState.complaints);
let lostFoundStore = structuredClone(defaultState.lostFound);
let usersStore     = structuredClone(defaultState.users);
const root = process.cwd();

const SMTP_USER = process.env.SMTP_USER || "YOUR_GMAIL@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "YOUR_APP_PASSWORD";

const mailer = createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

async function sendOTPEmail(toEmail, otp, name) {
  // ✅ FIX: ALWAYS print OTP to terminal
  console.log("\n" + "═".repeat(50));
  console.log(`📧  OTP EMAIL`);
  console.log(`    To   : ${toEmail}`);
  console.log(`    Name : ${name}`);
  console.log(`    OTP  : ${otp}`);
  console.log(`    Valid: 10 minutes`);
  console.log("═".repeat(50) + "\n");

  const isConfigured = SMTP_USER !== "YOUR_GMAIL@gmail.com" && SMTP_PASS !== "YOUR_APP_PASSWORD";

  if (!isConfigured) {
    return { dev: true };
  }

  await mailer.sendMail({
    from: `"CampusCopilot" <${SMTP_USER}>`,
    to: toEmail,
    subject: "Your CampusCopilot Registration OTP",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="margin:0 0 8px">👋 Hi ${name},</h2>
        <p style="color:#6b7280;margin:0 0 24px">Welcome to <strong>CampusCopilot</strong>! Use the OTP below to verify your email and complete registration.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:2.5rem;font-weight:700;letter-spacing:0.4em;color:#1e1b4b">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:0.875rem;margin:0">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:0.75rem;margin:0">If you did not request this, ignore this email.</p>
      </div>
    `,
  });
  return { dev: false };
}

const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const types = {
  ".css":  "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
};

const json = (res, status, payload) => {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
};

const bearerToken = (req) => {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
};

createServer(async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "https://campuscopilott.netlify.app");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const pathname = decodeURIComponent(
      new URL(req.url, `http://${req.headers.host}`).pathname
    );

    if (pathname.startsWith("/api/")) {

      if (req.method === "POST" && pathname === "/api/register/request-otp") {
        const body = await readBody(req);
        const { role, name, email, phone, admission_number, password } = body;

        if (!role || !name || !email || !password) {
          json(res, 400, { error: "All fields are required (name, email, password, role)." });
          return;
        }

        if (role === "student") {
          if (!admission_number || !admission_number.trim()) {
            json(res, 400, { error: "Admission number is required for students." });
            return;
          }
          const record = admissionRecord(admission_number);
          if (!record) {
            json(res, 400, {
              error: `Admission number "${admission_number.toUpperCase()}" was not found in the college database. Ask your admin to add it first (see /api/admin/add-admission).`,
            });
            return;
          }
        }

        if (isEmailTaken(email)) {
          json(res, 400, { error: "An account with this email already exists." });
          return;
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + OTP_EXPIRY_MS;

        otpStore.set(email.toLowerCase().trim(), {
          otp,
          expiresAt,
          registrationData: { role, name, email, phone, admission_number, password },
        });

        const emailResult = await sendOTPEmail(email, otp, name);

        json(res, 200, {
          message: emailResult.dev
            ? `OTP generated (dev mode). Check your server terminal — Gmail not configured yet.`
            : `OTP sent to ${email}. Check your inbox (also check spam folder).`,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/register/verify-otp") {
        const { email, otp } = await readBody(req);

        if (!email || !otp) {
          json(res, 400, { error: "Email and OTP are required." });
          return;
        }

        const entry = otpStore.get(email.toLowerCase().trim());

        if (!entry) {
          json(res, 400, { error: "No OTP request found for this email. Please request a new OTP." });
          return;
        }
        if (Date.now() > entry.expiresAt) {
          otpStore.delete(email.toLowerCase().trim());
          json(res, 400, { error: "OTP has expired. Please request a new one." });
          return;
        }
        if (entry.otp !== String(otp).trim()) {
          json(res, 400, { error: "Incorrect OTP. Please try again." });
          return;
        }

        try {
          const newUser = createRegistration(entry.registrationData);
          otpStore.delete(email.toLowerCase().trim());

          if (newUser.isKnownUser) {
            json(res, 201, {
              message: `Email verified! Your account is ready. Your Login ID is ${newUser.loginId}. You can log in now.`,
              loginId: newUser.loginId,
              autoApproved: true,
            });
          } else {
            json(res, 201, {
              message: "Email verified! Your account request has been submitted. Wait for Admin approval — you'll receive your Login ID once approved.",
              autoApproved: false,
            });
          }
        } catch (err) {
          json(res, 400, { error: err.message });
        }
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/forgot-password") {
        const { email } = await readBody(req);
        if (!email) {
          json(res, 400, { error: "Email is required." });
          return;
        }
        const user = getUserByEmail(email);
        if (!user || user.status !== "Approved") {
          json(res, 200, { message: "If this email is registered and approved, an OTP has been sent." });
          return;
        }
        const otp = generateOTP();
        otpStore.set(`reset:${email.toLowerCase().trim()}`, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS });
        const emailResult = await sendOTPEmail(email, otp, user.name);
        json(res, 200, {
          message: emailResult.dev
            ? "OTP generated (dev mode). Check your server terminal."
            : `OTP sent to ${email}. Check your inbox.`,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/reset-password") {
        const { email, otp, newPassword } = await readBody(req);
        if (!email || !otp || !newPassword) {
          json(res, 400, { error: "Email, OTP, and new password are required." });
          return;
        }
        if (newPassword.length < 6) {
          json(res, 400, { error: "Password must be at least 6 characters." });
          return;
        }
        const key = `reset:${email.toLowerCase().trim()}`;
        const entry = otpStore.get(key);
        if (!entry) {
          json(res, 400, { error: "No OTP request found. Please request a new OTP." });
          return;
        }
        if (Date.now() > entry.expiresAt) {
          otpStore.delete(key);
          json(res, 400, { error: "OTP has expired. Please request a new one." });
          return;
        }
        if (entry.otp !== String(otp).trim()) {
          json(res, 400, { error: "Incorrect OTP. Please try again." });
          return;
        }
        try {
          updatePassword(email, newPassword);
          otpStore.delete(key);
          json(res, 200, { message: "Password reset successful. You can now log in with your new password." });
        } catch (err) {
          json(res, 400, { error: err.message });
        }
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/login") {
        const { role, login_id, password } = await readBody(req);

        if (!role || !login_id || !password) {
          json(res, 400, { error: "Role, Login ID, and password are required." });
          return;
        }

        let user;
        try {
          user = authenticate(role, login_id, password);
        } catch (err) {
          json(res, 429, { error: err.message });
          return;
        }

        if (!user) {
          json(res, 401, { error: "Invalid credentials or account not approved yet." });
          return;
        }

        const token = createSession(user.id);
        recordLogin(user.id, user.role, "Success", "Login successful");
        json(res, 200, { token, user });
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/logout") {
        deleteSession(bearerToken(req));
        json(res, 200, { message: "Signed out." });
        return;
      }

      if (req.method === "GET" && pathname === "/api/state") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        const dbState = getDashboardState(session);
        json(res, 200, {
          ...dbState,
          notices:    noticesStore,
          tasks:      tasksStore,
          events:     eventsStore,
          questions:  questionsStore,
          complaints: complaintsStore,
          lostFound:  lostFoundStore,
          users:      usersStore,
          activity:   defaultState.activity,
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/attendance") {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") {
          json(res, 403, { error: "Forbidden" }); return;
        }
        const body = await readBody(req);
        upsertAttendance({ ...body, markedBy: session.id });
        json(res, 200, { message: "Attendance updated." });
        return;
      }

      if (req.method === "POST" && pathname === "/api/admin/add-admission") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") {
          json(res, 403, { error: "Only admins can add admission records." }); return;
        }
        const { admission_number, name, email } = await readBody(req);
        if (!admission_number || !name || !email) {
          json(res, 400, { error: "admission_number, name, and email are required." }); return;
        }
        try {
          const record = addAdmissionRecord({ admission_number, name, email });
          json(res, 201, { message: `Admission record added for ${name} (${admission_number.toUpperCase()}).`, record });
        } catch (err) {
          json(res, 400, { error: err.message });
        }
        return;
      }

      if (req.method === "GET" && pathname === "/api/admin/admissions") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") {
          json(res, 403, { error: "Only admins can view admission records." }); return;
        }
        const records = listAdmissions();
        json(res, 200, { records });
        return;
      }

      if (req.method === "POST" && pathname.startsWith("/api/moderation/approve/")) {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") {
          json(res, 403, { error: "Forbidden" }); return;
        }
        const userId = Number(pathname.split("/").pop());
        const result = approveUser(userId, session.name, session.role);
        if (!result) { json(res, 400, { error: "Could not approve user." }); return; }
        json(res, 200, { message: "User approved.", user: result });
        return;
      }

      if (req.method === "POST" && pathname.startsWith("/api/moderation/reject/")) {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") {
          json(res, 403, { error: "Forbidden" }); return;
        }
        const userId = Number(pathname.split("/").pop());
        const result = rejectUser(userId, session.name, session.role);
        if (!result) { json(res, 400, { error: "Could not reject user." }); return; }
        json(res, 200, { message: "User rejected.", user: result });
        return;
      }

      if (req.method === "GET" && pathname === "/api/subjects") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        json(res, 200, { subjects: getAllSubjects() });
        return;
      }

      if (req.method === "POST" && pathname === "/api/subjects") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "teacher") { json(res, 403, { error: "Only teachers can create subjects." }); return; }
        const { name, code } = await readBody(req);
        if (!name || !code) { json(res, 400, { error: "name and code are required." }); return; }
        try {
          const subject = addSubject({ name, code, teacherId: session.id });
          json(res, 201, { message: `Subject "${name}" created.`, subject });
        } catch (err) {
          json(res, 400, { error: err.message });
        }
        return;
      }

      if (req.method === "POST" && pathname === "/api/class-attendance") {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") { json(res, 403, { error: "Forbidden" }); return; }
        const body = await readBody(req);
        const records = Array.isArray(body) ? body : [body];
        for (const rec of records) {
          upsertClassAttendance({ ...rec, markedBy: session.id });
        }
        json(res, 200, { message: "Class attendance updated." });
        return;
      }

      if (req.method === "POST" && pathname === "/api/marks") {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") { json(res, 403, { error: "Forbidden" }); return; }
        const body = await readBody(req);
        const records = Array.isArray(body) ? body : [body];
        for (const rec of records) {
          addOrUpdateMark({ ...rec, recordedBy: session.id });
        }
        json(res, 200, { message: "Marks saved." });
        return;
      }

      if (req.method === "POST" && pathname === "/api/assignments") {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") { json(res, 403, { error: "Forbidden" }); return; }
        const body = await readBody(req);
        if (!body.subjectId || !body.title || !body.dueDate) {
          json(res, 400, { error: "subjectId, title, dueDate are required." }); return;
        }
        createAssignment({ ...body, createdBy: session.id });
        json(res, 201, { message: "Assignment created." });
        return;
      }

      if (req.method === "POST" && pathname.match(/^\/api\/assignments\/\d+\/submission$/)) {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") { json(res, 403, { error: "Forbidden" }); return; }
        const assignmentId = Number(pathname.split("/")[3]);
        const body = await readBody(req);
        updateSubmissionStatus({ assignmentId, ...body });
        json(res, 200, { message: "Submission updated." });
        return;
      }

      if (req.method === "GET" && pathname.match(/^\/api\/assignments\/\d+\/students$/)) {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") { json(res, 403, { error: "Forbidden" }); return; }
        const assignmentId = Number(pathname.split("/")[3]);
        json(res, 200, { students: getAssignmentStudents(assignmentId) });
        return;
      }

      if (req.method === "GET" && pathname === "/api/admin/teachers") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Forbidden" }); return; }
        json(res, 200, { teachers: getAllTeachers() }); return;
      }

      if (req.method === "GET" && pathname === "/api/admin/subjects") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Forbidden" }); return; }
        json(res, 200, { subjects: getAllSubjects() }); return;
      }

      if (req.method === "POST" && pathname === "/api/admin/subjects") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Forbidden" }); return; }
        const { name, code, teacherId } = await readBody(req);
        if (!name || !code) { json(res, 400, { error: "name and code are required." }); return; }
        try {
          const subject = addSubjectForAdmin({ name, code, teacherId });
          json(res, 201, { subject }); return;
        } catch (err) {
          json(res, 400, { error: err.message }); return;
        }
      }

      if (req.method === "PATCH" && pathname.match(/^\/api\/admin\/subjects\/.+\/assign$/)) {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Forbidden" }); return; }
        const subjectId = parseInt(pathname.split("/api/admin/subjects/")[1].replace("/assign", ""), 10);
        const body = await readBody(req);
        const teacherId = parseInt(body.teacherId, 10);
        if (isNaN(subjectId) || isNaN(teacherId)) { json(res, 400, { error: "Invalid subjectId or teacherId." }); return; }
        try {
          const subject = assignSubjectToTeacher(subjectId, teacherId);
          json(res, 200, { subject }); return;
        } catch (err) {
          json(res, 400, { error: err.message }); return;
        }
      }

      if (req.method === "POST" && pathname === "/api/admin/add-teacher") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Only admins can add teachers." }); return; }
        const { name, email, password } = await readBody(req);
        try {
          const teacher = addTeacherByAdmin({ name, email, password });
          json(res, 201, { message: `Teacher "${teacher.name}" created.`, loginId: teacher.loginId, teacher });
        } catch (err) {
          json(res, 400, { error: err.message });
        }
        return;
      }

      if (req.method === "GET" && pathname === "/api/admin/real-users") {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Forbidden" }); return; }
        const { users } = getDashboardState(session);
        json(res, 200, { users }); return;
      }

      if (req.method === "POST" && pathname === "/api/ai/ask") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        const { question, context } = await readBody(req);
        if (!question) { json(res, 400, { error: "question is required." }); return; }

        const geminiKeys = [
          process.env.GEMINI_API_KEY,
          process.env.GEMINI_API_KEY2,
          process.env.GEMINI_API_KEY3,
        ].filter(Boolean);

        if (!geminiKeys.length) {
          json(res, 500, { error: "No GEMINI_API_KEY set on server." }); return;
        }

        const models = [
          "gemini-2.5-flash",
          "gemini-3-flash-preview",
          "gemini-2.0-flash",
          "gemini-2.0-flash-001",
          "gemini-2.5-flash-lite",
        ];

        const systemPrompt = context?.systemPrompt || "You are CampusCopilot, a helpful campus AI assistant.";
        let lastErr = "All Gemini keys/models quota exceeded.";
        let success = false;

        outer: for (const key of geminiKeys) {
          for (const model of models) {
            try {
              const aiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: "user", parts: [{ text: question }] }],
                    generationConfig: { maxOutputTokens: 1000 },
                  }),
                }
              );
              const aiData = await aiRes.json();
              if (!aiRes.ok) {
                lastErr = aiData.error?.message || "Gemini API error.";
                console.log(`Skipping ${model}: ${lastErr.slice(0,60)}`);
                continue;
              }
              const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
              console.log(`Gemini OK: model=${model}`);
              json(res, 200, { text });
              success = true;
              break outer;
            } catch (err) {
              lastErr = err.message;
              continue;
            }
          }
        }

        if (!success) {
          console.error("All Gemini attempts failed:", lastErr);
          json(res, 502, { error: lastErr });
        }
        return;
      }

      if (pathname === "/api/notices") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        if (req.method === "POST") {
          const body = await readBody(req);
          noticesStore.push(body);
          json(res, 201, { notice: body }); return;
        }
        json(res, 200, { notices: noticesStore }); return;
      }

      if (pathname === "/api/tasks") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        if (req.method === "POST") {
          const body = await readBody(req);
          tasksStore.push(body);
          json(res, 201, { task: body }); return;
        }
        json(res, 200, { tasks: tasksStore }); return;
      }

      if (req.method === "PATCH" && pathname.startsWith("/api/tasks/")) {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        const taskId = decodeURIComponent(pathname.split("/api/tasks/")[1]);
        const body = await readBody(req);
        const idx = tasksStore.findIndex(t => t.id === taskId);
        if (idx === -1) { json(res, 404, { error: "Task not found." }); return; }
        tasksStore[idx] = { ...tasksStore[idx], ...body };
        json(res, 200, { task: tasksStore[idx] }); return;
      }

      if (req.method === "PATCH" && pathname.match(/^\/api\/events\/.+\/registration$/)) {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        const eventId = decodeURIComponent(pathname.split("/api/events/")[1].replace("/registration", ""));
        const body = await readBody(req);
        const idx = eventsStore.findIndex(e => e.id === eventId);
        if (idx === -1) { json(res, 404, { error: "Event not found." }); return; }
        eventsStore[idx] = { ...eventsStore[idx], registered: body.registered };
        json(res, 200, { event: eventsStore[idx] }); return;
      }

      if (pathname === "/api/complaints") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        if (req.method === "POST") {
          const body = await readBody(req);
          body.submittedBy = body.submittedBy || session.name;
          complaintsStore.push(body);
          json(res, 201, { complaint: body }); return;
        }
        json(res, 200, { complaints: complaintsStore }); return;
      }

      if (req.method === "PATCH" && pathname.match(/^\/api\/complaints\/.+\/resolve$/)) {
        const session = getSession(bearerToken(req));
        if (!session || session.role === "student") { json(res, 403, { error: "Forbidden" }); return; }
        const id = decodeURIComponent(pathname.split("/api/complaints/")[1].replace("/resolve", ""));
        const idx = complaintsStore.findIndex(c => c.id === id);
        if (idx === -1) { json(res, 404, { error: "Complaint not found." }); return; }
        complaintsStore[idx].status = "Resolved";
        json(res, 200, { complaint: complaintsStore[idx] }); return;
      }

      if (pathname === "/api/lost-found") {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        if (req.method === "POST") {
          const body = await readBody(req);
          lostFoundStore.push(body);
          json(res, 201, { item: body }); return;
        }
        json(res, 200, { items: lostFoundStore }); return;
      }

      if (req.method === "PATCH" && pathname.match(/^\/api\/lost-found\/.+\/close$/)) {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        const id = decodeURIComponent(pathname.split("/api/lost-found/")[1].replace("/close", ""));
        const idx = lostFoundStore.findIndex(i => i.id === id);
        if (idx === -1) { json(res, 404, { error: "Item not found." }); return; }
        lostFoundStore[idx].status = "Closed";
        json(res, 200, { item: lostFoundStore[idx] }); return;
      }

      if (req.method === "PATCH" && pathname.match(/^\/api\/questions\/.+\/answer$/)) {
        const session = getSession(bearerToken(req));
        if (!session) { json(res, 401, { error: "Unauthorized" }); return; }
        const id = decodeURIComponent(pathname.split("/api/questions/")[1].replace("/answer", ""));
        const body = await readBody(req);
        const idx = questionsStore.findIndex(q => q.id === id);
        if (idx === -1) { json(res, 404, { error: "Question not found." }); return; }
        questionsStore[idx].answer = body.answer;
        questionsStore[idx].status = "Answered";
        json(res, 200, { question: questionsStore[idx] }); return;
      }

      if (req.method === "PATCH" && pathname.match(/^\/api\/users\/.+\/status$/)) {
        const session = getSession(bearerToken(req));
        if (!session || session.role !== "admin") { json(res, 403, { error: "Forbidden" }); return; }
        const id = decodeURIComponent(pathname.split("/api/users/")[1].replace("/status", ""));
        const body = await readBody(req);
        const idx = usersStore.findIndex(u => u.id === id);
        if (idx !== -1) usersStore[idx].status = body.status;
        json(res, 200, { message: "User status updated." }); return;
      }

      json(res, 404, { error: "API route not found." });
      return;
    }

    const requested = pathname === "/" ? "/index.html" : pathname;
    const filepath = normalize(join(root, requested));
    if (!filepath.startsWith(root) || !existsSync(filepath)) {
      res.writeHead(404); res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[extname(filepath)] || "application/octet-stream" });
    createReadStream(filepath).pipe(res);

  } catch (error) {
    console.error("Server error:", error);
    json(res, 500, { error: "Internal server error." });
  }
}).listen(port, () => {
  console.log(`✅ CampusCopilot running → http://localhost:${port}`);
  console.log(`   Demo credentials:`);
  console.log(`   Admin:   login_id=ADM001  password=admin123`);
  console.log(`   Teacher: login_id=TCH001  password=teacher123`);
  console.log(`   Student: login_id=STU001  password=student123`);
});