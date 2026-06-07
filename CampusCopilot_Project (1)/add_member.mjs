// ── Add admission records via running server ──────────────────────────────────
// STEP 1: node server.mjs   (ek terminal mein, band mat karna)
// STEP 2: node add_member.mjs   (doosre terminal mein)

const SERVER = "http://localhost:4173";

const ADMIN_LOGIN_ID = "ADM001";
const ADMIN_PASSWORD = "admin123";

// ── Yahan students add karo ──────────────────────────────────────────────────
const students = [
  {
    admission_number: "ADM2026006",
    name: "Ayushman Thakur",
    email: "ayushmanthakur605@gmail.com",
  },
  {
    admission_number: "ADM2026007",
    name: "Aarish Saifi",
    email: "aarishhh007@gmail.com",
  },
  {
    admission_number: "ADM2026008",
    name: "Aazim Azhar",
    email: "aazimazhar@gmail.com",
  },
  {
    admission_number: "ADM2026009",
    name: "Aniket",
    email: "aakashithakr.04@gmail.com",
  }
  // aur add karne hain toh yahan daalo:
  // { admission_number: "ADM2026008", name: "Name", email: "email@gmail.com" },
];

// ── Admin login ───────────────────────────────────────────────────────────────
let token;
try {
  const loginRes = await fetch(`${SERVER}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login_id: ADMIN_LOGIN_ID, password: ADMIN_PASSWORD, role: "admin" }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error("❌ Admin login failed:", loginData.error);
    process.exit(1);
  }
  token = loginData.token;
  console.log("✅ Admin login successful\n");
} catch (err) {
  console.error("❌ Server se connect nahi ho paya. Kya 'node server.mjs' chal raha hai?");
  process.exit(1);
}

// ── Students add karo ─────────────────────────────────────────────────────────
for (const student of students) {
  try {
    const res = await fetch(`${SERVER}/api/admin/add-admission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(student),
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Added: ${student.name} (${student.admission_number})`);
    } else {
      console.error(`❌ Failed: ${student.name} → ${data.error}`);
    }
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }
}

console.log("\nDone! Ab student app pe register kar sakta hai.");
