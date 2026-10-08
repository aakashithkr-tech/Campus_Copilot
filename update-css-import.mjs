import fs from 'fs';
let css = fs.readFileSync('src/styles.css', 'utf8');
css = css.replace(/@import url\("profile-dark\.css"\);/, '@import url("profile-new.css");');
fs.writeFileSync('src/styles.css', css, 'utf8');
console.log('Import updated');
