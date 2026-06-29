import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

async function exec(sql) {
  await db.executeMultiple(sql);
}

await exec(`
  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_id TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL DEFAULT '',
    admission_number TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TEXT,
    approved_by TEXT
  );

  CREATE TABLE IF NOT EXISTS college_admissions (
    admission_number TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Valid'
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    class_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    marked_by INTEGER REFERENCES auth_users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_user_id, class_date)
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    teacher_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS class_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    marked_by INTEGER REFERENCES auth_users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_user_id, subject_id, class_date)
  );

  CREATE TABLE IF NOT EXISTS test_marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    marks_obtained REAL NOT NULL DEFAULT 0,
    marks_total REAL NOT NULL DEFAULT 100,
    recorded_by INTEGER REFERENCES auth_users(id),
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    max_marks REAL NOT NULL DEFAULT 10,
    due_date TEXT NOT NULL,
    created_by INTEGER REFERENCES auth_users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Late')),
    marks_obtained REAL,
    submitted_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, student_user_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    login_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    identifier TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  -- ── NEW TABLES ──────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'student', 'teacher')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_by INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assigned_to INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Done', 'Cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL DEFAULT '00:00',
    target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'student', 'teacher')),
    created_by INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Academic', 'Infrastructure', 'Conduct', 'Other')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Review', 'Resolved', 'Dismissed')),
    filed_by INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    resolved_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    resolution_note TEXT NOT NULL DEFAULT '',
    filed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS lost_found (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('Lost', 'Found')),
    item_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Claimed', 'Closed')),
    reported_by INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT
  );

  -- ── INDEXES ─────────────────────────────────────────────────

  CREATE INDEX IF NOT EXISTS idx_class_attendance_student ON class_attendance(student_user_id, subject_id, class_date);
  CREATE INDEX IF NOT EXISTS idx_test_marks_student ON test_marks(student_user_id, subject_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
  CREATE INDEX IF NOT EXISTS idx_auth_users_role_status ON auth_users(role, status);
  CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_user_id, class_date);
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_notices_target ON notices(target_role, created_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to, status);
  CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date, target_role);
  CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status, filed_by);
  CREATE INDEX IF NOT EXISTS idx_lost_found_status ON lost_found(status, type);
`);

const hashPassword = (password, salt = randomBytes(16).toString("hex")) => {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, expected] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
};

const userSelect = `
  id, login_id AS loginId, role, name, email, phone,
  admission_number AS admissionNumber, status, requested_at AS requestedAt,
  approved_at AS approvedAt, approved_by AS approvedBy
`;

const publicUser = (row) => ({
  id: row.id,
  loginId: row.loginId,
  role: row.role,
  name: row.name,
  email: row.email,
  phone: row.phone,
  admissionNumber: row.admissionNumber,
  status: row.status,
  requestedAt: row.requestedAt,
  approvedAt: row.approvedAt,
  approvedBy: row.approvedBy,
});

const first = (rs) => rs.rows[0] || null;
const all = (rs) => rs.rows;

async function seed() {
  const admissions = [
    ["ADM2026001", "Aarav Mehta", "student@campus.edu"],
    ["ADM2026002", "Ishita Rao", "ishita@campus.edu"],
    ["ADM2026003", "Kabir Singh", "kabir@campus.edu"],
    ["ADM2026004", "Riya Jain", "riya@campus.edu"],
  ];
  for (const [an, n, e] of admissions) {
    await db.execute({ sql: `INSERT OR IGNORE INTO college_admissions (admission_number, name, email) VALUES (?, ?, ?)`, args: [an, n, e] });
  }

  await db.execute({ sql: `INSERT OR IGNORE INTO auth_users (login_id, role, name, email, phone, admission_number, password_hash, status, approved_at, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', CURRENT_TIMESTAMP, 'System seed')`, args: ["ADM001", "admin", "Rohan Kapoor", "admin@campus.edu", "9000000001", null, hashPassword("admin123")] });
  await db.execute({ sql: `INSERT OR IGNORE INTO auth_users (login_id, role, name, email, phone, admission_number, password_hash, status, approved_at, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', CURRENT_TIMESTAMP, 'System seed')`, args: ["TCH001", "teacher", "Dr. Neha Sharma", "teacher@campus.edu", "9000000002", null, hashPassword("teacher123")] });
  await db.execute({ sql: `INSERT OR IGNORE INTO auth_users (login_id, role, name, email, phone, admission_number, password_hash, status, approved_at, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', CURRENT_TIMESTAMP, 'System seed')`, args: ["STU001", "student", "Aarav Mehta", "student@campus.edu", "9000000003", "ADM2026001", hashPassword("student123")] });

  const studentRow = first(await db.execute({ sql: `SELECT id FROM auth_users WHERE login_id = 'STU001'`, args: [] }));
  const teacherRow = first(await db.execute({ sql: `SELECT id FROM auth_users WHERE login_id = 'TCH001'`, args: [] }));
  const adminRow = first(await db.execute({ sql: `SELECT id FROM auth_users WHERE login_id = 'ADM001'`, args: [] }));

  if (studentRow && teacherRow && adminRow) {
    const sid = studentRow.id;
    const tid = teacherRow.id;
    const aid = adminRow.id;

    for (const [date, status] of [["2026-06-01","Present"],["2026-06-02","Late"],["2026-06-03","Present"]]) {
      await db.execute({ sql: `INSERT OR IGNORE INTO attendance (student_user_id, class_date, status, marked_by) VALUES (?, ?, ?, ?)`, args: [sid, date, status, tid] });
    }

    for (const [name, code] of [["Database Systems","CS301"],["AI Foundations","CS401"],["Web Development","CS201"]]) {
      await db.execute({ sql: `INSERT OR IGNORE INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`, args: [name, code, tid] });
    }

    const subjectsRs = all(await db.execute({ sql: `SELECT id, code FROM subjects`, args: [] }));
    const sm = {};
    subjectsRs.forEach(s => { sm[s.code] = s.id; });

    const caRows = [
      [sid, sm["CS301"], "2026-06-01", "Present", tid],
      [sid, sm["CS301"], "2026-06-02", "Absent", tid],
      [sid, sm["CS301"], "2026-06-03", "Present", tid],
      [sid, sm["CS301"], "2026-06-04", "Present", tid],
      [sid, sm["CS401"], "2026-06-01", "Present", tid],
      [sid, sm["CS401"], "2026-06-02", "Present", tid],
      [sid, sm["CS401"], "2026-06-03", "Late", tid],
      [sid, sm["CS401"], "2026-06-04", "Present", tid],
      [sid, sm["CS201"], "2026-06-01", "Present", tid],
      [sid, sm["CS201"], "2026-06-02", "Present", tid],
      [sid, sm["CS201"], "2026-06-03", "Present", tid],
      [sid, sm["CS201"], "2026-06-04", "Absent", tid],
    ];
    for (const [a,b,c,d,e] of caRows) {
      await db.execute({ sql: `INSERT OR IGNORE INTO class_attendance (student_user_id, subject_id, class_date, status, marked_by) VALUES (?, ?, ?, ?, ?)`, args: [a,b,c,d,e] });
    }

    const mkRows = [
      [sid, sm["CS301"], "Unit Test 1", 34, 40, tid],
      [sid, sm["CS301"], "Mid Semester", 68, 80, tid],
      [sid, sm["CS401"], "Unit Test 1", 38, 40, tid],
      [sid, sm["CS201"], "Unit Test 1", 30, 40, tid],
    ];
    for (const [a,b,c,d,e,f] of mkRows) {
      await db.execute({ sql: `INSERT OR IGNORE INTO test_marks (student_user_id, subject_id, test_name, marks_obtained, marks_total, recorded_by) VALUES (?, ?, ?, ?, ?, ?)`, args: [a,b,c,d,e,f] });
    }

    const agRows = [
      [sm["CS301"], "ER Diagram Assignment", "Draw ER diagram for library system", 10, "2026-06-10", tid],
      [sm["CS401"], "Neural Network Report", "Write a 2-page report on CNNs", 10, "2026-06-12", tid],
      [sm["CS201"], "Portfolio Website", "Create a personal portfolio using HTML/CSS", 15, "2026-06-15", tid],
    ];
    for (const [a,b,c,d,e,f] of agRows) {
      await db.execute({ sql: `INSERT OR IGNORE INTO assignments (subject_id, title, description, max_marks, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`, args: [a,b,c,d,e,f] });
    }

    const al = all(await db.execute({ sql: `SELECT id FROM assignments ORDER BY id`, args: [] }));
    if (al[0]) await db.execute({ sql: `INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_user_id, status, submitted_at) VALUES (?, ?, ?, ?)`, args: [al[0].id, sid, "Submitted", "2026-06-08"] });
    if (al[1]) await db.execute({ sql: `INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_user_id, status, submitted_at) VALUES (?, ?, ?, ?)`, args: [al[1].id, sid, "Pending", null] });
    if (al[2]) await db.execute({ sql: `INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_user_id, status, submitted_at) VALUES (?, ?, ?, ?)`, args: [al[2].id, sid, "Pending", null] });

    // ── Seed: Notices ────────────────────────────────────────
    await db.execute({ sql: `INSERT OR IGNORE INTO notices (id, title, body, target_role, priority, created_by, expires_at) VALUES (1, 'Welcome to New Semester', 'Classes begin from June 1. Attendance is mandatory.', 'all', 'high', ?, NULL)`, args: [aid] });
    await db.execute({ sql: `INSERT OR IGNORE INTO notices (id, title, body, target_role, priority, created_by, expires_at) VALUES (2, 'Mid-Semester Exam Schedule', 'Exams will be held from June 20 to June 25.', 'student', 'urgent', ?, '2026-06-25')`, args: [aid] });
    await db.execute({ sql: `INSERT OR IGNORE INTO notices (id, title, body, target_role, priority, created_by, expires_at) VALUES (3, 'Staff Meeting', 'All teachers please attend the staff meeting on June 15 at 10 AM.', 'teacher', 'normal', ?, '2026-06-15')`, args: [aid] });

    // ── Seed: Tasks ─────────────────────────────────────────
    await db.execute({ sql: `INSERT OR IGNORE INTO tasks (id, title, description, assigned_to, assigned_by, due_date, priority, status) VALUES (1, 'Submit Lab Report', 'Submit the pending database lab report by due date.', ?, ?, '2026-07-01', 'high', 'Pending')`, args: [sid, tid] });
    await db.execute({ sql: `INSERT OR IGNORE INTO tasks (id, title, description, assigned_to, assigned_by, due_date, priority, status) VALUES (2, 'Upload Marks Sheet', 'Upload Unit Test 2 marks to the portal.', ?, ?, '2026-06-30', 'normal', 'Pending')`, args: [tid, aid] });

    // ── Seed: Events ────────────────────────────────────────
    await db.execute({ sql: `INSERT OR IGNORE INTO events (id, title, description, location, event_date, event_time, target_role, created_by) VALUES (1, 'Annual Tech Fest', 'Participate in coding, robotics and quiz competitions.', 'Main Auditorium', '2026-07-10', '09:00', 'all', ?)`, args: [aid] });
    await db.execute({ sql: `INSERT OR IGNORE INTO events (id, title, description, location, event_date, event_time, target_role, created_by) VALUES (2, 'Parent-Teacher Meeting', 'PTM for first year students.', 'Conference Hall', '2026-07-05', '11:00', 'student', ?)`, args: [aid] });

    // ── Seed: Complaints ────────────────────────────────────
    await db.execute({ sql: `INSERT OR IGNORE INTO complaints (id, subject, body, category, status, filed_by) VALUES (1, 'Projector not working in Room 203', 'The projector has been broken for 2 weeks.', 'Infrastructure', 'Open', ?)`, args: [sid] });

    // ── Seed: Lost & Found ──────────────────────────────────
    await db.execute({ sql: `INSERT OR IGNORE INTO lost_found (id, type, item_name, description, location, contact, reported_by) VALUES (1, 'Lost', 'Blue Water Bottle', 'Milton brand, blue colour with sticker.', 'Canteen area', '9000000003', ?)`, args: [sid] });
    await db.execute({ sql: `INSERT OR IGNORE INTO lost_found (id, type, item_name, description, location, contact, reported_by) VALUES (2, 'Found', 'Black Calculator', 'Casio fx-991, found near library entrance.', 'Library', '9000000002', ?)`, args: [tid] });
  }
}

await seed();
await db.execute({ sql: `DELETE FROM auth_sessions WHERE expires_at <= datetime('now')`, args: [] });

async function nextLoginId(role) {
  const prefix = role === "student" ? "STU" : role === "teacher" ? "TCH" : "ADM";
  const row = first(await db.execute({ sql: `SELECT login_id FROM auth_users WHERE login_id LIKE ? ORDER BY login_id DESC LIMIT 1`, args: [`${prefix}%`] }));
  const next = row ? Number(row.login_id.slice(3)) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// ════════════════════════════════════════════════════════════
// AUTH & USER FUNCTIONS
// ════════════════════════════════════════════════════════════

export async function admissionRecord(admissionNumber) {
  if (!admissionNumber) return null;
  return first(await db.execute({ sql: `SELECT admission_number AS admissionNumber, name, email, status FROM college_admissions WHERE admission_number = ?`, args: [admissionNumber.trim().toUpperCase()] }));
}

export async function isEmailTaken(email) {
  if (!email) return false;
  return !!first(await db.execute({ sql: `SELECT id FROM auth_users WHERE email = lower(?)`, args: [email.trim()] }));
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const row = first(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users WHERE email = lower(?)`, args: [email.trim()] }));
  return row ? publicUser(row) : null;
}

export async function updatePassword(email, newPassword) {
  const row = first(await db.execute({ sql: `SELECT id FROM auth_users WHERE email = lower(?)`, args: [email.trim()] }));
  if (!row) throw new Error("No account found with this email.");
  await db.execute({ sql: `UPDATE auth_users SET password_hash = ? WHERE id = ?`, args: [hashPassword(newPassword), row.id] });
}

export async function addAdmissionRecord({ admission_number, name, email }) {
  const clean = admission_number.trim().toUpperCase();
  try {
    await db.execute({ sql: `INSERT INTO college_admissions (admission_number, name, email, status) VALUES (?, ?, ?, 'Valid')`, args: [clean, name.trim(), email.trim().toLowerCase()] });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) throw new Error(`Admission number ${clean} already exists in the database.`);
    throw err;
  }
  return { admissionNumber: clean, name: name.trim(), email: email.trim().toLowerCase(), status: "Valid" };
}

export async function listAdmissions() {
  return all(await db.execute({ sql: `SELECT admission_number AS admissionNumber, name, email, status FROM college_admissions ORDER BY admission_number`, args: [] }));
}

export async function createRegistration({ role, name, email, phone = "", admission_number, admissionNumber, password }) {
  if (!["student", "teacher"].includes(role)) throw new Error("Only students and teachers can register here.");
  const rawAdmission = admission_number || admissionNumber || "";
  const cleanAdmission = role === "student" ? rawAdmission.trim().toUpperCase() : null;

  let isKnownUser = false;
  if (role === "student") {
    const record = await admissionRecord(cleanAdmission);
    if (!record) throw new Error("Admission number was not found in the college database.");
    isKnownUser = record.email.toLowerCase() === email.trim().toLowerCase();
  }

  const loginId = isKnownUser ? await nextLoginId(role) : null;
  const status = isKnownUser ? "Approved" : "Pending";

  try {
    await db.execute({
      sql: `INSERT INTO auth_users (login_id, role, name, email, phone, admission_number, password_hash, status, approved_at, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${isKnownUser ? "CURRENT_TIMESTAMP" : "NULL"}, ${isKnownUser ? "'System auto-approve'" : "NULL"})`,
      args: [loginId, role, name.trim(), email.trim().toLowerCase(), phone.trim(), cleanAdmission, hashPassword(password), status]
    });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) throw new Error("An account with this email already exists.");
    throw err;
  }

  const row = first(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users WHERE email = lower(?)`, args: [email.trim()] }));
  return { user: publicUser(row), isKnownUser };
}

export async function authenticate({ role, loginId, password }) {
  const identifier = `${role}:${loginId.trim().toUpperCase()}`;
  const attempt = first(await db.execute({ sql: `SELECT attempts, locked_until FROM login_attempts WHERE identifier = ?`, args: [identifier] }));

  if (attempt && attempt.locked_until > Date.now()) throw new Error("Too many login attempts. Try again in a few minutes.");

  const row = first(await db.execute({ sql: `SELECT *, login_id AS loginId, admission_number AS admissionNumber FROM auth_users WHERE role = ? AND login_id = ?`, args: [role, loginId.trim().toUpperCase()] }));

  if (!row || !verifyPassword(password, row.password_hash) || row.status !== "Approved") {
    const attempts = (attempt?.attempts || 0) + 1;
    const lockedUntil = attempts >= 5 ? Date.now() + 10 * 60 * 1000 : 0;
    await db.execute({ sql: `INSERT INTO login_attempts (identifier, attempts, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(identifier) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until, updated_at = excluded.updated_at`, args: [identifier, attempts, lockedUntil, Date.now()] });
    if (row) await recordLogin(row.id, row.role, "Failed", row.status !== "Approved" ? "Account is not approved." : "Invalid password.");
    return null;
  }

  await db.execute({ sql: `DELETE FROM login_attempts WHERE identifier = ?`, args: [identifier] });
  return publicUser(row);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  await db.execute({ sql: `INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))`, args: [token, userId] });
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  const row = first(await db.execute({
    sql: `SELECT auth_sessions.token, ${userSelect} FROM auth_sessions JOIN auth_users ON auth_users.id = auth_sessions.user_id WHERE auth_sessions.token = ? AND auth_sessions.expires_at > datetime('now')`,
    args: [token]
  }));
  return row ? { token: row.token, ...publicUser(row) } : null;
}

export async function deleteSession(token) {
  if (token) await db.execute({ sql: `DELETE FROM auth_sessions WHERE token = ?`, args: [token] });
}

export async function approveUser(userId, actorName, actorRole) {
  const row = first(await db.execute({ sql: `SELECT * FROM auth_users WHERE id = ?`, args: [userId] }));
  if (!row || row.status !== "Pending") return null;
  if (actorRole === "teacher" && row.role !== "student") return null;
  const loginId = await nextLoginId(row.role);
  await db.execute({ sql: `UPDATE auth_users SET status = 'Approved', login_id = ?, approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`, args: [loginId, actorName, userId] });
  await addNotification(userId, `Your registration was approved. Your login ID is ${loginId}.`);
  return publicUser(first(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users WHERE id = ?`, args: [userId] })));
}

export async function rejectUser(userId, actorName, actorRole) {
  const row = first(await db.execute({ sql: `SELECT * FROM auth_users WHERE id = ?`, args: [userId] }));
  if (!row || row.status !== "Pending") return null;
  if (actorRole === "teacher" && row.role !== "student") return null;
  await db.execute({ sql: `UPDATE auth_users SET status = 'Rejected', approved_by = ? WHERE id = ?`, args: [actorName, userId] });
  await addNotification(userId, "Your registration request was rejected. Contact administration for details.");
  return publicUser(first(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users WHERE id = ?`, args: [userId] })));
}

export async function addNotification(userId, message) {
  await db.execute({ sql: `INSERT INTO notifications (user_id, message) VALUES (?, ?)`, args: [userId, message] });
}

export async function recordLogin(userId, role, result, detail = "") {
  await db.execute({ sql: `INSERT INTO login_history (user_id, role, result, detail) VALUES (?, ?, ?, ?)`, args: [userId, role, result, detail] });
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════

export async function getDashboardState(session) {
  const users = all(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users ORDER BY requested_at DESC, id DESC`, args: [] })).map(publicUser);
  const attendance = all(await db.execute({
    sql: `SELECT attendance.id, attendance.student_user_id AS studentUserId, auth_users.login_id AS studentId, auth_users.name AS studentName, attendance.class_date AS classDate, attendance.status, marker.name AS markedBy, attendance.updated_at AS updatedAt FROM attendance JOIN auth_users ON auth_users.id = attendance.student_user_id LEFT JOIN auth_users marker ON marker.id = attendance.marked_by ORDER BY attendance.class_date DESC, auth_users.name ASC`,
    args: []
  }));
  const notifications = all(await db.execute({ sql: `SELECT id, message, created_at AS createdAt, read_at AS readAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, args: [session.id] }));
  const loginHistory = all(await db.execute({ sql: `SELECT login_at AS loginAt, result, detail FROM login_history WHERE user_id = ? ORDER BY login_at DESC LIMIT 20`, args: [session.id] }));

  // Common: notices + upcoming events (role-filtered)
  const notices = await getNotices({ role: session.role });
  const upcomingEvents = await getUpcomingEvents({ role: session.role });

  if (session.role === "student") {
    const classAttendance = all(await db.execute({
      sql: `SELECT ca.id, ca.student_user_id AS studentUserId, ca.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode, ca.class_date AS classDate, ca.status, marker.name AS markedBy, ca.updated_at AS updatedAt FROM class_attendance ca JOIN subjects s ON s.id = ca.subject_id LEFT JOIN auth_users marker ON marker.id = ca.marked_by WHERE ca.student_user_id = ? ORDER BY ca.class_date DESC, s.name`,
      args: [session.id]
    }));
    const testMarks = all(await db.execute({
      sql: `SELECT tm.id, tm.student_user_id AS studentUserId, tm.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode, tm.test_name AS testName, tm.marks_obtained AS marksObtained, tm.marks_total AS marksTotal, tm.recorded_at AS recordedAt FROM test_marks tm JOIN subjects s ON s.id = tm.subject_id WHERE tm.student_user_id = ? ORDER BY tm.recorded_at DESC`,
      args: [session.id]
    }));
    const myAssignments = all(await db.execute({
      sql: `SELECT a.id, a.title, a.description, a.max_marks AS maxMarks, a.due_date AS dueDate, s.name AS subjectName, COALESCE(sub.status, 'Pending') AS submissionStatus, sub.marks_obtained AS marksObtained FROM assignments a JOIN subjects s ON s.id = a.subject_id LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_user_id = ? ORDER BY a.due_date ASC`,
      args: [session.id]
    }));
    const myTasks = await getMyTasks(session.id);
    const myComplaints = await getMyComplaints(session.id);
    const lostFoundItems = await getLostFoundItems({ status: "Open" });

    return { me: session, attendance: attendance.filter(i => i.studentUserId === session.id), classAttendance, testMarks, myAssignments, notifications, loginHistory, notices, upcomingEvents, myTasks, myComplaints, lostFoundItems };
  }

  if (session.role === "teacher") {
    const mySubjects = all(await db.execute({ sql: `SELECT id, name, code FROM subjects WHERE teacher_id = ?`, args: [session.id] }));
    const subjectIds = mySubjects.map(s => s.id);

    const classAttendance = subjectIds.length ? all(await db.execute({
      sql: `SELECT ca.id, ca.student_user_id AS studentUserId, u.name AS studentName, u.login_id AS studentId, ca.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode, ca.class_date AS classDate, ca.status, marker.name AS markedBy, ca.updated_at AS updatedAt FROM class_attendance ca JOIN auth_users u ON u.id = ca.student_user_id JOIN subjects s ON s.id = ca.subject_id LEFT JOIN auth_users marker ON marker.id = ca.marked_by WHERE ca.subject_id IN (${subjectIds.join(",")}) ORDER BY ca.class_date DESC, s.name, u.name`,
      args: []
    })) : [];

    const testMarks = subjectIds.length ? all(await db.execute({
      sql: `SELECT tm.id, tm.student_user_id AS studentUserId, u.name AS studentName, tm.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode, tm.test_name AS testName, tm.marks_obtained AS marksObtained, tm.marks_total AS marksTotal, tm.recorded_at AS recordedAt FROM test_marks tm JOIN auth_users u ON u.id = tm.student_user_id JOIN subjects s ON s.id = tm.subject_id WHERE tm.subject_id IN (${subjectIds.join(",")}) ORDER BY tm.recorded_at DESC`,
      args: []
    })) : [];

    const assignments = subjectIds.length ? all(await db.execute({
      sql: `SELECT a.id, a.title, a.description, a.max_marks AS maxMarks, a.due_date AS dueDate, s.name AS subjectName, s.code AS subjectCode, COUNT(sub.id) AS totalSubmissions, SUM(CASE WHEN sub.status = 'Submitted' THEN 1 ELSE 0 END) AS submitted FROM assignments a JOIN subjects s ON s.id = a.subject_id LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id WHERE a.subject_id IN (${subjectIds.join(",")}) GROUP BY a.id ORDER BY a.due_date ASC`,
      args: []
    })) : [];

    const myTasks = await getMyTasks(session.id);
    const assignedTasks = await getAssignedTasks(session.id);
    const myComplaints = await getMyComplaints(session.id);
    const lostFoundItems = await getLostFoundItems({ status: "Open" });

    return { me: session, requests: users.filter(u => u.role === "student" && u.status === "Pending" && u.admissionNumber), students: users.filter(u => u.role === "student" && u.status === "Approved"), attendance, subjects: mySubjects, classAttendance, testMarks, assignments, notifications, loginHistory, notices, upcomingEvents, myTasks, assignedTasks, myComplaints, lostFoundItems };
  }

  // Admin
  const allComplaints = await getAllComplaints();
  const allLostFound = await getLostFoundItems({ status: null });
  const allEvents = await getAllEvents();

  return { me: session, requests: users.filter(u => u.status === "Pending"), users, attendance, notifications, loginHistory, notices, upcomingEvents, allComplaints, allLostFound, allEvents };
}

// ════════════════════════════════════════════════════════════
// ATTENDANCE & SUBJECTS
// ════════════════════════════════════════════════════════════

export async function upsertAttendance({ studentUserId, classDate, status, markedBy }) {
  await db.execute({ sql: `INSERT INTO attendance (student_user_id, class_date, status, marked_by, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(student_user_id, class_date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, updated_at = CURRENT_TIMESTAMP`, args: [studentUserId, classDate, status, markedBy] });
  await addNotification(studentUserId, `Attendance for ${classDate} was marked ${status}.`);
  return true;
}

export async function listSubjects(teacherId) {
  return all(await db.execute({ sql: `SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE teacher_id = ?`, args: [teacherId] }));
}

export async function addSubject({ name, code, teacherId }) {
  try {
    await db.execute({ sql: `INSERT INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`, args: [name, code.trim().toUpperCase(), teacherId] });
    return first(await db.execute({ sql: `SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE code = ?`, args: [code.trim().toUpperCase()] }));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) throw new Error("Subject code already exists.");
    throw err;
  }
}

export async function upsertClassAttendance({ studentUserId, subjectId, classDate, status, markedBy }) {
  await db.execute({ sql: `INSERT INTO class_attendance (student_user_id, subject_id, class_date, status, marked_by, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(student_user_id, subject_id, class_date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, updated_at = CURRENT_TIMESTAMP`, args: [studentUserId, subjectId, classDate, status, markedBy] });
  await addNotification(studentUserId, `Attendance for ${classDate} in subject was marked ${status}.`);
  return true;
}

export async function addOrUpdateMark({ studentUserId, subjectId, testName, marksObtained, marksTotal, recordedBy }) {
  const existing = first(await db.execute({ sql: `SELECT id FROM test_marks WHERE student_user_id = ? AND subject_id = ? AND test_name = ?`, args: [studentUserId, subjectId, testName] }));
  if (existing) {
    await db.execute({ sql: `UPDATE test_marks SET marks_obtained = ?, marks_total = ?, recorded_by = ?, recorded_at = CURRENT_TIMESTAMP WHERE id = ?`, args: [marksObtained, marksTotal, recordedBy, existing.id] });
  } else {
    await db.execute({ sql: `INSERT INTO test_marks (student_user_id, subject_id, test_name, marks_obtained, marks_total, recorded_by) VALUES (?, ?, ?, ?, ?, ?)`, args: [studentUserId, subjectId, testName, marksObtained, marksTotal, recordedBy] });
  }
  await addNotification(studentUserId, `Your marks for "${testName}" have been updated.`);
  return true;
}

export async function createAssignment({ subjectId, title, description, maxMarks, dueDate, createdBy }) {
  await db.execute({ sql: `INSERT INTO assignments (subject_id, title, description, max_marks, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`, args: [subjectId, title, description || "", maxMarks, dueDate, createdBy] });
  return true;
}

export async function updateSubmissionStatus({ assignmentId, studentUserId, status, marksObtained }) {
  const existing = first(await db.execute({ sql: `SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_user_id = ?`, args: [assignmentId, studentUserId] }));
  if (existing) {
    await db.execute({ sql: `UPDATE assignment_submissions SET status = ?, marks_obtained = ?, submitted_at = CASE WHEN ? = 'Submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, args: [status, marksObtained ?? null, status, existing.id] });
  } else {
    await db.execute({ sql: `INSERT INTO assignment_submissions (assignment_id, student_user_id, status, marks_obtained, submitted_at) VALUES (?, ?, ?, ?, CASE WHEN ? = 'Submitted' THEN CURRENT_TIMESTAMP ELSE NULL END)`, args: [assignmentId, studentUserId, status, marksObtained ?? null, status] });
  }
  await addNotification(studentUserId, `Your assignment submission status was updated to "${status}".`);
  return true;
}

export async function getAssignmentStudents(assignmentId) {
  return all(await db.execute({
    sql: `SELECT u.id, u.name, u.login_id AS loginId, COALESCE(sub.status, 'Pending') AS status, sub.marks_obtained AS marksObtained, sub.submitted_at AS submittedAt FROM auth_users u LEFT JOIN assignment_submissions sub ON sub.assignment_id = ? AND sub.student_user_id = u.id WHERE u.role = 'student' AND u.status = 'Approved' ORDER BY u.name`,
    args: [assignmentId]
  }));
}

export async function getAllSubjects() {
  return all(await db.execute({
    sql: `SELECT s.id, s.name, s.code, s.teacher_id AS teacherId, u.name AS teacherName FROM subjects s LEFT JOIN auth_users u ON u.id = s.teacher_id ORDER BY s.name`,
    args: []
  }));
}

export async function getAllTeachers() {
  return all(await db.execute({ sql: `SELECT id, name, login_id AS loginId, email FROM auth_users WHERE role = 'teacher' AND status = 'Approved' ORDER BY name`, args: [] }));
}

export async function assignSubjectToTeacher(subjectId, teacherId) {
  await db.execute({ sql: `UPDATE subjects SET teacher_id = ? WHERE id = ?`, args: [teacherId, subjectId] });
  return first(await db.execute({ sql: `SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE id = ?`, args: [subjectId] }));
}

export async function addSubjectForAdmin({ name, code, teacherId }) {
  const existing = first(await db.execute({ sql: `SELECT id FROM subjects WHERE code = ?`, args: [code] }));
  if (existing) throw new Error(`Subject with code "${code}" already exists.`);
  const result = await db.execute({ sql: `INSERT INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`, args: [name, code, teacherId || null] });
  return first(await db.execute({ sql: `SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE id = ?`, args: [result.lastInsertRowid] }));
}

export async function addTeacherByAdmin({ name, email, password }) {
  if (!name || !email || !password) throw new Error("name, email, and password are required.");
  if (await isEmailTaken(email)) throw new Error("An account with this email already exists.");
  const loginId = await nextLoginId("teacher");
  try {
    await db.execute({ sql: `INSERT INTO auth_users (login_id, role, name, email, phone, password_hash, status, approved_at, approved_by) VALUES (?, 'teacher', ?, ?, '', ?, 'Approved', CURRENT_TIMESTAMP, 'Admin')`, args: [loginId, name.trim(), email.trim().toLowerCase(), hashPassword(password)] });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) throw new Error("Email already registered.");
    throw err;
  }
  const user = publicUser(first(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users WHERE login_id = ?`, args: [loginId] })));
  return { id: user.id, loginId: user.loginId, name: user.name, email: user.email, role: "teacher", status: "Approved" };
}

// ════════════════════════════════════════════════════════════
// NOTICES
// ════════════════════════════════════════════════════════════

export async function createNotice({ title, body, targetRole = "all", priority = "normal", createdBy, expiresAt = null }) {
  const result = await db.execute({
    sql: `INSERT INTO notices (title, body, target_role, priority, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [title.trim(), body.trim(), targetRole, priority, createdBy, expiresAt]
  });
  return result.lastInsertRowid;
}

export async function getNotices({ role = "all", includeExpired = false } = {}) {
  const expiryCond = includeExpired ? "" : `AND (n.expires_at IS NULL OR n.expires_at > datetime('now'))`;
  const roleCond = role === "all" ? "" : `AND (n.target_role = 'all' OR n.target_role = ?)`;
  const args = role === "all" ? [] : [role];
  return all(await db.execute({
    sql: `SELECT n.id, n.title, n.body, n.target_role AS targetRole, n.priority,
                 n.created_at AS createdAt, n.expires_at AS expiresAt,
                 u.name AS createdByName, u.role AS createdByRole
          FROM notices n JOIN auth_users u ON u.id = n.created_by
          WHERE 1=1 ${roleCond} ${expiryCond}
          ORDER BY CASE n.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
                   n.created_at DESC`,
    args
  }));
}

export async function deleteNotice(noticeId, requesterId, requesterRole) {
  const row = first(await db.execute({ sql: `SELECT created_by FROM notices WHERE id = ?`, args: [noticeId] }));
  if (!row) throw new Error("Notice not found.");
  if (requesterRole !== "admin" && row.created_by !== requesterId) throw new Error("Not authorized.");
  await db.execute({ sql: `DELETE FROM notices WHERE id = ?`, args: [noticeId] });
  return true;
}

// ════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════

export async function createTask({ title, description = "", assignedTo, assignedBy, dueDate = null, priority = "normal" }) {
  const result = await db.execute({
    sql: `INSERT INTO tasks (title, description, assigned_to, assigned_by, due_date, priority) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [title.trim(), description.trim(), assignedTo, assignedBy, dueDate, priority]
  });
  await addNotification(assignedTo, `You have a new task: "${title}"`);
  return result.lastInsertRowid;
}

export async function getMyTasks(userId) {
  return all(await db.execute({
    sql: `SELECT t.id, t.title, t.description, t.due_date AS dueDate, t.priority,
                 t.status, t.created_at AS createdAt, t.updated_at AS updatedAt,
                 u.name AS assignedByName
          FROM tasks t JOIN auth_users u ON u.id = t.assigned_by
          WHERE t.assigned_to = ?
          ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                   t.due_date ASC NULLS LAST`,
    args: [userId]
  }));
}

export async function getAssignedTasks(assignedBy) {
  return all(await db.execute({
    sql: `SELECT t.id, t.title, t.description, t.due_date AS dueDate, t.priority,
                 t.status, t.created_at AS createdAt,
                 u.name AS assignedToName, u.login_id AS assignedToId
          FROM tasks t JOIN auth_users u ON u.id = t.assigned_to
          WHERE t.assigned_by = ?
          ORDER BY t.created_at DESC`,
    args: [assignedBy]
  }));
}

export async function updateTaskStatus(taskId, userId, status) {
  const row = first(await db.execute({ sql: `SELECT assigned_to FROM tasks WHERE id = ?`, args: [taskId] }));
  if (!row) throw new Error("Task not found.");
  if (row.assigned_to !== userId) throw new Error("Not authorized.");
  await db.execute({ sql: `UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, args: [status, taskId] });
  return true;
}

export async function deleteTask(taskId, requesterId, requesterRole) {
  const row = first(await db.execute({ sql: `SELECT assigned_by FROM tasks WHERE id = ?`, args: [taskId] }));
  if (!row) throw new Error("Task not found.");
  if (requesterRole !== "admin" && row.assigned_by !== requesterId) throw new Error("Not authorized.");
  await db.execute({ sql: `DELETE FROM tasks WHERE id = ?`, args: [taskId] });
  return true;
}

// ════════════════════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════════════════════

export async function createEvent({ title, description = "", location = "", eventDate, eventTime = "00:00", targetRole = "all", createdBy }) {
  const result = await db.execute({
    sql: `INSERT INTO events (title, description, location, event_date, event_time, target_role, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [title.trim(), description.trim(), location.trim(), eventDate, eventTime, targetRole, createdBy]
  });
  return result.lastInsertRowid;
}

export async function getUpcomingEvents({ role = "all" } = {}) {
  const roleCond = role === "all" ? "" : `AND (e.target_role = 'all' OR e.target_role = ?)`;
  const args = role === "all" ? [] : [role];
  return all(await db.execute({
    sql: `SELECT e.id, e.title, e.description, e.location, e.event_date AS eventDate,
                 e.event_time AS eventTime, e.target_role AS targetRole,
                 e.created_at AS createdAt, u.name AS createdByName
          FROM events e JOIN auth_users u ON u.id = e.created_by
          WHERE e.event_date >= date('now') ${roleCond}
          ORDER BY e.event_date ASC, e.event_time ASC`,
    args
  }));
}

export async function getAllEvents({ role = "all" } = {}) {
  const roleCond = role === "all" ? "" : `AND (e.target_role = 'all' OR e.target_role = ?)`;
  const args = role === "all" ? [] : [role];
  return all(await db.execute({
    sql: `SELECT e.id, e.title, e.description, e.location, e.event_date AS eventDate,
                 e.event_time AS eventTime, e.target_role AS targetRole,
                 e.created_at AS createdAt, u.name AS createdByName
          FROM events e JOIN auth_users u ON u.id = e.created_by
          WHERE 1=1 ${roleCond}
          ORDER BY e.event_date DESC`,
    args
  }));
}

export async function deleteEvent(eventId, requesterId, requesterRole) {
  const row = first(await db.execute({ sql: `SELECT created_by FROM events WHERE id = ?`, args: [eventId] }));
  if (!row) throw new Error("Event not found.");
  if (requesterRole !== "admin" && row.created_by !== requesterId) throw new Error("Not authorized.");
  await db.execute({ sql: `DELETE FROM events WHERE id = ?`, args: [eventId] });
  return true;
}

// ════════════════════════════════════════════════════════════
// COMPLAINTS
// ════════════════════════════════════════════════════════════

export async function fileComplaint({ subject, body = "", category = "General", filedBy }) {
  const result = await db.execute({
    sql: `INSERT INTO complaints (subject, body, category, filed_by) VALUES (?, ?, ?, ?)`,
    args: [subject.trim(), body.trim(), category, filedBy]
  });
  return result.lastInsertRowid;
}

export async function getMyComplaints(userId) {
  return all(await db.execute({
    sql: `SELECT id, subject, body, category, status, resolution_note AS resolutionNote,
                 filed_at AS filedAt, resolved_at AS resolvedAt
          FROM complaints WHERE filed_by = ? ORDER BY filed_at DESC`,
    args: [userId]
  }));
}

export async function getAllComplaints() {
  return all(await db.execute({
    sql: `SELECT c.id, c.subject, c.body, c.category, c.status,
                 c.resolution_note AS resolutionNote, c.filed_at AS filedAt,
                 c.resolved_at AS resolvedAt,
                 u.name AS filedByName, u.role AS filedByRole, u.login_id AS filedById,
                 r.name AS resolvedByName
          FROM complaints c
          JOIN auth_users u ON u.id = c.filed_by
          LEFT JOIN auth_users r ON r.id = c.resolved_by
          ORDER BY CASE c.status WHEN 'Open' THEN 1 WHEN 'In Review' THEN 2 ELSE 3 END,
                   c.filed_at DESC`,
    args: []
  }));
}

export async function resolveComplaint({ complaintId, status, resolutionNote = "", resolvedBy }) {
  if (!["In Review", "Resolved", "Dismissed"].includes(status)) throw new Error("Invalid status.");
  const resolvedAt = (status === "Resolved" || status === "Dismissed") ? `CURRENT_TIMESTAMP` : `NULL`;
  await db.execute({
    sql: `UPDATE complaints SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ${resolvedAt} WHERE id = ?`,
    args: [status, resolutionNote.trim(), resolvedBy, complaintId]
  });
  const row = first(await db.execute({ sql: `SELECT filed_by FROM complaints WHERE id = ?`, args: [complaintId] }));
  if (row) await addNotification(row.filed_by, `Your complaint status has been updated to "${status}".`);
  return true;
}

// ════════════════════════════════════════════════════════════
// LOST & FOUND
// ════════════════════════════════════════════════════════════

export async function reportLostFound({ type, itemName, description = "", location = "", contact = "", reportedBy }) {
  const result = await db.execute({
    sql: `INSERT INTO lost_found (type, item_name, description, location, contact, reported_by) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [type, itemName.trim(), description.trim(), location.trim(), contact.trim(), reportedBy]
  });
  return result.lastInsertRowid;
}

export async function getLostFoundItems({ type = null, status = "Open" } = {}) {
  const typeCond = type ? `AND lf.type = ?` : "";
  const statusCond = status ? `AND lf.status = ?` : "";
  const args = [];
  if (type) args.push(type);
  if (status) args.push(status);
  return all(await db.execute({
    sql: `SELECT lf.id, lf.type, lf.item_name AS itemName, lf.description,
                 lf.location, lf.contact, lf.status,
                 lf.reported_at AS reportedAt, lf.closed_at AS closedAt,
                 u.name AS reportedByName, u.login_id AS reportedById
          FROM lost_found lf JOIN auth_users u ON u.id = lf.reported_by
          WHERE 1=1 ${typeCond} ${statusCond}
          ORDER BY lf.reported_at DESC`,
    args
  }));
}

export async function closeLostFoundItem(itemId, requesterId, requesterRole) {
  const row = first(await db.execute({ sql: `SELECT reported_by FROM lost_found WHERE id = ?`, args: [itemId] }));
  if (!row) throw new Error("Item not found.");
  if (requesterRole !== "admin" && row.reported_by !== requesterId) throw new Error("Not authorized.");
  await db.execute({ sql: `UPDATE lost_found SET status = 'Closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?`, args: [itemId] });
  return true;
}

export async function claimLostFoundItem(itemId) {
  await db.execute({ sql: `UPDATE lost_found SET status = 'Claimed', closed_at = CURRENT_TIMESTAMP WHERE id = ?`, args: [itemId] });
  return true;
}
