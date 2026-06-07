import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("./data/campuscopilot.db");

// 1. Approve the user and assign login ID
db.prepare(`
  UPDATE auth_users 
  SET status = 'Approved', 
      login_id = 'STU002', 
      approved_at = CURRENT_TIMESTAMP, 
      approved_by = 'System' 
  WHERE email = 'aakashithkr@gmail.com'
`).run();

// 2. Clear all login attempt locks
db.prepare(`DELETE FROM login_attempts`).run();

// 3. Verify
const user = db.prepare(
  "SELECT id, login_id, name, status, role FROM auth_users WHERE email = 'aakashithkr@gmail.com'"
).get();

console.log("\n✅ Done! User updated:");
console.log("   Name     :", user.name);
console.log("   Login ID :", user.login_id);
console.log("   Status   :", user.status);
console.log("   Role     :", user.role);
console.log("\n👉 Login karo:");
console.log("   Role     : Student");
console.log("   Login ID : STU002");
console.log("   Password : (jo signup mein daala tha)");
