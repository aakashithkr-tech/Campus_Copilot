import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

export const databasePath = join(dataDirectory, "campuscopilot.db");
const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

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

  CREATE INDEX IF NOT EXISTS idx_class_attendance_student ON class_attendance(student_user_id, subject_id, class_date);
  CREATE INDEX IF NOT EXISTS idx_test_marks_student ON test_marks(student_user_id, subject_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);

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

const seed = () => {
  db.exec("BEGIN");
  try {
    const admission = db.prepare(`
      INSERT OR IGNORE INTO college_admissions (admission_number, name, email)
      VALUES (?, ?, ?)
    `);
    [
      ["ADM2026001", "Aarav Mehta", "student@campus.edu"],
      ["ADM2026002", "Ishita Rao", "ishita@campus.edu"],
      ["ADM2026003", "Kabir Singh", "kabir@campus.edu"],
      ["ADM2026004", "Riya Jain", "riya@campus.edu"],
    ].forEach((row) => admission.run(...row));

    const user = db.prepare(`
      INSERT OR IGNORE INTO auth_users
        (login_id, role, name, email, phone, admission_number, password_hash, status, approved_at, approved_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', CURRENT_TIMESTAMP, 'System seed')
    `);
    user.run("ADM001", "admin", "Rohan Kapoor", "admin@campus.edu", "9000000001", null, hashPassword("admin123"));
    user.run("TCH001", "teacher", "Dr. Neha Sharma", "teacher@campus.edu", "9000000002", null, hashPassword("teacher123"));
    user.run("STU001", "student", "Aarav Mehta", "student@campus.edu", "9000000003", "ADM2026001", hashPassword("student123"));

    const student = db.prepare("SELECT id FROM auth_users WHERE login_id = 'STU001'").get();
    const teacher = db.prepare("SELECT id FROM auth_users WHERE login_id = 'TCH001'").get();
    if (student && teacher) {
      const attendance = db.prepare(`
        INSERT OR IGNORE INTO attendance (student_user_id, class_date, status, marked_by)
        VALUES (?, ?, ?, ?)
      `);
      attendance.run(student.id, "2026-06-01", "Present", teacher.id);
      attendance.run(student.id, "2026-06-02", "Late", teacher.id);
      attendance.run(student.id, "2026-06-03", "Present", teacher.id);

      // Subjects seed
      db.prepare(`INSERT OR IGNORE INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`).run("Database Systems", "CS301", teacher.id);
      db.prepare(`INSERT OR IGNORE INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`).run("AI Foundations", "CS401", teacher.id);
      db.prepare(`INSERT OR IGNORE INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`).run("Web Development", "CS201", teacher.id);

      const subjects = db.prepare("SELECT id, code FROM subjects").all();
      const sm = {};
      subjects.forEach(s => { sm[s.code] = s.id; });

      // class_attendance seed
      const ca = db.prepare(`INSERT OR IGNORE INTO class_attendance (student_user_id, subject_id, class_date, status, marked_by) VALUES (?, ?, ?, ?, ?)`);
      ca.run(student.id, sm["CS301"], "2026-06-01", "Present", teacher.id);
      ca.run(student.id, sm["CS301"], "2026-06-02", "Absent", teacher.id);
      ca.run(student.id, sm["CS301"], "2026-06-03", "Present", teacher.id);
      ca.run(student.id, sm["CS301"], "2026-06-04", "Present", teacher.id);
      ca.run(student.id, sm["CS401"], "2026-06-01", "Present", teacher.id);
      ca.run(student.id, sm["CS401"], "2026-06-02", "Present", teacher.id);
      ca.run(student.id, sm["CS401"], "2026-06-03", "Late", teacher.id);
      ca.run(student.id, sm["CS401"], "2026-06-04", "Present", teacher.id);
      ca.run(student.id, sm["CS201"], "2026-06-01", "Present", teacher.id);
      ca.run(student.id, sm["CS201"], "2026-06-02", "Present", teacher.id);
      ca.run(student.id, sm["CS201"], "2026-06-03", "Present", teacher.id);
      ca.run(student.id, sm["CS201"], "2026-06-04", "Absent", teacher.id);

      // test_marks seed
      const mk = db.prepare(`INSERT OR IGNORE INTO test_marks (student_user_id, subject_id, test_name, marks_obtained, marks_total, recorded_by) VALUES (?, ?, ?, ?, ?, ?)`);
      mk.run(student.id, sm["CS301"], "Unit Test 1", 34, 40, teacher.id);
      mk.run(student.id, sm["CS301"], "Mid Semester", 68, 80, teacher.id);
      mk.run(student.id, sm["CS401"], "Unit Test 1", 38, 40, teacher.id);
      mk.run(student.id, sm["CS201"], "Unit Test 1", 30, 40, teacher.id);

      // assignments seed
      const ag = db.prepare(`INSERT OR IGNORE INTO assignments (subject_id, title, description, max_marks, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`);
      ag.run(sm["CS301"], "ER Diagram Assignment", "Draw ER diagram for library system", 10, "2026-06-10", teacher.id);
      ag.run(sm["CS401"], "Neural Network Report", "Write a 2-page report on CNNs", 10, "2026-06-12", teacher.id);
      ag.run(sm["CS201"], "Portfolio Website", "Create a personal portfolio using HTML/CSS", 15, "2026-06-15", teacher.id);

      // assignment_submissions seed
      const al = db.prepare("SELECT id FROM assignments ORDER BY id").all();
      const sb = db.prepare(`INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_user_id, status, submitted_at) VALUES (?, ?, ?, ?)`);
      if (al[0]) sb.run(al[0].id, student.id, "Submitted", "2026-06-08");
      if (al[1]) sb.run(al[1].id, student.id, "Pending", null);
      if (al[2]) sb.run(al[2].id, student.id, "Pending", null);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

seed();
db.prepare("DELETE FROM auth_sessions WHERE expires_at <= datetime('now')").run();

const nextLoginId = (role) => {
  const prefix = role === "student" ? "STU" : role === "teacher" ? "TCH" : "ADM";
  const row = db
    .prepare("SELECT login_id FROM auth_users WHERE login_id LIKE ? ORDER BY login_id DESC LIMIT 1")
    .get(`${prefix}%`);
  const next = row ? Number(row.login_id.slice(3)) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
};

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

export function admissionRecord(admissionNumber) {
  if (!admissionNumber) return null;
  return (
    db
      .prepare("SELECT admission_number AS admissionNumber, name, email, status FROM college_admissions WHERE admission_number = ?")
      .get(admissionNumber.trim().toUpperCase()) || null
  );
}

// Check if an email is already taken (used before sending OTP)
export function isEmailTaken(email) {
  if (!email) return false;
  return !!db.prepare("SELECT id FROM auth_users WHERE email = lower(?)").get(email.trim());
}

// Get a user by email (used for forgot password)
export function getUserByEmail(email) {
  if (!email) return null;
  return db.prepare(`SELECT ${userSelect} FROM auth_users WHERE email = lower(?)`).get(email.trim()) || null;
}

// Update a user's password by email (used for password reset)
export function updatePassword(email, newPassword) {
  const row = db.prepare("SELECT id FROM auth_users WHERE email = lower(?)").get(email.trim());
  if (!row) throw new Error("No account found with this email.");
  db.prepare("UPDATE auth_users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), row.id);
}

// Admin adds a new student to college_admissions so they can self-register
export function addAdmissionRecord({ admission_number, name, email }) {
  const clean = admission_number.trim().toUpperCase();
  try {
    db.prepare(`
      INSERT INTO college_admissions (admission_number, name, email, status)
      VALUES (?, ?, ?, 'Valid')
    `).run(clean, name.trim(), email.trim().toLowerCase());
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error(`Admission number ${clean} already exists in the database.`);
    }
    throw err;
  }
  return { admissionNumber: clean, name: name.trim(), email: email.trim().toLowerCase(), status: "Valid" };
}

// Admin lists all admission records
export function listAdmissions() {
  return db.prepare("SELECT admission_number AS admissionNumber, name, email, status FROM college_admissions ORDER BY admission_number").all();
}

// Fix: accept both admission_number (form field) and admissionNumber (old code)
export function createRegistration({ role, name, email, phone = "", admission_number, admissionNumber, password }) {
  if (!["student", "teacher"].includes(role)) throw new Error("Only students and teachers can register here.");
  // Support both field name variants
  const rawAdmission = admission_number || admissionNumber || "";
  const cleanAdmission = role === "student" ? rawAdmission.trim().toUpperCase() : null;

  // Check if this is a "known user" — admission number AND email both match college_admissions
  let isKnownUser = false;
  if (role === "student") {
    const record = admissionRecord(cleanAdmission);
    if (!record) {
      throw new Error("Admission number was not found in the college database.");
    }
    // Known user = admission no. exists AND email matches what college has on file
    isKnownUser = record.email.toLowerCase() === email.trim().toLowerCase();
  }

  // Known users get auto-approved with a login ID; unknown users stay Pending
  const loginId = isKnownUser ? nextLoginId(role) : null;
  const status = isKnownUser ? "Approved" : "Pending";

  try {
    db.prepare(`
      INSERT INTO auth_users
        (login_id, role, name, email, phone, admission_number, password_hash, status,
         approved_at, approved_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?,
         ${isKnownUser ? "CURRENT_TIMESTAMP" : "NULL"},
         ${isKnownUser ? "'Auto-approved (known student)'" : "NULL"})
    `).run(loginId, role, name.trim(), email.trim().toLowerCase(), phone.replace(/\D/g, ""), cleanAdmission, hashPassword(password), status);
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      throw new Error("A request or user already exists with that email or admission number.");
    }
    throw error;
  }

  const user = db.prepare(`SELECT ${userSelect} FROM auth_users WHERE email = lower(?)`).get(email);
  // Return extra flag so server can tell the client whether approval is needed
  return { ...user, isKnownUser };
}

export function authenticate(role, loginId, password) {
  const identifier = `${role}:${loginId.trim().toUpperCase()}`;
  const attempt = db.prepare("SELECT * FROM login_attempts WHERE identifier = ?").get(identifier);
  if (attempt?.locked_until > Date.now()) {
    throw new Error("Too many login attempts. Try again in a few minutes.");
  }

  const row = db.prepare(`SELECT *, login_id AS loginId, admission_number AS admissionNumber FROM auth_users WHERE role = ? AND login_id = ?`).get(role, loginId.trim().toUpperCase());
  if (!row || !verifyPassword(password, row.password_hash) || row.status !== "Approved") {
    const attempts = (attempt?.attempts || 0) + 1;
    const lockedUntil = attempts >= 5 ? Date.now() + 10 * 60 * 1000 : 0;
    db.prepare(`
      INSERT INTO login_attempts (identifier, attempts, locked_until, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(identifier) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until, updated_at = excluded.updated_at
    `).run(identifier, attempts, lockedUntil, Date.now());
    if (row) recordLogin(row.id, row.role, "Failed", row.status !== "Approved" ? "Account is not approved." : "Invalid password.");
    return null;
  }

  db.prepare("DELETE FROM login_attempts WHERE identifier = ?").run(identifier);
  return publicUser(row);
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare(`
    INSERT INTO auth_sessions (token, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+30 days'))
  `).run(token, userId);
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const row = db
    .prepare(`
      SELECT auth_sessions.token, ${userSelect}
      FROM auth_sessions
      JOIN auth_users ON auth_users.id = auth_sessions.user_id
      WHERE auth_sessions.token = ? AND auth_sessions.expires_at > datetime('now')
    `)
    .get(token);
  return row ? { token: row.token, ...publicUser(row) } : null;
}

export function deleteSession(token) {
  if (token) db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
}

export function approveUser(userId, actorName, actorRole) {
  const row = db.prepare("SELECT * FROM auth_users WHERE id = ?").get(userId);
  if (!row || row.status !== "Pending") return null;
  if (actorRole === "teacher" && row.role !== "student") return null;
  const loginId = nextLoginId(row.role);
  db.prepare(`
    UPDATE auth_users
    SET status = 'Approved', login_id = ?, approved_at = CURRENT_TIMESTAMP, approved_by = ?
    WHERE id = ?
  `).run(loginId, actorName, userId);
  addNotification(userId, `Your registration was approved. Your login ID is ${loginId}.`);
  return db.prepare(`SELECT ${userSelect} FROM auth_users WHERE id = ?`).get(userId);
}

export function rejectUser(userId, actorName, actorRole) {
  const row = db.prepare("SELECT * FROM auth_users WHERE id = ?").get(userId);
  if (!row || row.status !== "Pending") return null;
  if (actorRole === "teacher" && row.role !== "student") return null;
  db.prepare("UPDATE auth_users SET status = 'Rejected', approved_by = ? WHERE id = ?").run(actorName, userId);
  addNotification(userId, "Your registration request was rejected. Contact administration for details.");
  return db.prepare(`SELECT ${userSelect} FROM auth_users WHERE id = ?`).get(userId);
}

export function addNotification(userId, message) {
  db.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)").run(userId, message);
}

export function recordLogin(userId, role, result, detail = "") {
  db.prepare("INSERT INTO login_history (user_id, role, result, detail) VALUES (?, ?, ?, ?)").run(userId, role, result, detail);
}

export function getDashboardState(session) {
  const users = db.prepare(`SELECT ${userSelect} FROM auth_users ORDER BY requested_at DESC, id DESC`).all().map(publicUser);
  const attendance = db
    .prepare(`
      SELECT attendance.id, attendance.student_user_id AS studentUserId, auth_users.login_id AS studentId,
        auth_users.name AS studentName, attendance.class_date AS classDate, attendance.status,
        marker.name AS markedBy, attendance.updated_at AS updatedAt
      FROM attendance
      JOIN auth_users ON auth_users.id = attendance.student_user_id
      LEFT JOIN auth_users marker ON marker.id = attendance.marked_by
      ORDER BY attendance.class_date DESC, auth_users.name ASC
    `)
    .all();
  const notifications = db
    .prepare("SELECT id, message, created_at AS createdAt, read_at AS readAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(session.id);
  const loginHistory = db
    .prepare("SELECT login_at AS loginAt, result, detail FROM login_history WHERE user_id = ? ORDER BY login_at DESC LIMIT 20")
    .all(session.id);

  if (session.role === "student") {
    const classAttendance = db.prepare(`
      SELECT ca.id, ca.student_user_id AS studentUserId, ca.subject_id AS subjectId,
        s.name AS subjectName, s.code AS subjectCode,
        ca.class_date AS classDate, ca.status,
        marker.name AS markedBy, ca.updated_at AS updatedAt
      FROM class_attendance ca
      JOIN subjects s ON s.id = ca.subject_id
      LEFT JOIN auth_users marker ON marker.id = ca.marked_by
      WHERE ca.student_user_id = ?
      ORDER BY ca.class_date DESC, s.name
    `).all(session.id);

    const testMarks = db.prepare(`
      SELECT tm.id, tm.student_user_id AS studentUserId,
        tm.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode,
        tm.test_name AS testName, tm.marks_obtained AS marksObtained, tm.marks_total AS marksTotal,
        tm.recorded_at AS recordedAt
      FROM test_marks tm
      JOIN subjects s ON s.id = tm.subject_id
      WHERE tm.student_user_id = ?
      ORDER BY tm.recorded_at DESC
    `).all(session.id);

    const myAssignments = db.prepare(`
      SELECT a.id, a.title, a.description, a.max_marks AS maxMarks, a.due_date AS dueDate,
        s.name AS subjectName,
        COALESCE(sub.status, 'Pending') AS submissionStatus,
        sub.marks_obtained AS marksObtained
      FROM assignments a
      JOIN subjects s ON s.id = a.subject_id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_user_id = ?
      ORDER BY a.due_date ASC
    `).all(session.id);

    return {
      me: session,
      attendance: attendance.filter((item) => item.studentUserId === session.id),
      classAttendance,
      testMarks,
      myAssignments,
      notifications,
      loginHistory,
    };
  }

  if (session.role === "teacher") {
    const mySubjects = db.prepare(`SELECT id, name, code FROM subjects WHERE teacher_id = ?`).all(session.id);
    const subjectIds = mySubjects.map(s => s.id);

    // class_attendance for all students in my subjects
    const classAttendance = subjectIds.length ? db.prepare(`
      SELECT ca.id, ca.student_user_id AS studentUserId, u.name AS studentName, u.login_id AS studentId,
        ca.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode,
        ca.class_date AS classDate, ca.status,
        marker.name AS markedBy, ca.updated_at AS updatedAt
      FROM class_attendance ca
      JOIN auth_users u ON u.id = ca.student_user_id
      JOIN subjects s ON s.id = ca.subject_id
      LEFT JOIN auth_users marker ON marker.id = ca.marked_by
      WHERE ca.subject_id IN (${subjectIds.join(",")})
      ORDER BY ca.class_date DESC, s.name, u.name
    `).all() : [];

    // test_marks for all students in my subjects
    const testMarks = subjectIds.length ? db.prepare(`
      SELECT tm.id, tm.student_user_id AS studentUserId, u.name AS studentName,
        tm.subject_id AS subjectId, s.name AS subjectName, s.code AS subjectCode,
        tm.test_name AS testName, tm.marks_obtained AS marksObtained, tm.marks_total AS marksTotal,
        tm.recorded_at AS recordedAt
      FROM test_marks tm
      JOIN auth_users u ON u.id = tm.student_user_id
      JOIN subjects s ON s.id = tm.subject_id
      WHERE tm.subject_id IN (${subjectIds.join(",")})
      ORDER BY tm.recorded_at DESC
    `).all() : [];

    // assignments with submission stats
    const assignments = subjectIds.length ? db.prepare(`
      SELECT a.id, a.title, a.description, a.max_marks AS maxMarks, a.due_date AS dueDate,
        s.name AS subjectName, s.code AS subjectCode,
        COUNT(sub.id) AS totalSubmissions,
        SUM(CASE WHEN sub.status = 'Submitted' THEN 1 ELSE 0 END) AS submitted
      FROM assignments a
      JOIN subjects s ON s.id = a.subject_id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
      WHERE a.subject_id IN (${subjectIds.join(",")})
      GROUP BY a.id
      ORDER BY a.due_date ASC
    `).all() : [];

    return {
      me: session,
      requests: users.filter((user) => user.role === "student" && user.status === "Pending" && user.admissionNumber),
      students: users.filter((user) => user.role === "student" && user.status === "Approved"),
      attendance,
      subjects: mySubjects,
      classAttendance,
      testMarks,
      assignments,
      notifications,
      loginHistory,
    };
  }

  return {
    me: session,
    requests: users.filter((user) => user.status === "Pending"),
    users,
    attendance,
    notifications,
    loginHistory,
  };
}

export function upsertAttendance({ studentUserId, classDate, status, markedBy }) {
  db.prepare(`
    INSERT INTO attendance (student_user_id, class_date, status, marked_by, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_user_id, class_date) DO UPDATE SET
      status = excluded.status,
      marked_by = excluded.marked_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(studentUserId, classDate, status, markedBy);
  addNotification(studentUserId, `Attendance for ${classDate} was marked ${status}.`);
  return true;
}

// ── Subject management ───────────────────────────────────────────────────────
export function listSubjects(teacherId) {
  return db.prepare(`SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE teacher_id = ?`).all(teacherId);
}

export function addSubject({ name, code, teacherId }) {
  try {
    db.prepare(`INSERT INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`).run(name, code.trim().toUpperCase(), teacherId);
    return db.prepare(`SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE code = ?`).get(code.trim().toUpperCase());
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) throw new Error("Subject code already exists.");
    throw err;
  }
}

// ── Class Attendance ─────────────────────────────────────────────────────────
export function upsertClassAttendance({ studentUserId, subjectId, classDate, status, markedBy }) {
  db.prepare(`
    INSERT INTO class_attendance (student_user_id, subject_id, class_date, status, marked_by, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_user_id, subject_id, class_date) DO UPDATE SET
      status = excluded.status,
      marked_by = excluded.marked_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(studentUserId, subjectId, classDate, status, markedBy);
  addNotification(studentUserId, `Attendance for ${classDate} in subject was marked ${status}.`);
  return true;
}

// ── Test Marks ───────────────────────────────────────────────────────────────
export function addOrUpdateMark({ studentUserId, subjectId, testName, marksObtained, marksTotal, recordedBy }) {
  const existing = db.prepare(`SELECT id FROM test_marks WHERE student_user_id = ? AND subject_id = ? AND test_name = ?`).get(studentUserId, subjectId, testName);
  if (existing) {
    db.prepare(`UPDATE test_marks SET marks_obtained = ?, marks_total = ?, recorded_by = ?, recorded_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(marksObtained, marksTotal, recordedBy, existing.id);
  } else {
    db.prepare(`INSERT INTO test_marks (student_user_id, subject_id, test_name, marks_obtained, marks_total, recorded_by) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(studentUserId, subjectId, testName, marksObtained, marksTotal, recordedBy);
  }
  addNotification(studentUserId, `Your marks for "${testName}" have been updated.`);
  return true;
}

// ── Assignments ──────────────────────────────────────────────────────────────
export function createAssignment({ subjectId, title, description, maxMarks, dueDate, createdBy }) {
  db.prepare(`INSERT INTO assignments (subject_id, title, description, max_marks, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(subjectId, title, description || "", maxMarks, dueDate, createdBy);
  return true;
}

export function updateSubmissionStatus({ assignmentId, studentUserId, status, marksObtained }) {
  const existing = db.prepare(`SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_user_id = ?`).get(assignmentId, studentUserId);
  if (existing) {
    db.prepare(`UPDATE assignment_submissions SET status = ?, marks_obtained = ?, submitted_at = CASE WHEN ? = 'Submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(status, marksObtained ?? null, status, existing.id);
  } else {
    db.prepare(`INSERT INTO assignment_submissions (assignment_id, student_user_id, status, marks_obtained, submitted_at) VALUES (?, ?, ?, ?, CASE WHEN ? = 'Submitted' THEN CURRENT_TIMESTAMP ELSE NULL END)`)
      .run(assignmentId, studentUserId, status, marksObtained ?? null, status);
  }
  addNotification(studentUserId, `Your assignment submission status was updated to "${status}".`);
  return true;
}

export function getAssignmentStudents(assignmentId) {
  return db.prepare(`
    SELECT u.id, u.name, u.login_id AS loginId,
      COALESCE(sub.status, 'Pending') AS status,
      sub.marks_obtained AS marksObtained,
      sub.submitted_at AS submittedAt
    FROM auth_users u
    LEFT JOIN assignment_submissions sub ON sub.assignment_id = ? AND sub.student_user_id = u.id
    WHERE u.role = 'student' AND u.status = 'Approved'
    ORDER BY u.name
  `).all(assignmentId);
}

export function getAllSubjects() {
  return db.prepare(`
    SELECT s.id, s.name, s.code, s.teacher_id AS teacherId, u.name AS teacherName
    FROM subjects s
    LEFT JOIN auth_users u ON u.id = s.teacher_id
    ORDER BY s.name
  `).all();
}

export function getAllTeachers() {
  return db.prepare(`SELECT id, name, login_id AS loginId, email FROM auth_users WHERE role = 'teacher' AND status = 'Approved' ORDER BY name`).all();
}

export function assignSubjectToTeacher(subjectId, teacherId) {
  db.prepare(`UPDATE subjects SET teacher_id = ? WHERE id = ?`).run(teacherId, subjectId);
  return db.prepare(`SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE id = ?`).get(subjectId);
}

export function addSubjectForAdmin({ name, code, teacherId }) {
  const existing = db.prepare(`SELECT id FROM subjects WHERE code = ?`).get(code);
  if (existing) throw new Error(`Subject with code "${code}" already exists.`);
  const result = db.prepare(`INSERT INTO subjects (name, code, teacher_id) VALUES (?, ?, ?)`).run(name, code, teacherId || null);
  return db.prepare(`SELECT id, name, code, teacher_id AS teacherId FROM subjects WHERE id = ?`).get(result.lastInsertRowid);
}

// Admin directly creates a teacher account (auto-approved with login ID)
export function addTeacherByAdmin({ name, email, password }) {
  if (!name || !email || !password) throw new Error("name, email, and password are required.");
  if (isEmailTaken(email)) throw new Error("An account with this email already exists.");
  const loginId = nextLoginId("teacher");
  try {
    db.prepare(`
      INSERT INTO auth_users
        (login_id, role, name, email, phone, password_hash, status, approved_at, approved_by)
      VALUES (?, 'teacher', ?, ?, '', ?, 'Approved', CURRENT_TIMESTAMP, 'Admin')
    `).run(loginId, name.trim(), email.trim().toLowerCase(), hashPassword(password));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) throw new Error("Email already registered.");
    throw err;
  }
  const user = db.prepare(`SELECT ${userSelect} FROM auth_users WHERE login_id = ?`).get(loginId);
  return { id: user.id, loginId: user.loginId, name: user.name, email: user.email, role: "teacher", status: "Approved" };
}


