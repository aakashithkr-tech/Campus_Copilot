import fs from 'fs';
let content = fs.readFileSync('database.mjs', 'utf8');

const alterStmts = `
  try { await exec("ALTER TABLE student_profiles ADD COLUMN semester TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN section TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN dob TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN gender TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN city TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN admission_year TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN guardian_name TEXT DEFAULT ''"); } catch(e){}
  try { await exec("ALTER TABLE student_profiles ADD COLUMN emergency_number TEXT DEFAULT ''"); } catch(e){}
`;

content = content.replace('CREATE TABLE IF NOT EXISTS auth_users', alterStmts + '\n  CREATE TABLE IF NOT EXISTS auth_users');
fs.writeFileSync('database.mjs', content, 'utf8');
console.log('Alters added');
