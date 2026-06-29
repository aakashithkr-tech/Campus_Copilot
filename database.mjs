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

  CREATE INDEX IF NOT EXISTS idx_class_attendance_student ON class_attendance(student_user_id, subject_id, class_date);
  CREATE INDEX IF NOT EXISTS idx_test_marks_student ON test_marks(student_user_id, subject_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
  CREATE INDEX IF NOT EXISTS idx_auth_users_role_status ON auth_users(role, status);
  CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_user_id, class_date);
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
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

// helper: get first row
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

  if (studentRow && teacherRow) {
    const sid = studentRow.id;
    const tid = teacherRow.id;

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

export async function getDashboardState(session) {
  const users = all(await db.execute({ sql: `SELECT ${userSelect} FROM auth_users ORDER BY requested_at DESC, id DESC`, args: [] })).map(publicUser);
  const attendance = all(await db.execute({
    sql: `SELECT attendance.id, attendance.student_user_id AS studentUserId, auth_users.login_id AS studentId, auth_users.name AS studentName, attendance.class_date AS classDate, attendance.status, marker.name AS markedBy, attendance.updated_at AS updatedAt FROM attendance JOIN auth_users ON auth_users.id = attendance.student_user_id LEFT JOIN auth_users marker ON marker.id = attendance.marked_by ORDER BY attendance.class_date DESC, auth_users.name ASC`,
    args: []
  }));
  const notifications = all(await db.execute({ sql: `SELECT id, message, created_at AS createdAt, read_at AS readAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, args: [session.id] }));
  const loginHistory = all(await db.execute({ sql: `SELECT login_at AS loginAt, result, detail FROM login_history WHERE user_id = ? ORDER BY login_at DESC LIMIT 20`, args: [session.id] }));

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
    return { me: session, attendance: attendance.filter(i => i.studentUserId === session.id), classAttendance, testMarks, myAssignments, notifications, loginHistory };
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

    return { me: session, requests: users.filter(u => u.role === "student" && u.status === "Pending" && u.admissionNumber), students: users.filter(u => u.role === "student" && u.status === "Approved"), attendance, subjects: mySubjects, classAttendance, testMarks, assignments, notifications, loginHistory };
  }

  return { me: session, requests: users.filter(u => u.status === "Pending"), users, attendance, notifications, loginHistory };
}

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
