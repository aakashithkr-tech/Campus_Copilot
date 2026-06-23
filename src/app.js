import { defaultState, demoUsers, navByRole, pageLabels } from "./data.js";

const API_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
 ? "https://campus-copilot-whd3.onrender.com"
  : "";
const icons = {
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M6 3v4M18 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-3V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  event: '<svg viewBox="0 0 24 24"><path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="m9 14 2 2 4-4"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v10h-6v-7H9v7H3Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M15 4h5v16h-5"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  notice: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="m22 2-8 20-4-9-8-4Z"/><path d="M22 2 10 13"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></svg>',
  support: '<svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0-9-9v5a2 2 0 0 0 2 2h2v-7H3M21 12v5a2 2 0 0 1-2 2h-2v-7h4M17 19c-1 2-3 2-5 2"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M19 15a6 6 0 0 1 3 6"/></svg>',
};

const root = document.querySelector("#app");
let state = structuredClone(defaultState);
let session = loadSession();
let loading = Boolean(session);
let currentPage = "overview";
let selectedRole = "student";
let noticeFilter = "All";
let noticeSearch = "";
let modal = null;
let pendingOtpEmail = ""; // Stores email while user is on OTP step
function initChat() {
  const s = loadSession();
  const firstName = s?.name ? s.name.split(" ")[0] : "there";
  return [
    {
      from: "assistant",
      text: `Hi ${firstName}. Ask me about any verified notice, deadline, event, or campus action.`,
    },
  ];
}
let chat = initChat();

function loadSession() {
  const stored = localStorage.getItem("campus-copilot-session");
  return stored ? JSON.parse(stored) : null;
}

function saveSession(value) {
  session = value;
  if (value) localStorage.setItem("campus-copilot-session", JSON.stringify(value));
  else localStorage.removeItem("campus-copilot-session");
}

async function api(path, { method = "GET", body } = {}) {
  const fullPath = path.startsWith("http") ? path : API_BASE + path;
  const response = await fetch(fullPath, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401 && session) saveSession(null);
    throw new Error(payload.error || "The database request failed.");
  }
  return payload;
}

async function refreshState() {
  const serverData = await api(API_BASE + "/api/state");
  state = { ...structuredClone(defaultState), ...serverData };

  // Admin: load real users, teachers, subjects
  if (session?.role === "admin") {
    try {
      const [teachersData, subjectsData, realUsersData] = await Promise.all([
        api("/api/admin/teachers"),
        api("/api/admin/subjects"),
        api("/api/admin/real-users"),
      ]);
      state.realTeachers = teachersData.teachers || [];
      state.allSubjects  = subjectsData.subjects  || [];
      state.realUsers    = realUsersData.users     || [];
    } catch (e) {
      console.warn("Could not load admin data:", e.message);
    }
  }
}

async function mutate(path, options, message) {
  try {
    await api(path, options);
    await refreshState();
    render();
    showToast(message);
    return true;
  } catch (error) {
    render();
    showToast(error.message, "error");
    return false;
  }
}

function icon(name) {
  return `<span class="icon" aria-hidden="true">${icons[name] || icons.notice}</span>`;
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function showToast(message, tone = "success") {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.innerHTML = `${icon(tone === "success" ? "check" : "notice")}<span>${escapeHTML(message)}</span>`;
  region.append(toast);
  setTimeout(() => toast.classList.add("show"), 20);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// function render() {
//   root.innerHTML = loading ? loadingPage() : session ? appShell() : loginPage();
//   bindEvents();
// }

function render() {
  const target = document.getElementById("app");
  if (loading) {
    target.innerHTML = loadingPage();
  } else if (currentPage === "register") {
    target.innerHTML = registerPage();
  } else if (currentPage === "otp") {
    target.innerHTML = otpPage(pendingOtpEmail);
  } else if (currentPage === "forgot-password") {
    target.innerHTML = forgotPasswordPage();
  } else if (currentPage === "reset-password") {
    target.innerHTML = resetPasswordPage(pendingOtpEmail);
  } else if (!session) {
    target.innerHTML = loginPage();
  } else {
    target.innerHTML = appShell();
  }
  bindEvents();
}
function loadingPage() {
  return `
    <main class="loading-page">
      <span class="brand-mark">${icon("spark")}</span>
      <strong>Connecting to the campus database...</strong>
      <span class="loading-bar"><i></i></span>
    </main>
  `;
}

// Step 1: Registration form (collects data, sends OTP)
function registerPage() {
  return `
    <main class="login-page">
      <section class="login-panel" style="margin:auto">
        <div class="login-card">
          <div class="login-heading">
            <span class="brand-mark">${icon("spark")}</span>
            <h2>Create Account</h2>
            <p>Fill in your details. We will send a 6-digit OTP to your email to verify.</p>
          </div>
          <form id="register-form" class="login-form" style="gap:0.75rem;display:flex;flex-direction:column">
            <select name="role" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border)">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            <input type="text" name="name" placeholder="Full Name" required />
            <input type="email" name="email" placeholder="College Email" required />
            <input type="text" name="phone" placeholder="Phone Number (optional)" />
            <input type="text" name="admission_number" placeholder="Admission Number (students only)" />
            <input type="password" name="password" placeholder="Password" required />
            <button class="primary-button full" type="submit">Send OTP ${icon("arrow")}</button>
          </form>
          <p style="margin-top:1rem;text-align:center">Already have an account? <a href="#" id="back-to-login-link">Sign in</a></p>
        </div>
      </section>
    </main>
  `;
}

// Step 2: OTP verification page
function otpPage(email) {
  return `
    <main class="login-page">
      <section class="login-panel" style="margin:auto">
        <div class="login-card">
          <div class="login-heading">
            <span class="brand-mark">${icon("check")}</span>
            <h2>Verify Your Email</h2>
            <p>A 6-digit OTP was sent to <strong>${escapeHTML(email)}</strong>.<br/>
               <em>(Development mode: check your server terminal)</em></p>
          </div>
          <form id="otp-form" class="login-form" style="gap:0.75rem;display:flex;flex-direction:column">
            <input type="hidden" id="otp-email" value="${escapeHTML(email)}" />
            <input type="text" id="otp-input" placeholder="Enter 6-digit OTP" maxlength="6" inputmode="numeric" required style="letter-spacing:0.3em;font-size:1.4rem;text-align:center" />
            <button class="primary-button full" type="submit">Verify & Register ${icon("arrow")}</button>
          </form>
          <p style="margin-top:1rem;text-align:center"><a href="#" id="resend-otp-link">Resend OTP</a> &nbsp;|&nbsp; <a href="#" id="back-to-register-link">Back</a></p>
        </div>
      </section>
    </main>
  `;
}
// Forgot Password — Step 1: Enter email to receive OTP
function forgotPasswordPage() {
  return `
    <main class="login-page">
      <section class="login-panel" style="margin:auto">
        <div class="login-card">
          <div class="login-heading">
            <span class="brand-mark">${icon("spark")}</span>
            <h2>Forgot Password</h2>
            <p>Enter your registered email. We'll send a 6-digit OTP to reset your password.</p>
          </div>
          <form id="forgot-password-form" class="login-form" style="gap:0.75rem;display:flex;flex-direction:column">
            <input type="email" id="forgot-email" placeholder="Your registered email" required />
            <button class="primary-button full" type="submit">Send OTP ${icon("arrow")}</button>
          </form>
          <p style="margin-top:1rem;text-align:center"><a href="#" id="back-to-login-from-forgot">Back to Sign In</a></p>
        </div>
      </section>
    </main>
  `;
}

// Forgot Password — Step 2: Enter OTP + new password
function resetPasswordPage(email) {
  return `
    <main class="login-page">
      <section class="login-panel" style="margin:auto">
        <div class="login-card">
          <div class="login-heading">
            <span class="brand-mark">${icon("check")}</span>
            <h2>Reset Password</h2>
            <p>OTP sent to <strong>${escapeHTML(email)}</strong>. Enter it below along with your new password.</p>
          </div>
          <form id="reset-password-form" class="login-form" style="gap:0.75rem;display:flex;flex-direction:column">
            <input type="hidden" id="reset-email" value="${escapeHTML(email)}" />
            <input type="text" id="reset-otp-input" placeholder="Enter 6-digit OTP" maxlength="6" inputmode="numeric" required style="letter-spacing:0.3em;font-size:1.4rem;text-align:center" />
            <input type="password" id="reset-new-password" placeholder="New Password" required />
            <input type="password" id="reset-confirm-password" placeholder="Confirm New Password" required />
            <button class="primary-button full" type="submit">Reset Password ${icon("arrow")}</button>
          </form>
          <p style="margin-top:1rem;text-align:center"><a href="#" id="resend-reset-otp-link">Resend OTP</a> &nbsp;|&nbsp; <a href="#" id="back-to-login-from-reset">Back to Sign In</a></p>
        </div>
      </section>
    </main>
  `;
}
function loginPage() {
  const role = demoUsers[selectedRole];
  return `
    <main class="login-page">
      <section class="login-story">
        <div class="story-top">
          <a class="brand brand-light" href="#" data-action="home">
            <span class="brand-mark">${icon("spark")}</span>
            <span>CampusCopilot</span>
          </a>
          <span class="tiny-pill">Verified campus intelligence</span>
        </div>
        <div class="story-copy">
          <span class="eyebrow light">One verified campus brain</span>
          <h1>College information,<br /><em>finally actionable.</em></h1>
          <p>Turn scattered notices, deadlines, questions, and campus requests into a clear next step.</p>
          <div class="story-proof">
            <div><strong>4</strong><span>verified notices</span></div>
            <div><strong>3</strong><span>role experiences</span></div>
            <div><strong>1</strong><span>source of truth</span></div>
          </div>
        </div>
        <div class="story-demo">
          <span class="demo-orb">${icon("spark")}</span>
          <div>
            <span>Ask CampusCopilot</span>
            <strong>When is the WebNova project deadline?</strong>
          </div>
          <div class="demo-answer">
            <span>${icon("check")}</span>
            <p><strong>6 June 2026.</strong> Submit the PPT, GitHub link, deployed URL, and demo video.</p>
          </div>
        </div>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <div class="mobile-brand">
            <span class="brand-mark">${icon("spark")}</span>
            <strong>CampusCopilot</strong>
          </div>
          <div class="login-heading">
            <span class="eyebrow">Role-based access</span>
            <h2>Welcome back</h2>
            <p>Select your campus role to continue.</p>
          </div>
          <div class="role-selector" role="tablist" aria-label="Select login role">
            ${[
              { role: "student", label: "Student", desc: "Learn & act",   iconName: "users"  },
              { role: "teacher", label: "Teacher", desc: "Teach & guide", iconName: "notice" },
              { role: "admin",   label: "Admin",   desc: "Manage campus", iconName: "chart"  },
            ].map(({ role: r, label, desc, iconName }) => `
                <button class="role-option ${selectedRole === r ? "active" : ""}" data-role="${r}" type="button">
                  <span class="role-symbol ${r}">${icon(iconName)}</span>
                  <span><strong>${label}</strong><small>${desc}</small></span>
                </button>`
            ).join("")}
          </div>
          <form id="login-form" class="login-form">
            <label>
              Login ID
              <input id="login-email" type="text" value="" autocomplete="username" placeholder="e.g. STU001, TCH001, ADM001" required />
            </label>
            <label>
              Password
              <input id="login-password" type="password" value="" autocomplete="current-password" required />
            </label>
            <button class="primary-button full" type="submit">
              Sign in as ${selectedRole}
              ${icon("arrow")}
            </button>
            <p style="text-align:right;margin:0.25rem 0 0"><a href="#" data-action="go-forgot-password" style="font-size:0.85rem">Forgot password?</a></p>
          </form>
          <p>Don't have an account? <a href="#" data-action="go-register">Sign Up here</a></p>
          <div class="demo-credentials">
            <span>${icon("check")}</span>
            <p><strong>Demo access is ready.</strong> Credentials update automatically when you switch roles.</p>
          </div>
        </div>
        <p class="login-footer">Built for clearer communication across the whole campus.</p>
      </section>
    </main>
  `;
}

function appShell() {
  // Use real logged-in user data, not demo placeholders
  const realUser = state.me || {};
  const displayName = realUser.name || demoUsers[session.role]?.name || 'User';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const detail = realUser.loginId || realUser.admissionNumber || demoUsers[session.role]?.detail || '';
  const displayRole = session.role;
  return `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
        <div class="sidebar-head" style="flex-shrink:0">
          <a class="brand" href="#" data-nav="overview">
            <span class="brand-mark">${icon("spark")}</span>
            <span>CampusCopilot</span>
          </a>
          <button class="icon-button mobile-only" data-action="close-sidebar" aria-label="Close menu">${icon("close")}</button>
        </div>
        <div class="campus-switcher" style="flex-shrink:0">
          <span class="campus-logo">WC</span>
          <div><strong>WebNova College</strong><small>Smart campus workspace</small></div>
          ${icon("chevron")}
        </div>
        <nav class="sidebar-nav" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:0">
          <span class="nav-label">Workspace</span>
          ${(navByRole[displayRole] || navByRole["faculty"] || [])
            .map(
              ([id, label, iconName]) => `
                <button class="nav-item ${currentPage === id ? "active" : ""}" data-nav="${id}">
                  ${icon(iconName)}
                  <span>${label}</span>
                  ${id === "questions" && openQuestions() ? `<b>${openQuestions()}</b>` : ""}
                  ${id === "moderation" && openRequests() ? `<b>${openRequests()}</b>` : ""}
                </button>`,
            )
            .join("")}
          ${(displayRole === "teacher" || displayRole === "faculty") ? `
            <span class="nav-label" style="margin-top:0.5rem">Teaching</span>
            <button class="nav-item ${currentPage === "teacher-attendance" ? "active" : ""}" data-nav="teacher-attendance">
              ${icon("check")}<span>Attendance</span>
            </button>
            <button class="nav-item ${currentPage === "teacher-marks" ? "active" : ""}" data-nav="teacher-marks">
              ${icon("chart")}<span>Marks</span>
            </button>
            <button class="nav-item ${currentPage === "teacher-assignments" ? "active" : ""}" data-nav="teacher-assignments">
              ${icon("notice")}<span>Assignments</span>
            </button>
            <button class="nav-item ${currentPage === "assistant" ? "active" : ""}" data-nav="assistant">
              ${icon("spark")}<span>AI Assistant</span>
            </button>
          ` : ""}
          ${displayRole === "student" ? `
            <span class="nav-label" style="margin-top:0.5rem">Academics</span>
            <button class="nav-item ${currentPage === "my-attendance" ? "active" : ""}" data-nav="my-attendance">
              ${icon("check")}<span>My Attendance</span>
            </button>
            <button class="nav-item ${currentPage === "my-marks" ? "active" : ""}" data-nav="my-marks">
              ${icon("chart")}<span>My Marks</span>
            </button>
          ` : ""}
        </nav>
        <div class="sidebar-card" style="flex-shrink:0">
          <span class="sidebar-card-icon">${icon(displayRole === "student" ? "spark" : displayRole === "faculty" ? "chat" : "chart")}</span>
          <strong>${displayRole === "student" ? "Need a quick answer?" : displayRole === "faculty" ? "Questions need attention" : "Campus pulse"}</strong>
          <p>${displayRole === "student" ? "Ask only from verified campus sources." : displayRole === "faculty" ? `${openQuestions()} student ${openQuestions() === 1 ? "question is" : "questions are"} waiting.` : "92% of published notices are being read."}</p>
          <button data-nav="${displayRole === "student" ? "assistant" : displayRole === "faculty" ? "questions" : "analytics"}">Open ${icon("arrow")}</button>
        </div>
        <div class="sidebar-user" style="flex-shrink:0">
          <span class="avatar">${escapeHTML(initials)}</span>
          <div><strong>${escapeHTML(displayName)}</strong><small>${escapeHTML(detail)}</small></div>
          <button class="icon-button" data-action="logout" aria-label="Log out">${icon("logout")}</button>
        </div>
      </aside>
      <div class="sidebar-overlay" data-action="close-sidebar"></div>
      <main class="main-area">
        <header class="topbar">
          <button class="icon-button mobile-only" data-action="open-sidebar" aria-label="Open menu">${icon("menu")}</button>
          <div class="topbar-title">
            <span>${todayLabel()}</span>
            <h1>${pageLabels[currentPage] || "CampusCopilot"}</h1>
          </div>
          <div class="topbar-actions">
            <label class="global-search">
              ${icon("search")}
              <input id="global-search" placeholder="Search campus" />
              <kbd>⌘ K</kbd>
            </label>
            <button class="icon-button notification-button" data-action="notifications" aria-label="Notifications">${icon("bell")}<span></span></button>
            <span class="role-badge ${session.role}">${session.role}</span>
          </div>
        </header>
        <section class="page-content">
          ${pageForRole()}
        </section>
      </main>
      ${modal ? renderModal() : ""}
    </div>
  `;
}

function pageForRole() {
  if (currentPage === "notices") return noticesPage();
  if (session.role === "student") return studentPage();
  if (session.role === "faculty" || session.role === "teacher") return teacherPage();
  return adminPage();
}

function studentPage() {
  if (currentPage === "assistant") return assistantPage();
  if (currentPage === "deadlines") return deadlinesPage();
  if (currentPage === "events") return eventsPage();
  if (currentPage === "support") return supportPage();
  if (currentPage === "my-attendance") return studentAttendancePage();
  if (currentPage === "my-marks") return studentMarksPage();
  return studentOverview();
}

function studentAttendancePage() {
  const classAttendance = (state.classAttendance || []).filter(ca => ca.studentUserId === state.me?.id);
  const subjects = [...new Set(classAttendance.map(ca => ca.subjectName))];
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">My Attendance</span><h2>Your subject-wise attendance.</h2></div>
    </div>
    ${subjects.length ? subjects.map(subjectName => {
      const records = classAttendance.filter(ca => ca.subjectName === subjectName);
      const present = records.filter(r => r.status === "Present").length;
      const total = records.length;
      const pct = total ? Math.round(present / total * 100) : 0;
      const color = pct >= 75 ? "green" : pct >= 60 ? "amber" : "coral";
      return `
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head">
            <div><h3>${escapeHTML(subjectName)}</h3><p>${present}/${total} classes attended</p></div>
            <strong style="color:var(--${color});font-size:1.5rem">${pct}%</strong>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                ${records.map(r => `<tr><td>${r.classDate}</td><td><span class="status-pill ${r.status.toLowerCase()}">${r.status}</span></td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>`;
    }).join("") : emptyState("No attendance records yet.", "Your teacher hasn't marked attendance yet.")}
  `;
}

function studentMarksPage() {
  const testMarks = (state.testMarks || []).filter(m => m.studentUserId === state.me?.id);
  const subjects = [...new Set(testMarks.map(m => m.subjectName))];
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">My Marks</span><h2>Your test scores and grades.</h2></div>
    </div>
    ${subjects.length ? subjects.map(subjectName => {
      const marks = testMarks.filter(m => m.subjectName === subjectName);
      const overall = Math.round(marks.reduce((sum, m) => sum + (m.marksObtained/m.marksTotal*100), 0) / marks.length);
      const color = overall >= 75 ? "green" : overall >= 50 ? "amber" : "coral";
      return `
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head">
            <div><h3>${escapeHTML(subjectName)}</h3><p>${marks.length} test(s)</p></div>
            <strong style="color:var(--${color});font-size:1.5rem">${overall}%</strong>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Test</th><th>Marks</th><th>Percentage</th></tr></thead>
              <tbody>
                ${marks.map(m => {
                  const pct = Math.round(m.marksObtained/m.marksTotal*100);
                  const c = pct >= 75 ? "green" : pct >= 50 ? "amber" : "coral";
                  return `<tr>
                    <td>${escapeHTML(m.testName)}</td>
                    <td>${m.marksObtained}/${m.marksTotal}</td>
                    <td><span style="color:var(--${c});font-weight:600">${pct}%</span></td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </section>`;
    }).join("") : emptyState("No marks recorded yet.", "Your teacher hasn't entered marks yet.")}
  `;
}

function studentOverview() {
  const realUser = state.me || {};
  const displayName = realUser.name || demoUsers.student.name;
  const incomplete = state.tasks.filter((task) => !task.complete);
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Student workspace</span>
        <h2>${greeting()}, ${escapeHTML(displayName.split(" ")[0])}.</h2>
        <p>You have <strong>${incomplete.length} actions</strong> to complete and <strong>2 new notices</strong> since yesterday.</p>
      </div>
      <button class="primary-button" data-nav="assistant">${icon("spark")} Ask CampusCopilot</button>
    </div>
    <div class="stat-grid four">
      ${statCard("Actions this week", incomplete.length, "2 high priority", "calendar", "coral")}
      ${statCard("Verified notices", state.notices.length, "2 new today", "notice", "blue")}
      ${statCard("Saved reminders", state.tasks.length, "Synced from notices", "check", "green")}
      ${statCard("Events near you", state.events.length, "1 already registered", "event", "violet")}
    </div>
    <div class="dashboard-grid wide-left">
      <section class="panel action-panel">
        ${panelHeader("Your next actions", "Deadlines extracted from verified notices", "View all", "deadlines")}
        <div class="task-list compact">
          ${incomplete
            .slice(0, 3)
            .map((task) => taskRow(task))
            .join("")}
        </div>
      </section>
      <section class="panel copilot-panel">
        <div class="copilot-glow"></div>
        <span class="copilot-icon">${icon("spark")}</span>
        <span class="eyebrow light">Verified AI assistant</span>
        <h3>What do you need to know?</h3>
        <p>Get a source-backed answer from notices, circulars, and events.</p>
        <div class="question-chips">
          <button data-question="When is the WebNova deadline?">WebNova deadline</button>
          <button data-question="What events are coming up?">Upcoming events</button>
        </div>
        <form class="mini-ask-form" id="overview-ask-form">
          <input id="overview-question" placeholder="Ask about campus..." />
          <button type="submit" aria-label="Ask">${icon("send")}</button>
        </form>
      </section>
    </div>
    <div class="dashboard-grid wide-right">
      <section class="panel">
        ${panelHeader("Latest verified notices", "Important updates selected for you", "Open hub", "notices")}
        <div class="notice-list">
          ${state.notices
            .slice(0, 3)
            .map((notice) => noticeRow(notice))
            .join("")}
        </div>
      </section>
      <section class="panel">
        ${panelHeader("Campus events", "Discover something useful", "Explore", "events")}
        <div class="event-mini-list">
          ${state.events
            .slice(0, 3)
            .map(
              (event) => `
                <button class="event-mini" data-event="${event.id}">
                  <span class="date-tile ${event.color}"><strong>${event.date.split(" ")[0]}</strong><small>${event.date.split(" ")[1]}</small></span>
                  <span><strong>${event.title}</strong><small>${event.time} · ${event.place}</small></span>
                  ${icon("chevron")}
                </button>`,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function noticesPage() {
  const filters = ["All", "Announcement", "Academic", "Assignment", "Event", "General"];
  const isTeacher = session.role === "teacher" || session.role === "faculty";
  const isAdmin = session.role === "admin";
  const canPublish = isTeacher || isAdmin;
  // All roles see ALL notices
  const filtered = state.notices.filter(
    (notice) =>
      (noticeFilter === "All" || notice.type === noticeFilter) &&
      `${notice.title} ${notice.summary} ${notice.department}`.toLowerCase().includes(noticeSearch.toLowerCase()),
  );
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Notice Hub</span>
        <h2>All published notices.</h2>
        <p>Every verified notice, deadline, and action from admin and teachers — in one place.</p>
      </div>
      ${canPublish ? `<button class="primary-button" data-nav="publish">${icon("plus")} Publish notice</button>` : ""}
    </div>
    <section class="panel">
      <div class="notice-toolbar">
        <label class="search-box">${icon("search")}<input id="notice-search" value="${escapeHTML(noticeSearch)}" placeholder="Search notices, departments, or actions" /></label>
        <div class="filter-tabs">
          ${filters.map((filter) => `<button data-filter="${filter}" class="${noticeFilter === filter ? "active" : ""}">${filter}</button>`).join("")}
        </div>
      </div>
      <div class="notice-card-grid">
        ${filtered.length ? filtered.map((notice) => noticeCard(notice, canPublish && notice.createdBy === session.name)).join("") : emptyState("No notices yet.", "Admin or teachers can publish notices using the button above.")}
      </div>
    </section>
  `;
}

function assistantPage() {
  return `
    <div class="welcome-row assistant-heading">
      <div>
        <span class="eyebrow">Source-backed answers</span>
        <h2>Ask your campus, not the internet.</h2>
        <p>CampusCopilot answers from verified notices and always shows where the answer came from.</p>
      </div>
      <span class="trust-chip">${icon("check")} Verified sources only</span>
    </div>
    <div class="assistant-layout">
      <section class="assistant-chat">
        <div class="chat-head">
          <div><span class="copilot-icon small">${icon("spark")}</span><span><strong>CampusCopilot</strong><small>Ready with ${state.notices.length + state.events.length} verified campus sources</small></span></div>
          <button class="ghost-button" data-action="clear-chat">Clear chat</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          ${chat
            .map(
              (message) => `
              <div class="message ${message.from}${message._loading ? ' loading' : ''}">
                ${message.from === "assistant" ? `<span class="message-avatar">${icon("spark")}</span>` : ""}
                <div>
                  <p>${message._loading ? `<span class="thinking-dots">Thinking<span>.</span><span>.</span><span>.</span></span>` : escapeHTML(message.text)}</p>
                  ${!message._loading && message.source ? `<button class="source-link" data-notice="${message.sourceId}">${icon("check")} Source: ${escapeHTML(message.source)}</button>` : ""}
                  ${!message._loading && message.deadline ? `<button class="save-answer" data-save-answer="${message.sourceId}">${icon("calendar")} Save deadline</button>` : ""}
                </div>
              </div>`,
            )
            .join("")}
        </div>
        <div class="quick-questions">
          <span>Try asking:</span>
          <button data-question="When is the WebNova deadline?">WebNova deadline</button>
          <button data-question="How do I register for exams?">Exam form</button>
          <button data-question="What events are coming up?">Upcoming events</button>
        </div>
        <form class="chat-input" id="chat-form">
          <input id="chat-question" placeholder="Ask about notices, deadlines, events..." autocomplete="off" />
          <button class="primary-button" type="submit">${icon("send")} Ask</button>
        </form>
      </section>
      <aside class="assistant-sources">
        <span class="eyebrow">Knowledge base</span>
        <h3>Verified sources</h3>
        <p>The assistant currently searches these recently published campus sources.</p>
        <div class="source-stack">
          ${state.notices
            .slice(0, 4)
            .map(
              (notice) => `
                <button data-notice="${notice.id}" class="source-card">
                  <span class="source-card-icon">${icon("notice")}</span>
                  <span><strong>${notice.title}</strong><small>${notice.source}</small></span>
                  ${icon("chevron")}
                </button>`,
            )
            .join("")}
        </div>
      </aside>
    </div>
  `;
}

function deadlinesPage() {
  const complete = state.tasks.filter((task) => task.complete).length;
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Personal action center</span>
        <h2>Turn every deadline into progress.</h2>
        <p>Your reminders are created from verified notices and stay linked to their original source.</p>
      </div>
      <button class="secondary-button" data-action="add-task">${icon("plus")} Add personal task</button>
    </div>
    <div class="progress-banner">
      <div class="progress-ring" style="--progress:${Math.round((complete / state.tasks.length) * 100)}"><span>${complete}/${state.tasks.length}</span></div>
      <div><span class="eyebrow light">Weekly progress</span><h3>You are ${complete === state.tasks.length ? "all caught up" : "making steady progress"}.</h3><p>${state.tasks.length - complete} actions are still waiting for you.</p></div>
      <div class="progress-track"><span style="width:${(complete / state.tasks.length) * 100}%"></span></div>
    </div>
    <section class="panel">
      ${panelHeader("All actions", "Check off a task when it is complete")}
      <div class="task-list large">
        ${state.tasks.map((task) => taskRow(task, true)).join("")}
      </div>
    </section>
  `;
}

function eventsPage() {
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Campus discovery</span>
        <h2>Find your next opportunity.</h2>
        <p>Seminars, workshops, sports, and career events selected from verified campus updates.</p>
      </div>
      <span class="trust-chip">${icon("event")} ${state.events.filter((event) => event.registered).length} registered</span>
    </div>
    <div class="featured-event">
      <div class="featured-copy">
        <span class="eyebrow light">Featured this week</span>
        <h3>${state.events[0].title}</h3>
        <p>A practical conversation on building useful and responsible AI products.</p>
        <div class="featured-meta"><span>${icon("calendar")} ${state.events[0].date}</span><span>${icon("clock")} ${state.events[0].time}</span></div>
        <button class="light-button" data-register="${state.events[0].id}">${state.events[0].registered ? "Registered" : "Reserve a seat"} ${icon("arrow")}</button>
      </div>
      <div class="featured-art">${icon("spark")}<span>AI</span><small>Responsible Innovation</small></div>
    </div>
    <div class="event-grid">
      ${state.events.map((event) => eventCard(event)).join("")}
    </div>
  `;
}

function supportPage() {
  const realName = (state.me?.name || session?.name || "").toLowerCase().trim();
  const mine = state.complaints.filter((item) => (item.submittedBy || "").toLowerCase().trim() === realName);
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Everyday campus utility</span>
        <h2>Report it. Track it. Resolve it.</h2>
        <p>Submit a campus request or help reconnect a lost item with its owner.</p>
      </div>
    </div>
    <div class="support-actions">
      <button class="support-action coral" data-action="new-complaint"><span>${icon("support")}</span><strong>Raise a campus request</strong><small>Facilities, IT, academics, or general help</small>${icon("arrow")}</button>
      <button class="support-action violet" data-action="new-lost"><span>${icon("search")}</span><strong>Report lost or found</strong><small>Post an item and connect with the campus</small>${icon("arrow")}</button>
    </div>
    <div class="dashboard-grid even">
      <section class="panel">
        ${panelHeader("Your requests", "Follow status updates from the administration")}
        <div class="request-list">${mine.map((item) => requestRow(item)).join("") || emptyState("No requests yet.", "Use the button above when you need help.")}</div>
      </section>
      <section class="panel">
        ${panelHeader("Lost and found board", "Recent items shared by the campus")}
        <div class="request-list">${state.lostFound.map((item) => lostRow(item)).join("")}</div>
      </section>
    </div>
  `;
}

function teacherPage() {
  if (currentPage === "publish") return publishPage("faculty");
  if (currentPage === "questions") return questionsPage();
  if (currentPage === "classes") return classesPage();
  if (currentPage === "insights") return facultyInsights();
  if (currentPage === "teacher-attendance") return teacherAttendancePage();
  if (currentPage === "teacher-marks") return teacherMarksPage();
  if (currentPage === "teacher-assignments") return teacherAssignmentsPage();
  if (currentPage === "assistant") return assistantPage();
  return teacherOverview();
}

function facultyPage() {
  return teacherPage();
}

function teacherOverview() {
  const realUser = state.me || {};
  const displayName = realUser.name || "Dr. Sharma";
  const subjects = state.subjects || [];
  const students = (state.students || []).length;
  const openQ = openQuestions();
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Teacher workspace</span>
        <h2>${greeting()}, ${escapeHTML(displayName.split(" ")[0])}.</h2>
        <p>You teach <strong>${subjects.length} subject${subjects.length !== 1 ? "s" : ""}</strong> with <strong>${students} students</strong> enrolled.</p>
      </div>
      <button class="primary-button" data-nav="publish">${icon("plus")} Publish update</button>
    </div>
    <div class="stat-grid four">
      ${statCard("Subjects", subjects.length || 0, "Assigned to you", "calendar", "blue")}
      ${statCard("Students", students, "Approved & active", "users", "violet")}
      ${statCard("Open questions", openQ, `${openQ} need response`, "chat", "coral")}
      ${statCard("Published updates", "12", "4 this month", "notice", "green")}
    </div>
    <div class="dashboard-grid even">
      <section class="panel teacher-action-card" style="cursor:pointer" data-nav="teacher-attendance">
        <span class="stat-icon blue">${icon("check")}</span>
        <div>
          <h3>Attendance</h3>
          <p>Mark class-wise attendance for each student. Track Present, Absent, Late.</p>
          <button class="primary-button" data-nav="teacher-attendance">Mark Attendance ${icon("arrow")}</button>
        </div>
      </section>
      <section class="panel teacher-action-card" style="cursor:pointer" data-nav="teacher-marks">
        <span class="stat-icon violet">${icon("chart")}</span>
        <div>
          <h3>Test Marks</h3>
          <p>Enter and update marks for unit tests, mid-semester, and finals. See class averages.</p>
          <button class="primary-button" data-nav="teacher-marks">Enter Marks ${icon("arrow")}</button>
        </div>
      </section>
      <section class="panel teacher-action-card" style="cursor:pointer" data-nav="teacher-assignments">
        <span class="stat-icon coral">${icon("notice")}</span>
        <div>
          <h3>Assignments</h3>
          <p>Create assignments, track who submitted, and give marks to each student.</p>
          <button class="primary-button" data-nav="teacher-assignments">Manage Assignments ${icon("arrow")}</button>
        </div>
      </section>
      <section class="panel">
        ${panelHeader("Questions queue", "Student questions needing answer", "View all", "questions")}
        <div class="question-list">
          ${(state.questions || []).filter((q) => q.status === "Open").slice(0, 3).map((q) => questionRow(q)).join("") || emptyState("No open questions.", "Students will post questions here.")}
        </div>
      </section>
    </div>
    <div class="dashboard-grid wide-left">
      <section class="panel">
        ${panelHeader("My subjects", "Subjects assigned to you")}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Code</th><th>Actions</th></tr></thead>
            <tbody>
              ${subjects.length ? subjects.map(s => `
                <tr>
                  <td><strong>${escapeHTML(s.name)}</strong></td>
                  <td><code>${escapeHTML(s.code)}</code></td>
                  <td>
                    <button class="ghost-button" data-nav="teacher-attendance" data-subject-id="${s.id}">${icon("check")} Attendance</button>
                    <button class="ghost-button" data-nav="teacher-marks" data-subject-id="${s.id}">${icon("chart")} Marks</button>
                  </td>
                </tr>`).join("") : `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No subjects yet. Ask admin to assign subjects.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div style="margin-top:1rem">
          <button class="secondary-button" id="add-subject-btn">${icon("plus")} Add New Subject</button>
        </div>
      </section>
      <section class="panel">
        ${panelHeader("Today's schedule", "Classes planned for today")}
        ${classSchedule(true)}
      </section>
    </div>
  `;
}

function facultyOverview() {
  return teacherOverview();
}

// ─── TEACHER ATTENDANCE PAGE ──────────────────────────────────────────────────
let attendanceSubjectFilter = "";
let attendanceDateFilter = new Date().toISOString().split("T")[0];

function teacherAttendancePage() {
  const subjects = state.subjects || [];
  const students = state.students || [];
  const classAttendance = state.classAttendance || [];

  const selectedSubject = subjects.find(s => String(s.id) === String(attendanceSubjectFilter)) || subjects[0];
  const selectedDate = attendanceDateFilter;

  // Build attendance map for current subject+date
  const attMap = {};
  classAttendance.forEach(ca => {
    if (String(ca.subjectId) === String(selectedSubject?.id) && ca.classDate === selectedDate) {
      attMap[ca.studentUserId] = ca.status;
    }
  });

  // Stats for selected subject
  const subjectRecords = classAttendance.filter(ca => String(ca.subjectId) === String(selectedSubject?.id));
  const totalClasses = [...new Set(subjectRecords.map(r => r.classDate))].length;

  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Class-wise attendance</span>
        <h2>Mark attendance for your class.</h2>
        <p>Select a subject and date, then mark each student's status.</p>
      </div>
    </div>
    <div class="attendance-controls panel" style="display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1.5rem">
      <label style="flex:1;min-width:180px">
        <span style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px">Subject</span>
        <select id="att-subject-filter" style="width:100%;padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border,#e7e8ef)">
          ${subjects.map(s => `<option value="${s.id}" ${String(s.id) === String(selectedSubject?.id) ? "selected" : ""}>${escapeHTML(s.name)} (${escapeHTML(s.code)})</option>`).join("")}
        </select>
      </label>
      <label style="flex:1;min-width:180px">
        <span style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px">Date</span>
        <input type="date" id="att-date-filter" value="${selectedDate}" style="width:100%;padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border,#e7e8ef)" />
      </label>
    </div>

    ${selectedSubject ? `
    <section class="panel">
      <div class="panel-head">
        <div><h3>${escapeHTML(selectedSubject.name)}</h3><p>${selectedDate} — ${students.length} students</p></div>
        <div style="display:flex;gap:0.5rem">
          <button class="ghost-button" id="mark-all-present">✓ All Present</button>
          <button class="primary-button" id="save-attendance-btn">${icon("check")} Save Attendance</button>
        </div>
      </div>
      <div class="table-wrap">
        <table id="attendance-table">
          <thead><tr><th>Student</th><th>Login ID</th><th>Status</th></tr></thead>
          <tbody>
            ${students.map(stu => {
              const status = attMap[stu.id] || "";
              return `<tr data-stu-id="${stu.id}">
                <td><strong>${escapeHTML(stu.name)}</strong></td>
                <td><code>${escapeHTML(stu.loginId)}</code></td>
                <td>
                  <div class="att-btn-group">
                    <button class="att-btn ${status === "Present" ? "active-present" : ""}" data-att="Present">Present</button>
                    <button class="att-btn ${status === "Absent" ? "active-absent" : ""}" data-att="Absent">Absent</button>
                    <button class="att-btn ${status === "Late" ? "active-late" : ""}" data-att="Late">Late</button>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel" style="margin-top:1.5rem">
      ${panelHeader("Attendance history", `${escapeHTML(selectedSubject.name)} — all recorded sessions`)}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Date</th><th>Status</th><th>Marked by</th></tr></thead>
          <tbody>
            ${subjectRecords.length ? subjectRecords.map(r => `
              <tr>
                <td>${escapeHTML(r.studentName)}</td>
                <td>${r.classDate}</td>
                <td><span class="status-pill ${r.status.toLowerCase()}">${r.status}</span></td>
                <td>${escapeHTML(r.markedBy || "—")}</td>
              </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted)">No records yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    ` : emptyState("No subjects found.", "Ask admin to assign a subject to you.")}
  `;
}

// ─── TEACHER MARKS PAGE ───────────────────────────────────────────────────────
let marksSubjectFilter = "";

function teacherMarksPage() {
  const subjects = state.subjects || [];
  const students = state.students || [];
  const testMarks = state.testMarks || [];

  const selectedSubject = subjects.find(s => String(s.id) === String(marksSubjectFilter)) || subjects[0];
  const subjectMarks = testMarks.filter(m => String(m.subjectId) === String(selectedSubject?.id));

  // All test names for this subject
  const testNames = [...new Set(subjectMarks.map(m => m.testName))];

  // Build pivot: student -> testName -> marks
  const pivot = {};
  students.forEach(s => { pivot[s.id] = { name: s.name, loginId: s.loginId, tests: {} }; });
  subjectMarks.forEach(m => {
    if (!pivot[m.studentUserId]) pivot[m.studentUserId] = { name: m.studentName, loginId: "—", tests: {} };
    pivot[m.studentUserId].tests[m.testName] = { obtained: m.marksObtained, total: m.marksTotal };
  });

  // Class average per test
  const avgMap = {};
  testNames.forEach(tn => {
    const vals = subjectMarks.filter(m => m.testName === tn);
    avgMap[tn] = vals.length ? Math.round(vals.reduce((sum, m) => sum + (m.marksObtained / m.marksTotal * 100), 0) / vals.length) : 0;
  });

  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Test marks</span>
        <h2>Record and track student marks.</h2>
        <p>Add test results, see class average, and identify who needs help.</p>
      </div>
      <button class="primary-button" id="add-marks-btn">${icon("plus")} Add Test / Marks</button>
    </div>

    <div class="attendance-controls panel" style="display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1.5rem">
      <label style="flex:1;min-width:200px">
        <span style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px">Subject</span>
        <select id="marks-subject-filter" style="width:100%;padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border,#e7e8ef)">
          ${subjects.map(s => `<option value="${s.id}" ${String(s.id) === String(selectedSubject?.id) ? "selected" : ""}>${escapeHTML(s.name)} (${escapeHTML(s.code)})</option>`).join("")}
        </select>
      </label>
    </div>

    ${selectedSubject ? `
    <section class="panel">
      <div class="panel-head">
        <div><h3>${escapeHTML(selectedSubject.name)}</h3><p>${testNames.length} test(s) recorded</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              ${testNames.map(tn => `<th>${escapeHTML(tn)}</th>`).join("")}
              <th>Overall %</th>
            </tr>
            <tr style="background:var(--canvas);font-size:11px;color:var(--muted)">
              <td>Class avg</td>
              ${testNames.map(tn => `<td>${avgMap[tn]}%</td>`).join("")}
              <td>—</td>
            </tr>
          </thead>
          <tbody>
            ${Object.values(pivot).map(row => {
              const allPct = testNames.map(tn => row.tests[tn] ? (row.tests[tn].obtained / row.tests[tn].total * 100) : null).filter(v => v !== null);
              const overall = allPct.length ? Math.round(allPct.reduce((a, b) => a + b, 0) / allPct.length) : "—";
              const overallClass = typeof overall === "number" ? (overall >= 75 ? "green" : overall >= 50 ? "amber" : "coral") : "";
              return `<tr>
                <td><strong>${escapeHTML(row.name)}</strong><br><small style="color:var(--muted)">${escapeHTML(row.loginId)}</small></td>
                ${testNames.map(tn => {
                  const t = row.tests[tn];
                  return t ? `<td>${t.obtained}/${t.total} <small style="color:var(--muted)">(${Math.round(t.obtained/t.total*100)}%)</small></td>` : `<td style="color:var(--muted)">—</td>`;
                }).join("")}
                <td><strong style="color:var(--${overallClass || "muted"})">${typeof overall === "number" ? overall + "%" : "—"}</strong></td>
              </tr>`;
            }).join("") || `<tr><td colspan="${testNames.length + 2}" style="text-align:center;color:var(--muted)">No marks recorded yet. Click "Add Test / Marks" to start.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Add marks modal inline -->
    <div id="marks-form-panel" style="display:none" class="panel" style="margin-top:1.5rem">
      <h3>${icon("chart")} Add / Update Marks</h3>
      <form id="marks-entry-form" style="display:flex;flex-direction:column;gap:0.75rem;max-width:480px">
        <label>Test Name<input id="marks-test-name" placeholder="e.g. Unit Test 1, Mid Semester" required /></label>
        <label>Total Marks<input id="marks-total" type="number" value="40" min="1" required /></label>
        <div id="marks-student-inputs">
          ${students.map(s => `
            <label style="display:flex;gap:0.75rem;align-items:center">
              <span style="flex:1">${escapeHTML(s.name)}</span>
              <input type="number" placeholder="—" min="0" class="marks-student-input" data-stu-id="${s.id}" style="width:80px" />
            </label>`).join("")}
        </div>
        <div style="display:flex;gap:0.75rem">
          <button class="ghost-button" type="button" id="cancel-marks-btn">Cancel</button>
          <button class="primary-button" type="submit">${icon("check")} Save Marks</button>
        </div>
      </form>
    </div>
    ` : emptyState("No subjects found.", "Ask admin to assign a subject first.")}
  `;
}

// ─── TEACHER ASSIGNMENTS PAGE ─────────────────────────────────────────────────
function teacherAssignmentsPage() {
  const subjects = state.subjects || [];
  const assignments = state.assignments || [];
  const students = state.students || [];

  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">Assignments</span>
        <h2>Create, track and grade assignments.</h2>
        <p>Set assignments per subject, track submissions, and mark grades.</p>
      </div>
      <button class="primary-button" id="create-assignment-btn">${icon("plus")} Create Assignment</button>
    </div>

    <!-- Create assignment form -->
    <div id="assignment-form-panel" style="display:none" class="panel" style="margin-bottom:1.5rem">
      <h3>${icon("notice")} New Assignment</h3>
      <form id="assignment-create-form" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;max-width:640px">
        <label style="grid-column:1/-1">Subject
          <select id="asgn-subject" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border,#e7e8ef)">
            ${subjects.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("")}
          </select>
        </label>
        <label style="grid-column:1/-1">Title<input id="asgn-title" placeholder="Assignment title" required /></label>
        <label style="grid-column:1/-1">Description<textarea id="asgn-desc" rows="2" placeholder="What should students do?"></textarea></label>
        <label>Max Marks<input id="asgn-marks" type="number" value="10" min="1" required /></label>
        <label>Due Date<input id="asgn-due" type="date" value="${new Date(Date.now() + 7*24*60*60*1000).toISOString().split("T")[0]}" required /></label>
        <div style="grid-column:1/-1;display:flex;gap:0.75rem">
          <button class="ghost-button" type="button" id="cancel-asgn-btn">Cancel</button>
          <button class="primary-button" type="submit">${icon("check")} Create Assignment</button>
        </div>
      </form>
    </div>

    <section class="panel">
      ${panelHeader("All assignments", `${assignments.length} assignment${assignments.length !== 1 ? "s" : ""} created`)}
      ${assignments.length ? assignments.map(a => `
        <div class="assignment-row" style="border:1px solid var(--line,#e7e8ef);border-radius:12px;padding:1rem;margin-bottom:0.75rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
            <div>
              <strong>${escapeHTML(a.title)}</strong>
              <span class="status-pill" style="margin-left:0.5rem;background:var(--blue-soft);color:var(--blue)">${escapeHTML(a.subjectCode)}</span>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <span style="font-size:12px;color:var(--muted)">Due: <strong>${a.dueDate}</strong></span>
              <span style="font-size:12px;color:var(--muted)">Max: <strong>${a.maxMarks} marks</strong></span>
            </div>
          </div>
          <div style="margin-top:0.75rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
            <span style="font-size:13px">
              ${icon("users")}
              <strong>${a.submitted || 0}</strong> submitted / <strong>${students.length}</strong> total
            </span>
            <div style="flex:1;height:6px;background:var(--line,#e7e8ef);border-radius:99px;min-width:80px">
              <div style="height:100%;width:${students.length ? Math.round((a.submitted||0)/students.length*100) : 0}%;background:var(--green);border-radius:99px"></div>
            </div>
            <button class="ghost-button" data-manage-assignment="${a.id}" data-assignment-title="${escapeHTML(a.title)}" data-assignment-marks="${a.maxMarks}">
              ${icon("users")} Manage Students
            </button>
          </div>
        </div>`).join("") : emptyState("No assignments yet.", "Click 'Create Assignment' to add one.")}
    </section>

    <!-- Student submission management panel -->
    <div id="asgn-students-panel" style="display:none" class="panel" style="margin-top:1.5rem">
      <div class="panel-head">
        <div><h3 id="asgn-panel-title">Assignment Students</h3><p>Mark submission status and give marks</p></div>
        <button class="ghost-button" id="close-asgn-panel">Close</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Status</th><th>Marks</th><th>Action</th></tr></thead>
          <tbody id="asgn-students-tbody"><tr><td colspan="4" style="text-align:center;color:var(--muted)">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;
}

function publishPage(role) {
  const admin = role === "admin";
  return `
    <div class="welcome-row">
      <div>
        <span class="eyebrow">${admin ? "Verified notice workflow" : "Faculty publishing"}</span>
        <h2>${admin ? "Turn a circular into clear action." : "Share one update. Answer many questions."}</h2>
        <p>${admin ? "Upload or enter campus information, review the extracted fields, and publish it to the right audience." : "Students receive a clear summary, deadline, action, and source."}</p>
      </div>
    </div>
    <div class="publish-layout">
      <form class="panel publish-form" id="publish-form">
        <div class="form-section-head"><span>01</span><div><h3>${admin ? "Notice source" : "Update details"}</h3><p>${admin ? "Upload a PDF or enter the circular details." : "Write the information students need."}</p></div></div>
        ${admin ? `<label class="upload-zone"><input id="notice-file" type="file" accept=".pdf" /><span>${icon("upload")}</span><strong>Drop a PDF notice here</strong><small>or click to select a file</small></label>` : ""}
        <div class="form-grid two">
          <label>Title<input id="publish-title" required placeholder="e.g. Project review schedule" /></label>
          <label>Type<select id="publish-type"><option>Announcement</option><option>Assignment</option><option>Academic</option><option>Event</option><option>General</option></select></label>
        </div>
        <label>Summary<textarea id="publish-summary" rows="4" required placeholder="What should students know?"></textarea></label>
        <div class="form-grid two">
          <label>Department<input id="publish-department" value="${admin ? "Campus Administration" : "Computer Science"}" required /></label>
          <label>Audience<select id="publish-audience"><option>All Students</option><option>CSE Students</option><option>Faculty</option><option>Everyone</option></select></label>
        </div>
        <div class="form-grid two">
          <label>Deadline<input id="publish-deadline" type="date" value="2026-06-12" /></label>
          <label>Priority<select id="publish-priority"><option>Medium</option><option>High</option><option>Low</option></select></label>
        </div>
        <label>Required action<input id="publish-action" required placeholder="e.g. Submit the form before the deadline" /></label>
        <div class="form-actions">
          <button class="ghost-button" type="button" data-action="save-draft">Save draft</button>
          <button class="primary-button" type="submit">${icon(admin ? "check" : "send")} ${admin ? "Verify and publish" : "Publish update"}</button>
        </div>
      </form>
      <aside class="publish-preview">
        <span class="eyebrow">Student preview</span>
        <h3>Clear before it is published.</h3>
        <p>The final notice will make the deadline and required action easy to find.</p>
        <div class="preview-card">
          <div class="notice-card-top"><span class="type-badge Academic">Academic</span><span class="verified">${icon("check")} Verified</span></div>
          <h3 id="preview-title">Your notice title</h3>
          <p id="preview-summary">The concise summary will appear here for students.</p>
          <div class="preview-deadline"><span>${icon("calendar")}</span><div><small>Deadline</small><strong id="preview-date">12 Jun 2026</strong></div></div>
          <div class="notice-action"><span>Required action</span><strong id="preview-action">Add the next step students should take.</strong></div>
          <div class="source-strip">${icon("notice")} Source: ${admin ? "Uploaded campus circular" : "Faculty verified update"}</div>
        </div>
      </aside>
    </div>
  `;
}

function questionsPage() {
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">Faculty Q&A</span><h2>Answer once. Help everyone.</h2><p>Resolve student questions and turn useful answers into reusable campus knowledge.</p></div>
      <span class="trust-chip">${icon("chat")} ${openQuestions()} open questions</span>
    </div>
    <section class="panel">
      <div class="question-page-list">
        ${state.questions.map((item) => questionCard(item)).join("")}
      </div>
    </section>
  `;
}

function classesPage() {
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">Teaching schedule</span><h2>Your week, clearly planned.</h2><p>Classes, labs, reviews, and office hours in one place.</p></div>
      <button class="secondary-button" data-action="schedule-class">${icon("plus")} Add session</button>
    </div>
    <div class="dashboard-grid wide-left">
      <section class="panel">${panelHeader("Today's classes", "Thursday, 4 June")}${classSchedule(false)}</section>
      <section class="panel">
        ${panelHeader("Course pulse", "Student engagement this week")}
        <div class="course-pulse">
          ${performanceRow("Database Systems", 88, "64 active students")}
          ${performanceRow("AI Foundations", 94, "72 active students")}
          ${performanceRow("Final Year Projects", 71, "18 active teams")}
        </div>
      </section>
    </div>
  `;
}

function facultyInsights() {
  return analyticsPage(true);
}

function adminPage() {
  if (currentPage === "notice-center") return publishPage("admin");
  if (currentPage === "users") return usersPage();
  if (currentPage === "moderation") return moderationPage();
  if (currentPage === "analytics") return analyticsPage(false);
  return adminOverview();
}

function adminOverview() {
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">Administration workspace</span><h2>${greeting()}, Rohan.</h2><p>Campus communication is healthy. <strong>92% of priority notices</strong> were read within 24 hours.</p></div>
      <button class="primary-button" data-nav="notice-center">${icon("upload")} Upload notice</button>
    </div>
    <div class="stat-grid four">
      ${statCard("Active users", "2,847", "+126 this month", "users", "blue")}
      ${statCard("Notice read rate", "92%", "+7% vs last month", "notice", "green")}
      ${statCard("Open requests", openRequests(), "1 high priority", "support", "coral")}
      ${statCard("AI questions", "1,284", "86% resolved instantly", "spark", "violet")}
    </div>
    <div class="dashboard-grid wide-left">
      <section class="panel">
        ${panelHeader("Campus activity", "A live view of important platform actions")}
        <div class="activity-list">${state.activity.map((item) => activityRow(item)).join("")}</div>
      </section>
      <section class="panel health-panel">
        <span class="eyebrow">Platform health</span>
        <div class="health-score"><strong>94</strong><span>/ 100</span></div>
        <h3>Campus communication is clear.</h3>
        <p>Verified notice reach, question resolution, and task completion are all trending up.</p>
        <div class="health-metrics">
          <span><i class="green"></i>Search healthy</span>
          <span><i class="green"></i>AI grounded</span>
          <span><i class="green"></i>Sync healthy</span>
        </div>
      </section>
    </div>
    <div class="dashboard-grid even">
      <section class="panel">
        ${panelHeader("Priority notice performance", "Latest important campus updates", "Notice center", "notice-center")}
        <div class="performance-list">
          ${state.notices
            .filter((item) => item.priority === "High")
            .map((item) => performanceRow(item.title, Math.min(98, Math.round(item.views / 14)), `${item.views} reads · ${item.saved} saved`))
            .join("")}
        </div>
      </section>
      <section class="panel">
        ${panelHeader("Requests needing attention", "Resolve everyday campus friction", "View requests", "moderation")}
        <div class="request-list">
          ${state.complaints
            .filter((item) => item.status !== "Resolved")
            .map((item) => requestRow(item, true))
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function usersPage() {
  const teachers = (state.realTeachers || []);
  const subjects = (state.allSubjects || []);
  const realUsers = (state.realUsers || state.users || []);

  return `
    <div class="welcome-row">
      <div><span class="eyebrow">Access management</span><h2>The right access for every role.</h2><p>Review students, faculty, and administrators across the campus workspace.</p></div>
      <button class="primary-button" data-action="reload-users">${icon("users")} Refresh</button>
    </div>

    <!-- Subject assignment panel -->
    <section class="panel" style="margin-bottom:1.5rem">
      <div class="panel-head">
        <div><h3>${icon("notice")} Subject Assignment</h3><p>Assign subjects to teachers</p></div>
        <button class="primary-button" style="padding:6px 16px;font-size:13px" data-action="add-subject">${icon("plus")} Add subject</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Subject</th><th>Code</th><th>Assigned Teacher</th><th>Action</th></tr></thead>
          <tbody>
            ${subjects.length ? subjects.map(s => `
              <tr>
                <td><strong>${escapeHTML(s.name)}</strong></td>
                <td><span class="role-badge student">${escapeHTML(s.code)}</span></td>
                <td>${s.teacherName ? escapeHTML(s.teacherName) : '<span style="color:var(--muted)">Unassigned</span>'}</td>
                <td>
                  <select class="assign-teacher-select" data-subject-id="${s.id}" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:13px;background:var(--surface)">
                    <option value="">-- Select teacher --</option>
                    ${teachers.map(t => `<option value="${t.id}" ${s.teacherId == t.id ? "selected" : ""}>${escapeHTML(t.name)}</option>`).join("")}
                  </select>
                  <button class="primary-button" style="padding:4px 12px;font-size:12px;margin-left:6px" data-assign-subject="${s.id}">Assign</button>
                </td>
              </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:2rem">No subjects found. Add one above.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Users list -->
    <section class="panel">
      <div class="notice-toolbar">
        <label class="search-box">${icon("search")}<input id="user-search" placeholder="Search users, roles, or departments" /></label>
        <span class="trust-chip">${icon("users")} ${realUsers.length} users</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Login ID</th><th>Status</th><th></th></tr></thead>
          <tbody id="user-table-body">
            ${realUsers.map(u => {
              const initials = u.name.split(" ").map(p => p[0]).slice(0,2).join("");
              const statusColor = u.status === "Approved" ? "green" : u.status === "Pending" ? "coral" : "muted";
              return `<tr>
                <td><div class="table-user"><span class="avatar small">${escapeHTML(initials)}</span><span><strong>${escapeHTML(u.name)}</strong><small>${escapeHTML(u.email || "")}</small></span></div></td>
                <td><span class="role-badge ${u.role}">${escapeHTML(u.role)}</span></td>
                <td style="font-size:13px;color:var(--muted)">${escapeHTML(u.loginId || u.login_id || "—")}</td>
                <td><span class="status-pill ${statusColor}">${escapeHTML(u.status || "—")}</span></td>
                <td></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function moderationPage() {
  const pendingUsers = (state.requests || []);
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">Campus operations</span><h2>Close the loop on every request.</h2><p>Track complaints, lost-and-found posts, and pending user approvals.</p></div>
      <span class="trust-chip">${icon("support")} ${openRequests()} open requests</span>
    </div>

    ${pendingUsers.length ? `
    <section class="panel" style="margin-bottom:1.5rem">
      <div class="panel-head">
        <div><h3>${icon("users")} Pending Approvals</h3><p>${pendingUsers.length} user${pendingUsers.length !== 1 ? "s" : ""} waiting for approval</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Email</th><th>Requested</th><th>Action</th></tr></thead>
          <tbody>
            ${pendingUsers.map(u => {
              const initials = u.name.split(" ").map(p => p[0]).slice(0,2).join("");
              return `<tr>
                <td><div class="table-user"><span class="avatar small">${escapeHTML(initials)}</span><strong>${escapeHTML(u.name)}</strong></div></td>
                <td><span class="role-badge ${u.role}">${u.role}</span></td>
                <td>${escapeHTML(u.email)}</td>
                <td style="font-size:12px;color:var(--muted)">${u.requestedAt ? u.requestedAt.slice(0,10) : "—"}</td>
                <td style="display:flex;gap:0.5rem">
                  <button class="primary-button" style="padding:4px 14px;font-size:13px" data-approve-user="${u.id}">Approve</button>
                  <button class="ghost-button" style="padding:4px 14px;font-size:13px;color:var(--coral)" data-reject-user="${u.id}">Reject</button>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>` : ""}

    <div class="dashboard-grid even">
      <section class="panel">
        ${panelHeader("Campus requests", "Update status as work progresses")}
        <div class="request-list">${state.complaints.map((item) => requestRow(item, true)).join("")}</div>
      </section>
      <section class="panel">
        ${panelHeader("Lost and found moderation", "Recent community posts")}
        <div class="request-list">${state.lostFound.map((item) => lostRow(item, true)).join("")}</div>
      </section>
    </div>
  `;
}

function analyticsPage(faculty) {
  const bars = faculty ? [62, 78, 68, 90, 84, 96, 86] : [52, 66, 61, 82, 76, 92, 88];
  return `
    <div class="welcome-row">
      <div><span class="eyebrow">${faculty ? "Teaching intelligence" : "Campus intelligence"}</span><h2>${faculty ? "See what students understand." : "Measure action, not just announcements."}</h2><p>${faculty ? "Use engagement patterns to improve your updates and reduce repeated questions." : "Track notice reach, AI questions, saved deadlines, and resolved requests."}</p></div>
      <button class="secondary-button" data-action="export-report">${icon("upload")} Export report</button>
    </div>
    <div class="stat-grid four">
      ${statCard(faculty ? "Content read rate" : "Priority read rate", faculty ? "86%" : "92%", "+7% this month", "notice", "green")}
      ${statCard(faculty ? "Questions resolved" : "AI resolution rate", faculty ? "74" : "86%", "+12 this week", "chat", "blue")}
      ${statCard(faculty ? "Deadlines saved" : "Actions created", faculty ? "383" : "3,462", "From verified notices", "calendar", "violet")}
      ${statCard(faculty ? "Student reach" : "Active users", faculty ? "468" : "2,847", "+4.6% this month", "users", "coral")}
    </div>
    <div class="dashboard-grid wide-left">
      <section class="panel chart-panel">
        ${panelHeader(faculty ? "Student engagement" : "Campus engagement", "Last seven days")}
        <div class="bar-chart">
          ${bars.map((height, index) => `<div><span style="height:${height}%"></span><small>${["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"][index]}</small></div>`).join("")}
        </div>
      </section>
      <section class="panel">
        ${panelHeader("Top question topics", "What the campus is asking")}
        <div class="topic-list">
          ${topicRow("Examinations & forms", 38, "blue")}
          ${topicRow("Project submissions", 27, "violet")}
          ${topicRow("Events & seminars", 21, "coral")}
          ${topicRow("Campus facilities", 14, "green")}
        </div>
      </section>
    </div>
  `;
}

function panelHeader(title, subtitle, action, nav) {
  return `<div class="panel-head"><div><h3>${title}</h3><p>${subtitle}</p></div>${action ? `<button data-nav="${nav}">${action} ${icon("arrow")}</button>` : ""}</div>`;
}

function statCard(label, value, detail, iconName, tone) {
  return `<article class="stat-card"><span class="stat-icon ${tone}">${icon(iconName)}</span><div><strong>${value}</strong><span>${label}</span><small>${detail}</small></div></article>`;
}

function noticeRow(notice) {
  return `
    <button class="notice-row" data-notice="${notice.id}">
      <span class="notice-row-icon ${notice.type.toLowerCase()}">${icon(notice.type === "Event" ? "event" : "notice")}</span>
      <span><span class="row-meta"><em>${notice.department}</em><small>${notice.published}</small></span><strong>${notice.title}</strong><small>${notice.summary}</small></span>
      ${icon("chevron")}
    </button>`;
}

function noticeCard(notice, facultyOwn = false) {
  return `
    <article class="notice-card">
      <div class="notice-card-top"><span class="type-badge ${notice.type}">${notice.type}</span><span class="verified">${icon("check")} Verified</span></div>
      <p class="notice-meta">${notice.department} · ${notice.published}</p>
      <h3>${notice.title}</h3>
      <p>${notice.summary}</p>
      <div class="deadline-strip"><span>${icon("calendar")} Deadline</span><strong>${notice.deadline}</strong></div>
      <div class="notice-action"><span>Required action</span><strong>${notice.action}</strong></div>
      <div class="notice-card-footer">
        <button class="text-button" data-notice="${notice.id}">View source ${icon("arrow")}</button>
        ${facultyOwn ? `<span class="engagement">${icon("chart")} ${notice.views} reads</span>` : `<button class="save-button" data-save="${notice.id}">${icon("calendar")} Save reminder</button>`}
      </div>
    </article>`;
}

function taskRow(task, large = false) {
  return `
    <article class="task-row ${task.complete ? "complete" : ""} ${large ? "task-large" : ""}">
      <button class="task-check" data-task="${task.id}" aria-label="${task.complete ? "Mark incomplete" : "Mark complete"}">${task.complete ? icon("check") : ""}</button>
      <div class="task-copy"><span><strong>${task.title}</strong><em class="priority ${task.priority.toLowerCase()}">${task.priority}</em></span><small>${task.detail}</small>${large ? `<button data-notice-source="${escapeHTML(task.source)}">${icon("notice")} ${task.source}</button>` : ""}</div>
      <div class="task-date"><small>Due</small><strong>${task.due}</strong></div>
    </article>`;
}

function eventCard(event) {
  return `
    <article class="event-card">
      <div class="event-art ${event.color}"><span>${event.category}</span>${icon(event.category === "Sports" ? "users" : event.category === "Seminar" ? "spark" : "event")}</div>
      <div class="event-card-body">
        <span class="event-dept">${event.department}</span>
        <h3>${event.title}</h3>
        <div class="event-details"><span>${icon("calendar")} ${event.date}</span><span>${icon("clock")} ${event.time}</span><span>${icon("home")} ${event.place}</span></div>
        <div class="event-card-footer"><small>${event.seats} seats available</small><button class="${event.registered ? "registered" : ""}" data-register="${event.id}">${event.registered ? "Registered" : "Register"}</button></div>
      </div>
    </article>`;
}

function requestRow(item, admin = false) {
  return `
    <article class="request-row">
      <span class="request-icon">${icon("support")}</span>
      <div><span><strong>${item.title}</strong><em class="status ${item.status.toLowerCase().replaceAll(" ", "-")}">${item.status}</em></span><small>${item.category} · ${item.submittedBy} · ${item.submitted}</small></div>
      ${admin && item.status !== "Resolved" ? `<button class="text-button" data-resolve="${item.id}">Resolve</button>` : ""}
    </article>`;
}

function lostRow(item, admin = false) {
  return `
    <article class="request-row">
      <span class="request-icon lost">${icon("search")}</span>
      <div><span><strong>${item.item}</strong><em class="status ${item.type.toLowerCase()}">${item.type}</em></span><small>${item.place} · ${item.date} · ${item.contact}</small></div>
      ${admin ? `<button class="text-button" data-close-lost="${item.id}">${item.status === "Closed" ? "Closed" : "Close"}</button>` : ""}
    </article>`;
}

function questionRow(item) {
  return `<article class="question-row"><span class="avatar small">${item.initials}</span><div><strong>${item.question}</strong><small>${item.student} · ${item.course} · ${item.asked}</small></div><button data-answer="${item.id}">Answer ${icon("arrow")}</button></article>`;
}

function questionCard(item) {
  return `
    <article class="question-card">
      <div class="question-card-head"><span class="avatar">${item.initials}</span><div><strong>${item.student}</strong><small>${item.course} · ${item.asked}</small></div><em class="status ${item.status.toLowerCase()}">${item.status}</em></div>
      <h3>${item.question}</h3>
      ${item.answer ? `<div class="answer-block"><span>${icon("check")} Your answer</span><p>${item.answer}</p></div>` : `<button class="primary-button small-button" data-answer="${item.id}">${icon("chat")} Write answer</button>`}
    </article>`;
}

function classSchedule(compact) {
  const classes = [
    ["09:00", "Database Systems", "C-204", "Lecture", "blue"],
    ["11:30", "AI Foundations", "Lab 3", "Practical", "violet"],
    ["14:00", "Final Year Project Reviews", "Meeting Room 2", "Review", "coral"],
  ];
  return `<div class="class-list ${compact ? "compact" : ""}">${classes
    .map(
      ([time, title, place, type, tone]) => `
        <article class="class-row"><span class="class-time">${time}</span><i class="${tone}"></i><div><strong>${title}</strong><small>${type} · ${place}</small></div><button>${icon("chevron")}</button></article>`,
    )
    .join("")}</div>`;
}

function performanceRow(title, percentage, detail) {
  return `<div class="performance-row"><div><span><strong>${title}</strong><em>${percentage}%</em></span><small>${detail}</small></div><div class="performance-track"><span style="width:${percentage}%"></span></div></div>`;
}

function activityRow(item) {
  return `<article class="activity-row"><span class="activity-dot ${item.tone}"></span><div><strong>${item.title}</strong><small>${item.detail}</small></div><time>${item.time}</time></article>`;
}

function topicRow(label, percentage, tone) {
  return `<div class="topic-row"><span class="${tone}">${percentage}%</span><div><strong>${label}</strong><div class="performance-track"><i style="width:${percentage * 2}%"></i></div></div></div>`;
}

function userRow(user) {
  const initials = user.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const actionButtons = user.status === "Pending"
    ? `<button class="text-button" style="color:var(--green)" data-approve-user="${user.id}">Approve</button>
       <button class="text-button" style="color:var(--coral)" data-reject-user="${user.id}">Reject</button>`
    : `<button class="text-button" data-toggle-user="${user.id}">${user.status === "Active" ? "Suspend" : "Activate"}</button>`;
  return `<tr data-user-row="${user.id}">
    <td><div class="table-user"><span class="avatar small">${initials}</span><span><strong>${escapeHTML(user.name)}</strong><small>${escapeHTML(user.email)}</small></span></div></td>
    <td><span class="role-badge ${user.role.toLowerCase()}">${user.role}</span></td>
    <td>${escapeHTML(user.department || "—")}</td>
    <td><em class="status ${user.status.toLowerCase()}">${user.status}</em></td>
    <td>${escapeHTML(user.lastSeen || "—")}</td>
    <td style="display:flex;gap:0.5rem">${actionButtons}</td>
  </tr>`;
}

function emptyState(title, text) {
  return `<div class="empty-state"><span>${icon("search")}</span><strong>${title}</strong><p>${text}</p></div>`;
}

function renderModal() {
  if (modal.type === "notice") {
    const notice = state.notices.find((item) => item.id === modal.id);
    if (!notice) return "";
    return modalFrame(
      `
      <div class="modal-hero">
        <div><span class="type-badge ${notice.type}">${notice.type}</span><span class="verified">${icon("check")} Verified campus source</span></div>
        <h2>${notice.title}</h2>
        <p>${notice.department} · Published ${notice.published}</p>
      </div>
      <div class="modal-body">
        <span class="eyebrow">AI summary</span>
        <p class="modal-summary">${notice.summary}</p>
        <div class="modal-action-grid">
          <div><span>${icon("calendar")}</span><small>Deadline</small><strong>${notice.deadline}</strong></div>
          <div><span>${icon("users")}</span><small>Audience</small><strong>${notice.audience}</strong></div>
        </div>
        <div class="notice-action large"><span>Required action</span><strong>${notice.action}</strong></div>
        <div class="source-strip">${icon("notice")} Original source: ${notice.source}</div>
      </div>
      <div class="modal-footer"><button class="ghost-button" data-action="close-modal">Close</button>${session.role === "student" ? `<button class="primary-button" data-save="${notice.id}">${icon("calendar")} Save deadline</button>` : ""}</div>`,
    );
  }

  if (modal.type === "answer") {
    const question = state.questions.find((item) => item.id === modal.id);
    return modalFrame(`
      <form id="answer-form">
        <div class="modal-body">
          <span class="eyebrow">Student question</span><h2>${question.question}</h2><p>${question.student} · ${question.course}</p>
          <label>Your answer<textarea id="answer-text" rows="5" required placeholder="Write a clear answer students can reuse...">${escapeHTML(question.answer)}</textarea></label>
          <label class="checkbox-label"><input id="share-answer" type="checkbox" checked /> Add this answer to the verified knowledge base</label>
        </div>
        <div class="modal-footer"><button class="ghost-button" type="button" data-action="close-modal">Cancel</button><button class="primary-button" type="submit">${icon("send")} Publish answer</button></div>
      </form>`);
  }

  const forms = {
    complaint: {
      eyebrow: "New campus request",
      title: "What needs attention?",
      fields: `<label>Request title<input id="modal-title" required placeholder="Briefly describe the issue" /></label><label>Category<select id="modal-category"><option>Infrastructure</option><option>IT Services</option><option>Facilities</option><option>Academic</option><option>General</option></select></label><label>Details<textarea id="modal-detail" rows="4" required placeholder="Add useful details, location, or context"></textarea></label>`,
      button: "Submit request",
    },
    lost: {
      eyebrow: "Lost and found",
      title: "Help an item find its way back.",
      fields: `<label>Item<input id="modal-title" required placeholder="e.g. Black scientific calculator" /></label><label>Type<select id="modal-category"><option>Lost</option><option>Found</option></select></label><label>Location<input id="modal-detail" required placeholder="Where was it lost or found?" /></label>`,
      button: "Publish item",
    },
    task: {
      eyebrow: "Personal reminder",
      title: "Add an action to your list.",
      fields: `<label>Task title<input id="modal-title" required placeholder="What do you need to do?" /></label><label>Deadline<input id="modal-category" type="date" value="2026-06-15" required /></label><label>Details<textarea id="modal-detail" rows="3" placeholder="Optional context"></textarea></label>`,
      button: "Add task",
    },
    "add-teacher": {
      eyebrow: "Add new teacher",
      title: "Create a teacher account.",
      fields: `<label>Full Name<input id="modal-title" required placeholder="e.g. Dr. Anita Singh" /></label><label>Email<input id="modal-category" type="email" required placeholder="teacher@college.edu" /></label><label>Temporary Password<input id="modal-detail" type="password" required placeholder="Min 6 characters" /></label>`,
      button: "Create Teacher",
    },
  };
  const config = forms[modal.type];
  if (!config) return "";
  return modalFrame(`
    <form id="utility-form">
      <div class="modal-body"><span class="eyebrow">${config.eyebrow}</span><h2>${config.title}</h2><div class="utility-fields">${config.fields}</div></div>
      <div class="modal-footer"><button class="ghost-button" type="button" data-action="close-modal">Cancel</button><button class="primary-button" type="submit">${icon("check")} ${config.button}</button></div>
    </form>`);};

function modalFrame(content) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="CampusCopilot dialog" data-modal-box>${content}<button class="modal-close icon-button" data-action="close-modal" aria-label="Close">${icon("close")}</button></section></div>`;
}

function openQuestions() {
  return state.questions.filter((item) => item.status === "Open").length;
}

function openRequests() {
  return state.complaints.filter((item) => item.status !== "Resolved").length;
}

function formatDate(dateISO) {
  if (!dateISO) return "No deadline";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateISO}T12:00:00`));
}

async function findAnswer(question) {
  // Build context from campus data
  const noticesContext = state.notices.map(n =>
    `[${n.id}] ${n.title} (${n.department}, ${n.type}, Priority: ${n.priority})\nSummary: ${n.summary}\nDeadline: ${n.deadline}\nAction: ${n.action}\nSource: ${n.source}`
  ).join("\n\n");

  const eventsContext = state.events.map(e =>
    `${e.title} — ${e.date} at ${e.time}, ${e.place} (${e.category}, ${e.department})`
  ).join("\n");

  const tasksContext = state.tasks.map(t =>
    `${t.title}: due ${t.due}, priority ${t.priority}, ${t.complete ? "completed" : "pending"}`
  ).join("\n");

  const systemPrompt = `You are CampusCopilot, a helpful AI assistant for WebNova College for students, teachers, and admins.

CAMPUS DATA (notices, deadlines, events): Answer from the verified data provided below. Always mention the source notice ID (e.g. "Source: notice-002").

For TEACHERS you can help with:
- Creating test papers, question banks, MCQs, short/long answer questions on any topic
- Designing assignments, rubrics, and grading criteria
- Suggesting teaching strategies and lesson plans
- Summarizing topics to explain to students
- Generating viva questions and practical exam ideas

For STUDENTS you can help with:
- Explaining any concept, topic, or subject (science, math, history, coding, etc.)
- Summarizing study material the student pastes
- Answering general knowledge and academic questions
- Helping understand notices, deadlines, and campus events

For ADMINS you can help with:
- Drafting official notices and circulars
- Suggesting campus management improvements
- Summarizing reports or documents

Always be friendly, helpful, and concise. Never refuse a genuine academic or campus-related request.

=== VERIFIED CAMPUS NOTICES ===
${noticesContext}

=== UPCOMING EVENTS ===
${eventsContext}

=== STUDENT TASKS / DEADLINES ===
${tasksContext}

Rules:
- Answer only from the data above. If the answer isn't in the data, say so.
- Keep answers short (2-4 sentences max).
- If a deadline is mentioned, always state it clearly.
- If an action is required, state it explicitly.
- End with the source notice ID if applicable (e.g. "Source: notice-002").`;

  try {
    const sessionData = loadSession();
    const authToken = sessionData?.token || null;

    const response = await fetch(API_BASE + "/api/ai/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ question, context: { systemPrompt } }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "API error");

    const text = data.text || "Sorry, I could not get an answer right now.";

    // Try to find a matching notice ID mentioned in the response
    const mentionedId = state.notices.find(n => text.includes(n.id))?.id || null;
    const matchedNotice = mentionedId ? state.notices.find(n => n.id === mentionedId) : null;

    return {
      text,
      source: matchedNotice?.source || null,
      sourceId: mentionedId,
      deadline: matchedNotice ? Boolean(matchedNotice.deadlineISO) : false,
    };
  } catch (err) {
    console.error("AI API error:", err);
    // Show actual error message so user knows what's wrong
    const msg = err.message?.includes("401") ? "API key invalid or expired. Check your ANTHROPIC_API_KEY."
      : err.message?.includes("ANTHROPIC_API_KEY") ? "AI API key not set on server. Restart server with ANTHROPIC_API_KEY set."
      : err.message?.includes("fetch") ? "Cannot reach Anthropic API. Check your internet connection."
      : `AI error: ${err.message || "Unknown error"}`;
    return { text: msg };
  }
}
function bindEvents() {
  // 1. Role selection
  document.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      render();
    });
  });

  // 2. Register Form → Request OTP (Step 1)
  document.querySelector("#register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(API_BASE + "/api/register/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (response.ok) {
        pendingOtpEmail = data.email;
        currentPage = "otp";
        render();
        showToast("OTP sent! Check your email (or server terminal in dev mode).");
      } else {
        showToast(result.error || "Registration failed!", "error");
      }
    } catch {
      showToast("Could not connect to server.", "error");
    }
  });

  // 3. OTP Form → Verify & Create Account (Step 2)
  document.querySelector("#otp-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#otp-email")?.value;
    const otp = document.querySelector("#otp-input")?.value.trim();

    try {
      const response = await fetch(API_BASE + "/api/register/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const result = await response.json();
      if (response.ok) {
        pendingOtpEmail = "";
        currentPage = "login";
        render();
        if (result.autoApproved) {
          // Known user — directly approved, show their login ID
          showToast(`Account ready! Your Login ID is ${result.loginId}. Sign in now.`);
        } else {
          // Unknown user — needs admin to approve first
          showToast("Request submitted! Wait for Admin approval. You'll get your Login ID once approved.");
        }
      } else {
        showToast(result.error || "OTP verification failed!", "error");
      }
    } catch {
      showToast("Could not connect to server.", "error");
    }
  });

  // 3b. Back to login from register page
  document.querySelector("#back-to-login-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    currentPage = "login";
    render();
  });

  // 3c. Back to register from OTP page
  document.querySelector("#back-to-register-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    currentPage = "register";
    render();
  });

  // 3d. Resend OTP
  document.querySelector("#resend-otp-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!pendingOtpEmail) { showToast("Go back and fill in the form again.", "error"); return; }
    try {
      const response = await fetch(API_BASE + "/api/register/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingOtpEmail }),
      });
      if (response.ok) showToast("New OTP sent!");
      else showToast("Could not resend OTP.", "error");
    } catch {
      showToast("Server error.", "error");
    }
  });

  // 4a. Forgot Password — request OTP
  document.querySelector("#forgot-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#forgot-email").value.trim();
    try {
      const response = await fetch(API_BASE + "/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (response.ok) {
        pendingOtpEmail = email;
        currentPage = "reset-password";
        render();
        showToast("OTP sent! Check your email (or server terminal in dev mode).");
      } else {
        showToast(result.error || "Could not send OTP.", "error");
      }
    } catch {
      showToast("Could not connect to server.", "error");
    }
  });

  document.querySelector("#back-to-login-from-forgot")?.addEventListener("click", (e) => {
    e.preventDefault();
    currentPage = "login";
    render();
  });

  // 4b. Reset Password — verify OTP + set new password
  document.querySelector("#reset-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#reset-email").value;
    const otp = document.querySelector("#reset-otp-input").value.trim();
    const newPassword = document.querySelector("#reset-new-password").value;
    const confirmPassword = document.querySelector("#reset-confirm-password").value;

    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match!", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    try {
      const response = await fetch(API_BASE + "/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const result = await response.json();
      if (response.ok) {
        pendingOtpEmail = "";
        currentPage = "login";
        render();
        showToast("Password reset successful! Sign in with your new password.");
      } else {
        showToast(result.error || "Could not reset password.", "error");
      }
    } catch {
      showToast("Could not connect to server.", "error");
    }
  });

  document.querySelector("#resend-reset-otp-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!pendingOtpEmail) { showToast("Go back and enter your email again.", "error"); return; }
    try {
      const response = await fetch(API_BASE + "/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingOtpEmail }),
      });
      if (response.ok) showToast("New OTP sent!");
      else showToast("Could not resend OTP.", "error");
    } catch {
      showToast("Server error.", "error");
    }
  });

  document.querySelector("#back-to-login-from-reset")?.addEventListener("click", (e) => {
    e.preventDefault();
    pendingOtpEmail = "";
    currentPage = "login";
    render();
  });

  // 4. Login Form
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const role = selectedRole;
    const login_id = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;

    try {
      const response = await fetch(API_BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, login_id, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login failed");

      saveSession({ token: result.token, role: result.user.role, userId: result.user.id, name: result.user.name });
      // Reset chat with the real logged-in user's name
      chat = initChat();
      await refreshState();
      currentPage = "overview";
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
      showToast(`Welcome to your ${role} workspace.`);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      currentPage = button.dataset.nav;
      document.body.classList.remove("sidebar-open");
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", (event) => handleAction(button.dataset.action, event));
  });

  document.querySelectorAll("[data-assign-subject]").forEach((button) => {
    button.addEventListener("click", () => handleAction(null, null, button));
  });

  document.querySelectorAll("[data-notice]").forEach((button) => {
    button.addEventListener("click", () => {
      modal = { type: "notice", id: button.dataset.notice };
      render();
    });
  });

  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => saveNoticeAsTask(button.dataset.save));
  });

  document.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      const task = state.tasks.find((item) => item.id === button.dataset.task);
      const complete = !task.complete;
      await mutate(
        `/api/tasks/${encodeURIComponent(task.id)}`,
        { method: "PATCH", body: { complete } },
        complete ? "Task marked complete." : "Task moved back to your list.",
      );
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      noticeFilter = button.dataset.filter;
      render();
    });
  });

  document.querySelector("#notice-search")?.addEventListener("input", (event) => {
    noticeSearch = event.target.value;
    render();
    const input = document.querySelector("#notice-search");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  document.querySelector("#global-search")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const query = event.target.value.trim();
    if (!query) return;
    noticeSearch = query;
    noticeFilter = "All";
    currentPage = "notices";
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => askQuestion(button.dataset.question));
  });

  document.querySelector("#overview-ask-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    askQuestion(document.querySelector("#overview-question").value);
  });

  document.querySelector("#chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    askQuestion(document.querySelector("#chat-question").value);
  });

  document.querySelectorAll("[data-save-answer]").forEach((button) => {
    button.addEventListener("click", () => saveNoticeAsTask(button.dataset.saveAnswer));
  });

  document.querySelectorAll("[data-register]").forEach((button) => {
    button.addEventListener("click", async () => {
      const event = state.events.find((item) => item.id === button.dataset.register);
      const registered = !event.registered;
      await mutate(
        `/api/events/${encodeURIComponent(event.id)}/registration`,
        { method: "PATCH", body: { registered } },
        registered ? `Registered for ${event.title}.` : `Registration cancelled for ${event.title}.`,
      );
    });
  });

  document.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      modal = { type: "answer", id: button.dataset.answer };
      render();
    });
  });

  document.querySelector("#answer-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = state.questions.find((item) => item.id === modal.id);
    const answer = document.querySelector("#answer-text").value.trim();
    const saved = await mutate(
      `/api/questions/${encodeURIComponent(question.id)}/answer`,
      { method: "PATCH", body: { answer } },
      "Answer published to the student.",
    );
    if (saved) modal = null;
    render();
  });

  document.querySelector("#publish-form")?.addEventListener("submit", handlePublish);
  ["title", "summary", "action", "deadline"].forEach((field) => {
    document.querySelector(`#publish-${field}`)?.addEventListener("input", updatePreview);
  });

  document.querySelector("#utility-form")?.addEventListener("submit", handleUtilityForm);

  document.querySelectorAll("[data-resolve]").forEach((button) => {
    button.addEventListener("click", async () => {
      await mutate(
        `/api/complaints/${encodeURIComponent(button.dataset.resolve)}/resolve`,
        { method: "PATCH" },
        "Request marked resolved.",
      );
    });
  });

  document.querySelectorAll("[data-close-lost]").forEach((button) => {
    button.addEventListener("click", async () => {
      await mutate(
        `/api/lost-found/${encodeURIComponent(button.dataset.closeLost)}/close`,
        { method: "PATCH" },
        "Lost and found post closed.",
      );
    });
    // Yeh line add karo:
  });

  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = state.users.find((item) => item.id === button.dataset.toggleUser);
      const status = user.status === "Active" ? "Suspended" : "Active";
      await mutate(
        `/api/users/${encodeURIComponent(user.id)}/status`,
        { method: "PATCH", body: { status } },
        `${user.name} is now ${status.toLowerCase()}.`,
      );
    });
  });

  document.querySelectorAll("[data-approve-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = Number(button.dataset.approveUser);
      const user = state.users.find((u) => u.id === userId);
      await mutate(
        `/api/moderation/approve/${userId}`,
        { method: "POST" },
        `${user?.name || "User"} approved successfully!`,
      );
    });
  });

  document.querySelectorAll("[data-reject-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = Number(button.dataset.rejectUser);
      const user = state.users.find((u) => u.id === userId);
      if (!confirm(`Reject ${user?.name || "this user"}?`)) return;
      await mutate(
        `/api/moderation/reject/${userId}`,
        { method: "POST" },
        `${user?.name || "User"} rejected.`,
      );
    });
  });

  document.querySelector("#user-search")?.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll("[data-user-row]").forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  });

  document.querySelector("[data-modal-box]")?.addEventListener("click", (event) => event.stopPropagation());

  // ── TEACHER: Attendance page controls ─────────────────────────────────────
  document.querySelector("#att-subject-filter")?.addEventListener("change", (e) => {
    attendanceSubjectFilter = e.target.value;
    render();
  });
  document.querySelector("#att-date-filter")?.addEventListener("change", (e) => {
    attendanceDateFilter = e.target.value;
    render();
  });
  document.querySelector("#mark-all-present")?.addEventListener("click", () => {
    document.querySelectorAll("#attendance-table tbody tr").forEach(row => {
      row.querySelectorAll(".att-btn").forEach(b => b.classList.remove("active-present","active-absent","active-late"));
      row.querySelector('[data-att="Present"]')?.classList.add("active-present");
    });
  });
  document.querySelectorAll(".att-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      row.querySelectorAll(".att-btn").forEach(b => b.classList.remove("active-present","active-absent","active-late"));
      const status = btn.dataset.att;
      btn.classList.add(status === "Present" ? "active-present" : status === "Absent" ? "active-absent" : "active-late");
    });
  });
  document.querySelector("#save-attendance-btn")?.addEventListener("click", async () => {
    const subjectEl = document.querySelector("#att-subject-filter");
    const dateEl = document.querySelector("#att-date-filter");
    const subjectId = subjectEl?.value;
    const classDate = dateEl?.value;
    if (!subjectId || !classDate) { showToast("Select subject and date first.", "error"); return; }
    const records = [];
    document.querySelectorAll("#attendance-table tbody tr").forEach(row => {
      const stuId = row.dataset.stuId;
      const activeBtn = row.querySelector(".att-btn.active-present, .att-btn.active-absent, .att-btn.active-late");
      if (stuId && activeBtn) {
        records.push({ studentUserId: Number(stuId), subjectId: Number(subjectId), classDate, status: activeBtn.dataset.att });
      }
    });
    if (!records.length) { showToast("Mark at least one student's status.", "error"); return; }
    await mutate("/api/class-attendance", { method: "POST", body: records }, `Attendance saved for ${records.length} students.`);
  });

  // ── TEACHER: Add subject ───────────────────────────────────────────────────
  document.querySelector("#add-subject-btn")?.addEventListener("click", async () => {
    const name = prompt("Subject name (e.g. Mathematics):");
    if (!name) return;
    const code = prompt("Subject code (e.g. MA101):");
    if (!code) return;
    await mutate("/api/subjects", { method: "POST", body: { name, code } }, `Subject "${name}" added.`);
  });

  // ── TEACHER: Marks page controls ──────────────────────────────────────────
  document.querySelector("#marks-subject-filter")?.addEventListener("change", (e) => {
    marksSubjectFilter = e.target.value;
    render();
  });
  document.querySelector("#add-marks-btn")?.addEventListener("click", () => {
    const panel = document.querySelector("#marks-form-panel");
    if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.querySelector("#cancel-marks-btn")?.addEventListener("click", () => {
    const panel = document.querySelector("#marks-form-panel");
    if (panel) panel.style.display = "none";
  });
  document.querySelector("#marks-entry-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subjectId = Number(document.querySelector("#marks-subject-filter")?.value);
    const testName = document.querySelector("#marks-test-name")?.value.trim();
    const marksTotal = Number(document.querySelector("#marks-total")?.value);
    if (!subjectId || !testName || !marksTotal) { showToast("Fill all fields.", "error"); return; }
    const records = [];
    document.querySelectorAll(".marks-student-input").forEach(inp => {
      const val = inp.value.trim();
      if (val !== "") {
        records.push({ studentUserId: Number(inp.dataset.stuId), subjectId, testName, marksObtained: Number(val), marksTotal });
      }
    });
    if (!records.length) { showToast("Enter at least one student's marks.", "error"); return; }
    await mutate("/api/marks", { method: "POST", body: records }, `Marks saved for ${records.length} students.`);
  });

  // ── TEACHER: Assignments page controls ────────────────────────────────────
  document.querySelector("#create-assignment-btn")?.addEventListener("click", () => {
    const panel = document.querySelector("#assignment-form-panel");
    if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.querySelector("#cancel-asgn-btn")?.addEventListener("click", () => {
    const panel = document.querySelector("#assignment-form-panel");
    if (panel) panel.style.display = "none";
  });
  document.querySelector("#assignment-create-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subjectId = Number(document.querySelector("#asgn-subject")?.value);
    const title = document.querySelector("#asgn-title")?.value.trim();
    const description = document.querySelector("#asgn-desc")?.value.trim();
    const maxMarks = Number(document.querySelector("#asgn-marks")?.value);
    const dueDate = document.querySelector("#asgn-due")?.value;
    if (!subjectId || !title || !dueDate) { showToast("Fill all required fields.", "error"); return; }
    await mutate("/api/assignments", { method: "POST", body: { subjectId, title, description, maxMarks, dueDate } }, "Assignment created.");
  });
  document.querySelectorAll("[data-manage-assignment]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const assignmentId = btn.dataset.manageAssignment;
      const title = btn.dataset.assignmentTitle;
      const maxMarks = Number(btn.dataset.assignmentMarks);
      document.querySelector("#asgn-panel-title").textContent = `Students — ${title}`;
      document.querySelector("#asgn-students-panel").style.display = "block";
      const res = await api(`/api/assignments/${assignmentId}/students`);
      const tbody = document.querySelector("#asgn-students-tbody");
      tbody.innerHTML = res.students.map(s => `
        <tr data-stu-id="${s.id}">
          <td><strong>${escapeHTML(s.name)}</strong> <small style="color:var(--muted)">${escapeHTML(s.loginId)}</small></td>
          <td>
            <select class="sub-status-sel" style="padding:4px 8px;border-radius:6px;border:1px solid var(--line,#e7e8ef)">
              <option value="Pending" ${s.status==="Pending"?"selected":""}>Pending</option>
              <option value="Submitted" ${s.status==="Submitted"?"selected":""}>Submitted</option>
              <option value="Late" ${s.status==="Late"?"selected":""}>Late</option>
            </select>
          </td>
          <td><input type="number" class="sub-marks-inp" value="${s.marksObtained ?? ""}" placeholder="—" min="0" max="${maxMarks}" style="width:70px;padding:4px;border-radius:6px;border:1px solid var(--line,#e7e8ef)" /></td>
          <td><button class="ghost-button save-sub-btn" data-assignment-id="${assignmentId}" data-stu-id="${s.id}">Save</button></td>
        </tr>`).join("");
      // Bind save buttons
      tbody.querySelectorAll(".save-sub-btn").forEach(saveBtn => {
        saveBtn.addEventListener("click", async () => {
          const row = saveBtn.closest("tr");
          const stuId = Number(saveBtn.dataset.stuId);
          const aId = Number(saveBtn.dataset.assignmentId);
          const status = row.querySelector(".sub-status-sel").value;
          const marksObtained = row.querySelector(".sub-marks-inp").value !== "" ? Number(row.querySelector(".sub-marks-inp").value) : null;
          await mutate(`/api/assignments/${aId}/submission`, { method: "POST", body: { studentUserId: stuId, status, marksObtained } }, "Submission updated.");
        });
      });
    });
  });
  document.querySelector("#close-asgn-panel")?.addEventListener("click", () => {
    const panel = document.querySelector("#asgn-students-panel");
    if (panel) panel.style.display = "none";
  });
}

async function handleAction(action, event, button = event?.target?.closest('[data-assign-subject]') || event?.currentTarget) {
  if (action === "go-register") {
    currentPage = "register";
    render();
    return;
  }
  if (action === "go-forgot-password") {
    currentPage = "forgot-password";
    render();
    return;
  }
  if (action === "logout") {
    try {
      await api(API_BASE + "/api/auth/logout", { method: "POST" });
    } catch {
      // A local sign-out should still succeed if the server session already expired.
    }
    saveSession(null);
    currentPage = "overview";
    render();
    showToast("You have been signed out.");
  }
  if (action === "open-sidebar") document.body.classList.add("sidebar-open");
  if (action === "close-sidebar") document.body.classList.remove("sidebar-open");
  if (action === "close-modal") {
    event?.stopPropagation();
    modal = null;
    render();
  }
  if (action === "clear-chat") {
    chat = [{ from: "assistant", text: "Chat cleared. What would you like to know about campus?" }];
    render();
  }
  if (action === "new-complaint") {
    modal = { type: "complaint" };
    render();
  }
  if (action === "new-lost") {
    modal = { type: "lost" };
    render();
  }
  if (action === "add-task") {
    modal = { type: "task" };
    render();
  }
  if (action === "save-draft") showToast("Draft saved locally.");
  if (action === "schedule-class") showToast("Schedule creation is ready for backend integration.");
  if (action === "add-user") {
    modal = { type: "add-teacher" };
    render();
    return;
  }
  if (action === "export-report") showToast("Analytics report prepared for export.");
  if (action === "notifications") showToast("You are all caught up on important notifications.");
  if (action === "reload-users") { await refreshState(); render(); showToast("Users refreshed."); }

  // Add new subject
  if (action === "add-subject") {
    const name = prompt("Subject name (e.g. Data Structures):");
    if (!name) return;
    const code = prompt("Subject code (e.g. CS302):");
    if (!code) return;
    const teachers = state.realTeachers || [];
    const teacherList = teachers.map((t, i) => `${i+1}. ${t.name}`).join("\n");
    const idx = prompt(`Assign teacher (enter number):\n${teacherList}\n0. Leave unassigned`);
    const teacherId = idx && parseInt(idx) > 0 ? teachers[parseInt(idx)-1]?.id : null;
    await mutate("/api/admin/subjects", {
      method: "POST",
      body: { name: name.trim(), code: code.trim().toUpperCase(), teacherId },
    }, `Subject "${name}" added.`);
  }

  // Assign subject to teacher
  if (button?.dataset?.assignSubject) {
    const subjectId = button.dataset.assignSubject;
    const select = document.querySelector(`.assign-teacher-select[data-subject-id="${subjectId}"]`);
    const teacherId = select?.value ? parseInt(select.value) : null;
    if (!teacherId) { showToast("Please select a teacher first.", "error"); return; }
    await mutate(`/api/admin/subjects/${subjectId}/assign`, {
      method: "PATCH",
      body: { teacherId },
    }, "Subject assigned successfully.");
  }
}

async function askQuestion(question) {
  const text = question?.trim();
  if (!text) {
    showToast("Type a campus question first.", "error");
    return;
  }
  // Add user message and a "thinking" placeholder immediately
  chat.push({ from: "user", text });
  chat.push({ from: "assistant", text: "Thinking…", _loading: true });
  currentPage = "assistant";
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    const messages = document.querySelector("#chat-messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  });

  // Call AI and replace the placeholder with real answer
  const answer = await findAnswer(text);
  chat[chat.length - 1] = { from: "assistant", ...answer };
  render();
  requestAnimationFrame(() => {
    const messages = document.querySelector("#chat-messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}

async function saveNoticeAsTask(noticeId) {
  const notice = state.notices.find((item) => item.id === noticeId);
  if (!notice) return;
  const exists = state.tasks.some((task) => task.source === notice.source);
  if (!exists) {
    const task = {
      id: `task-${Date.now()}`,
      title: notice.action,
      detail: notice.title,
      due: notice.deadline.replace(" 2026", ""),
      dueISO: notice.deadlineISO,
      priority: notice.priority,
      complete: false,
      source: notice.source,
    };
    const saved = await mutate(
      "/api/tasks",
      { method: "POST", body: task },
      "Deadline saved to your task list.",
    );
    if (!saved) return;
  }
  modal = null;
  render();
  if (exists) showToast("This deadline is already in your task list.");
}

async function handlePublish(event) {
  event.preventDefault();
  const title = document.querySelector("#publish-title").value.trim();
  const summary = document.querySelector("#publish-summary").value.trim();
  const deadlineISO = document.querySelector("#publish-deadline").value;
  const notice = {
    id: `notice-${Date.now()}`,
    title,
    summary,
    department: document.querySelector("#publish-department").value.trim(),
    type: document.querySelector("#publish-type").value,
    priority: document.querySelector("#publish-priority").value,
    published: "4 Jun 2026",
    deadline: formatDate(deadlineISO),
    deadlineISO,
    action: document.querySelector("#publish-action").value.trim(),
    source: session.role === "admin" ? `Admin Circular #${state.notices.length + 1}` : `Faculty Update #${state.notices.length + 1}`,
    audience: document.querySelector("#publish-audience").value,
    verified: true,
    views: 0,
    saved: 0,
    createdBy: session.name,
  };
  const saved = await mutate(
    "/api/notices",
    { method: "POST", body: notice },
    "Verified notice published successfully.",
  );
  if (!saved) return;
  currentPage = "notices";
  render();
}

function updatePreview() {
  const mappings = {
    "#publish-title": ["#preview-title", "Your notice title"],
    "#publish-summary": ["#preview-summary", "The concise summary will appear here for students."],
    "#publish-action": ["#preview-action", "Add the next step students should take."],
  };
  Object.entries(mappings).forEach(([source, [target, fallback]]) => {
    const sourceElement = document.querySelector(source);
    const targetElement = document.querySelector(target);
    if (sourceElement && targetElement) targetElement.textContent = sourceElement.value || fallback;
  });
  const date = document.querySelector("#publish-deadline")?.value;
  const dateTarget = document.querySelector("#preview-date");
  if (dateTarget) dateTarget.textContent = formatDate(date);
}

async function handleUtilityForm(event) {
  event.preventDefault();
  const title = document.querySelector("#modal-title").value.trim();
  const category = document.querySelector("#modal-category").value;
  const detail = document.querySelector("#modal-detail").value.trim();
  if (modal.type === "complaint") {
    const complaint = {
      id: `complaint-${Date.now()}`,
      title,
      category,
      submitted: new Date().toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"}),
      status: "Open",
      detail,
      submittedBy: state.me?.name || session?.name || "Student",
    };
    if (!(await mutate("/api/complaints", { method: "POST", body: complaint }, "Campus request submitted."))) return;
  }
  if (modal.type === "lost") {
    const item = {
      id: `lost-${Date.now()}`,
      item: title,
      type: category,
      place: detail,
      date: new Date().toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"}),
      status: "Open",
      contact: state.me?.name || session?.name || "Student",
    };
    if (!(await mutate("/api/lost-found", { method: "POST", body: item }, "Lost and found post published."))) return;
  }
  if (modal.type === "add-teacher") {
    const name = title;
    const email = category;
    const password = detail;
    if (!name || !email || !password || password.length < 6) {
      showToast("Fill all fields. Password must be at least 6 characters.", "error");
      return;
    }
    try {
      const res = await api(API_BASE + "/api/admin/add-teacher", { method: "POST", body: { name, email, password } });
      showToast(`Teacher "${name}" created! Login ID: ${res.loginId}`);
      modal = null;
      await refreshState();
      render();
    } catch (err) {
      showToast(err.message, "error");
    }
    return;
  }
  if (modal.type === "task") {
    const task = {
      id: `task-${Date.now()}`,
      title,
      detail: detail || "Personal reminder",
      due: formatDate(category).replace(" 2026", ""),
      dueISO: category,
      priority: "Medium",
      complete: false,
      source: "Personal task",
    };
    if (!(await mutate("/api/tasks", { method: "POST", body: task }, "Personal task added."))) return;
  }
  modal = null;
  render();
}

async function initialize() {
  if (session) {
    try {
      await refreshState();
    } catch {
      saveSession(null);
    }
  }
  loading = false;
  render();
}

initialize();
