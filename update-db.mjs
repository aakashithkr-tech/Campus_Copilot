import fs from 'fs';

let content = fs.readFileSync('database.mjs', 'utf8');
content = content.replace(/skills TEXT DEFAULT '',\r?\n    linkedin TEXT DEFAULT '',\r?\n    leetcode TEXT DEFAULT '',\r?\n    github TEXT DEFAULT '',\r?\n    portfolio TEXT DEFAULT ''/, `semester TEXT DEFAULT '',\n    section TEXT DEFAULT '',\n    dob TEXT DEFAULT '',\n    gender TEXT DEFAULT '',\n    city TEXT DEFAULT '',\n    admission_year TEXT DEFAULT '',\n    guardian_name TEXT DEFAULT '',\n    emergency_number TEXT DEFAULT ''`);
content = content.replace(/course: "", year: "", skills: "", linkedin: "", leetcode: "", github: "", portfolio: ""/, `course: "", year: "", semester: "", section: "", dob: "", gender: "", city: "", admission_year: "", guardian_name: "", emergency_number: ""`);
content = content.replace(/course, year, skills, linkedin, leetcode, github, portfolio/, `course, year, semester, section, dob, gender, city, admission_year, guardian_name, emergency_number`);
content = content.replace(/course = excluded\.course,\r?\n\s*year = excluded\.year,\r?\n\s*skills = excluded\.skills,\r?\n\s*linkedin = excluded\.linkedin,\r?\n\s*leetcode = excluded\.leetcode,\r?\n\s*github = excluded\.github,\r?\n\s*portfolio = excluded\.portfolio/, `course = excluded.course,\n            year = excluded.year,\n            semester = excluded.semester,\n            section = excluded.section,\n            dob = excluded.dob,\n            gender = excluded.gender,\n            city = excluded.city,\n            admission_year = excluded.admission_year,\n            guardian_name = excluded.guardian_name,\n            emergency_number = excluded.emergency_number`);
content = content.replace(/profile\.course \|\| "", profile\.year \|\| "", profile\.skills \|\| "", profile\.linkedin \|\| "", profile\.leetcode \|\| "", profile\.github \|\| "", profile\.portfolio \|\| ""/, `profile.course || "", profile.year || "", profile.semester || "", profile.section || "", profile.dob || "", profile.gender || "", profile.city || "", profile.admission_year || "", profile.guardian_name || "", profile.emergency_number || ""`);
content = content.replace(/\?, \?, \?, \?, \?, \?, \?, \?/, `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`);

fs.writeFileSync('database.mjs', content, 'utf8');
console.log('database.mjs updated');
