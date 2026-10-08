import fs from 'fs';
let c = fs.readFileSync('database.mjs', 'utf8');
c = c.replace(/emergency_number TEXT DEFAULT ''/, "emergency_number TEXT DEFAULT '',\n    phone TEXT DEFAULT ''");
c = c.replace(/emergency_number: ""/, 'emergency_number: "", phone: ""');
c = c.replace(/guardian_name, emergency_number/g, 'guardian_name, emergency_number, phone');
c = c.replace(/emergency_number = excluded.emergency_number/, 'emergency_number = excluded.emergency_number,\n            phone = excluded.phone');
c = c.replace(/profile.emergency_number \|\| ""/, 'profile.emergency_number || "", profile.phone || ""');
c = c.replace(/\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?/, '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?');
fs.writeFileSync('database.mjs', c, 'utf8');

// also run the alter
import { createClient } from "@libsql/client";
async function alter() {
  const db = createClient({
    url: process.env.TURSO_URL || "file:local.db",
    authToken: process.env.TURSO_TOKEN,
  });
  try {
    await db.executeMultiple("ALTER TABLE student_profiles ADD COLUMN phone TEXT DEFAULT '';");
  } catch (e) {}
}
alter();
