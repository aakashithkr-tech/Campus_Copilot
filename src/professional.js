const sectionNames = {
  overview: "Career overview",
  profile: "Professional profile",
  skills: "Skills",
  projects: "Projects",
  experience: "Experience",
  achievements: "Achievements",
  applications: "Application tracker",
  interview: "Interview preparation",
  career: "Career copilot",
  resume: "Resume builder",
  timeline: "Professional timeline",
};

const nav = [
  ["overview", "Overview", "✦"],
  ["profile", "My profile", "◉"],
  ["skills", "Skills", "⌘"],
  ["projects", "Projects", "▤"],
  ["experience", "Experience", "↗"],
  ["achievements", "Achievements", "★"],
  ["career", "Career copilot", "◎"],
  ["resume", "Resume builder", "▧"],
  ["applications", "Applications", "↗"],
  ["interview", "Interview prep", "◇"],
  ["timeline", "Journey", "↕"],
];

const itemLabels = {
  skill: "Skill",
  project: "Project",
  certification: "Certification",
  experience: "Experience",
  achievement: "Achievement",
  application: "Application",
  interview: "Practice topic",
};

const formFields = {
  skill: [
    ["name", "Skill name", "text", true],
    ["category", "Category", "select", true, ["Programming", "Framework", "Database", "Tools", "Cloud", "AI / ML", "Soft skill", "Other"]],
    ["proficiency", "Self-assessed proficiency (%)", "number"],
    ["evidence", "Related project or evidence", "text"],
  ],
  project: [
    ["name", "Project name", "text", true],
    ["description", "Short description", "textarea", true],
    ["problem", "Problem solved", "textarea"],
    ["technologies", "Technologies (comma-separated)", "text"],
    ["role", "Your role", "text"],
    ["github", "GitHub link", "url"],
    ["demo", "Live demo link", "url"],
    ["image", "Project image URL", "url"],
    ["year", "Year", "number"],
    ["team", "Team / individual", "select", false, ["Individual", "Team"]],
    ["achievements", "Key achievements", "textarea"],
    ["featured", "Featured project", "checkbox"],
  ],
  certification: [
    ["name", "Certification name", "text", true],
    ["organization", "Issuing organization", "text", true],
    ["issueDate", "Issue date", "date"],
    ["credentialId", "Credential ID", "text"],
    ["url", "Credential URL", "url"],
  ],
  experience: [
    ["type", "Experience type", "select", true, ["Internship", "Part-time", "Freelance", "Volunteer", "Research"]],
    ["organization", "Organization", "text", true],
    ["role", "Role", "text", true],
    ["startDate", "Start date", "date"],
    ["endDate", "End date", "date"],
    ["description", "Description", "textarea"],
    ["technologies", "Technologies (comma-separated)", "text"],
    ["responsibilities", "Responsibilities", "textarea"],
    ["achievements", "Achievements", "textarea"],
  ],
  achievement: [
    ["type", "Achievement type", "select", true, ["Hackathon", "Competition", "SIH", "Award", "Academic", "Leadership", "Club", "Extracurricular"]],
    ["name", "Event or achievement", "text", true],
    ["organization", "Organization", "text"],
    ["date", "Date", "date"],
    ["result", "Position / result", "text"],
    ["teamMembers", "Team members", "text"],
    ["project", "Related project", "text"],
    ["proof", "Certificate / proof URL", "url"],
    ["description", "Description", "textarea"],
  ],
  application: [
    ["company", "Company", "text", true],
    ["title", "Job title", "text", true],
    ["location", "Location", "text"],
    ["applicationDate", "Application date", "date"],
    ["deadline", "Deadline", "date"],
    ["link", "Job link", "url"],
    ["status", "Status", "select", true, ["Saved", "Applied", "Assessment", "Interview", "Selected", "Rejected"]],
  ],
  interview: [
    ["topic", "Question or practice topic", "text", true],
    ["technology", "Technology / area", "text"],
    ["difficulty", "Difficulty", "select", false, ["Foundational", "Intermediate", "Advanced"]],
    ["status", "Progress", "select", true, ["Not started", "Practicing", "Completed"]],
  ],
};

let editingItem = null;
let pendingMode = null;

function escapeHTML(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function link(value, label) {
  const url = safeUrl(value);
  return url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>` : "";
}

function rows(items, kind) {
  return items.filter((item) => item.kind === kind);
}

function list(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

function statusPill(status) {
  return `<span class="pro-pill">${escapeHTML(status || "In progress")}</span>`;
}

function progressBar(percent, label = "") {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return `<div class="pro-progress" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuenow="${safePercent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${safePercent}%"></span></div>`;
}

function completion(profile) {
  const fields = ["fullName", "photoUrl", "college", "degree", "branch", "graduationYear", "headline", "targetRole", "about", "workType", "location", "github", "linkedin", "portfolio", "codingProfile"];
  return Math.round(fields.filter((field) => String(profile[field] || "").trim()).length * 100 / fields.length);
}

function readinessComponents(profile, items) {
  const resumeSections = [
    Boolean(profile.fullName),
    Boolean(profile.about),
    Boolean(profile.degree && profile.branch && profile.college),
    rows(items, "skill").length > 0,
    rows(items, "project").length > 0,
    rows(items, "experience").length > 0,
    rows(items, "certification").length > 0,
    rows(items, "achievement").length > 0,
  ];
  return [
    ["Profile", completion(profile), "Completed profile fields"],
    ["Skills", Math.min(100, rows(items, "skill").length * 12), "Up to 8 listed skills"],
    ["Projects", Math.min(100, rows(items, "project").length * 25), "Up to 4 projects"],
    ["Certifications", Math.min(100, rows(items, "certification").length * 20), "Up to 5 certifications"],
    ["Experience", Math.min(100, rows(items, "experience").length * 25), "Up to 4 experiences"],
    ["Resume", Math.round(resumeSections.filter(Boolean).length * 100 / resumeSections.length), "8 generated resume sections"],
    ["Role alignment", profile.targetRole ? 100 : 0, "Set a target role to tailor guidance"],
  ];
}

function readiness(profile, items) {
  const values = readinessComponents(profile, items);
  return Math.round(values.reduce((total, [, score]) => total + score, 0) / values.length);
}

function empty(title, detail, kind) {
  return `<div class="pro-empty"><span>✦</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(detail)}</p>${kind ? `<button class="pro-button secondary" data-pro-add="${kind}">Add ${escapeHTML(itemLabels[kind].toLowerCase())}</button>` : ""}</div>`;
}

function itemButtons(item) {
  return `<div class="pro-item-actions"><button type="button" data-pro-edit="${item.id}" aria-label="Edit record">Edit</button><button type="button" class="danger" data-pro-delete="${item.id}" aria-label="Delete record">Delete</button></div>`;
}

function skillCards(items) {
  const skills = rows(items, "skill");
  if (!skills.length) return empty("Your skill story starts here", "Add skills and self-assess your proficiency. These ratings are guidance, not verified scores.", "skill");
  return `<div class="pro-skill-list">${skills.map((skill) => `
    <article class="pro-skill">
      <div class="pro-skill-head"><div><strong>${escapeHTML(skill.name)}</strong><small>${escapeHTML(skill.category || "Other")} · Self-assessed</small></div><b>${Math.max(0, Math.min(100, Number(skill.proficiency) || 0))}%</b></div>
      ${progressBar(skill.proficiency, `${skill.name} self-assessed proficiency`)}
      ${skill.evidence ? `<small>Evidence: ${escapeHTML(skill.evidence)}</small>` : ""}
      ${itemButtons(skill)}
    </article>`).join("")}</div>`;
}

function projectCards(items) {
  const projects = rows(items, "project");
  if (!projects.length) return empty("Make your work visible", "Add projects to build a portfolio and strengthen your target-role alignment.", "project");
  return `<div class="pro-card-grid">${projects.map((project) => `
    <article class="pro-record-card ${project.featured ? "featured" : ""}">
      ${project.image && safeUrl(project.image) ? `<img class="pro-project-image" src="${escapeHTML(safeUrl(project.image))}" alt="">` : ""}
      ${project.featured ? `<span class="pro-label">FEATURED</span>` : ""}
      <h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.description)}</p>
      ${project.technologies ? `<div class="pro-tags">${(Array.isArray(project.technologies) ? project.technologies : String(project.technologies).split(",")).map((tag) => `<span>${escapeHTML(tag.trim())}</span>`).join("")}</div>` : ""}
      <div class="pro-record-links">${link(project.github, "GitHub")} ${link(project.demo, "Live demo")}</div>
      ${itemButtons(project)}
    </article>`).join("")}</div>`;
}

function genericCards(items, kind, titleField, subtitleField) {
  const records = rows(items, kind);
  if (!records.length) return empty(`No ${titleField.toLowerCase()} added yet`, "Add real details to build your professional profile.", kind);
  return `<div class="pro-card-grid">${records.map((item) => `
    <article class="pro-record-card"><div class="pro-record-top">${statusPill(item.status || item.type || item.result)}${item.date || item.issueDate ? `<small>${escapeHTML(item.date || item.issueDate)}</small>` : ""}</div>
      <h3>${escapeHTML(item.name || item.company || item.topic || item.title || "Entry")}</h3>
      ${item[subtitleField] ? `<p>${escapeHTML(item[subtitleField])}</p>` : ""}
      ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ""}
      ${item.technologies ? `<small>${escapeHTML(list(item.technologies))}</small>` : ""}
      ${link(item.url || item.proof || item.link, "Open credential / link")}
      ${itemButtons(item)}
    </article>`).join("")}</div>`;
}

function roleNeeds(role) {
  const key = role.toLowerCase();
  if (key.includes("data") || key.includes("analyst")) return ["SQL", "Python", "Statistics", "Data visualization", "Experiment design"];
  if (key.includes("machine") || key.includes("ml") || key.includes("ai")) return ["Python", "Linear algebra", "Model evaluation", "Data pipelines", "Deployment"];
  if (key.includes("cloud")) return ["Linux", "Networking", "Cloud platform", "Containers", "Infrastructure as code"];
  if (key.includes("front")) return ["JavaScript", "HTML/CSS", "Accessibility", "Testing", "Deployment"];
  if (key.includes("backend") || key.includes("java")) return ["Java", "REST APIs", "Databases", "Testing", "Deployment"];
  return ["Programming fundamentals", "Data structures", "Git", "Testing", "System design"];
}

function roadmapFor(role) {
  const isData = /data|analyst|machine|ml|ai/i.test(role);
  const phases = isData ? [
    ["Programming foundations", "Python, Git, problem solving", "Build a small data-cleaning utility"],
    ["Data and statistics", "SQL, probability, exploratory analysis", "Analyze a public dataset"],
    ["Visualization and storytelling", "Dashboards, charts, communicating insight", "Publish an interactive dashboard"],
    ["Portfolio project", "Validation, reproducibility, deployment", "Ship an end-to-end portfolio project"],
    ["Applications and interviews", "Resume, case studies, practice", "Present your work to a peer"],
  ] : [
    ["Programming foundations", "Core language, Git, problem solving", "Build a command-line utility"],
    ["Data structures and testing", "DSA patterns, unit tests, debugging", "Create a tested data-structure library"],
    ["Web and APIs", "Frontend, REST, databases", "Build a full-stack feature"],
    ["Production project", "Deployment, security basics, documentation", "Ship a deployed portfolio project"],
    ["Applications and interviews", "Resume, DSA practice, behavioral stories", "Practice a project walkthrough"],
  ];
  return phases.map(([title, topics, project], index) => ({ title, topics, project, id: `phase-${index + 1}` }));
}

function itemForm() {
  if (!editingItem) return "";
  const { kind, item } = editingItem;
  const fields = formFields[kind] || [];
  return `<div class="pro-modal-backdrop" data-pro-close><form class="pro-modal" id="professional-item-form" data-kind="${kind}">
    <button type="button" class="pro-modal-close" data-pro-close aria-label="Close">×</button>
    <span class="pro-kicker">Professional portfolio</span><h2>${item ? "Edit" : "Add"} ${escapeHTML(itemLabels[kind])}</h2>
    <div class="pro-form-grid">${fields.map(([name, label, type, required, options]) => {
      const value = item?.[name] ?? "";
      if (type === "checkbox") return `<label class="pro-check"><input name="${name}" type="checkbox" ${value ? "checked" : ""}>${label}</label>`;
      if (type === "select") return `<label>${label}<select name="${name}" ${required ? "required" : ""}>${options.map((option) => `<option value="${escapeHTML(option)}" ${value === option ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}</select></label>`;
      if (type === "textarea") return `<label class="wide">${label}<textarea name="${name}" ${required ? "required" : ""}>${escapeHTML(value)}</textarea></label>`;
      return `<label>${label}<input name="${name}" type="${type}" value="${escapeHTML(value)}" ${required ? "required" : ""} ${type === "number" && name === "proficiency" ? 'min="0" max="100"' : ""}></label>`;
    }).join("")}</div>
    <div class="pro-form-actions"><button type="button" class="pro-button secondary" data-pro-close>Cancel</button><button class="pro-button primary" type="submit">Save ${escapeHTML(itemLabels[kind])}</button></div>
  </form></div>`;
}

function profilePage(profile, user) {
  const fields = [
    ["fullName", "Full name", profile.fullName || user.name || ""],
    ["photoUrl", "Profile photo URL", profile.photoUrl || ""],
    ["email", "Resume contact email", profile.email || user.email || ""],
    ["phone", "Resume contact phone", profile.phone || user.phone || ""],
    ["college", "College", profile.college || ""],
    ["degree", "Degree", profile.degree || ""],
    ["branch", "Branch", profile.branch || ""],
    ["graduationYear", "Graduation year", profile.graduationYear || ""],
    ["currentYear", "Current year / semester", profile.currentYear || ""],
    ["headline", "Professional headline", profile.headline || ""],
    ["targetRole", "Target role", profile.targetRole || ""],
    ["interests", "Career interests", profile.interests || ""],
    ["workType", "Preferred work type", profile.workType || ""],
    ["location", "Preferred location", profile.location || ""],
    ["github", "GitHub URL", profile.github || ""],
    ["linkedin", "LinkedIn URL", profile.linkedin || ""],
    ["portfolio", "Portfolio URL", profile.portfolio || ""],
    ["codingProfile", "Coding profile URL", profile.codingProfile || ""],
  ];
  return `<div class="pro-page-heading"><div><span class="pro-kicker">Your professional identity</span><h2>Profile</h2><p>One profile powers your career dashboard and generated resume.</p></div><span class="pro-completion">${completion(profile)}% complete</span></div>
    <form id="professional-profile-form" class="pro-panel pro-profile-form"><div class="pro-form-grid">${fields.map(([name, label, value]) => `<label>${label}<input name="${name}" value="${escapeHTML(value)}" ${name === "graduationYear" ? 'type="number" min="2000" max="2100"' : name === "github" || name === "linkedin" || name === "portfolio" || name === "codingProfile" || name === "photoUrl" ? 'type="url"' : name === "email" ? 'type="email"' : "type=\"text\""}></label>`).join("")}
    <label class="wide">About me<textarea name="about" rows="4" placeholder="What are you learning, building, or looking for?">${escapeHTML(profile.about || "")}</textarea></label></div>
    <div class="pro-share-settings"><h3>Professional profile visibility</h3><p>Private is the default. Only selected career fields will appear on the share page. Campus / ERP data is never included.</p>
      <label>Visibility<select name="visibility"><option value="private" ${profile.visibility !== "public" ? "selected" : ""}>Private</option><option value="public" ${profile.visibility === "public" ? "selected" : ""}>Public / shareable</option></select></label>
      <div class="pro-share-fields">${[["identity","Name"],["photo","Profile photo"],["headline","Headline and target role"],["about","About"],["skills","Skills"],["projects","Projects"],["certifications","Certifications"],["experience","Experience"],["achievements","Achievements"],["github","GitHub link"],["linkedin","LinkedIn link"],["portfolio","Portfolio link"]].map(([key,label]) => `<label><input type="checkbox" name="shareFields" value="${key}" ${(profile.shareFields || []).includes(key) ? "checked" : ""}> ${label}</label>`).join("")}</div>
      ${profile.visibility === "public" && profile.shareToken ? `<div class="pro-share-url"><span>Shareable profile</span><a href="/?profile=${encodeURIComponent(profile.shareToken)}" target="_blank" rel="noopener noreferrer">Open public profile</a><button type="button" data-pro-copy="/?profile=${escapeHTML(profile.shareToken)}">Copy link</button></div>` : ""}
    </div><div class="pro-form-actions"><button class="pro-button primary" type="submit">Save profile</button></div></form>`;
}

function gapPage(profile, items) {
  const role = profile.targetRole || "Software Engineer";
  const needs = roleNeeds(role);
  const skills = rows(items, "skill");
  const owned = new Map(skills.map((skill) => [String(skill.name || "").toLowerCase(), skill]));
  const strong = needs.filter((name) => (owned.get(name.toLowerCase())?.proficiency || 0) >= 70);
  const weak = needs.filter((name) => owned.has(name.toLowerCase()) && !strong.includes(name));
  const missing = needs.filter((name) => !owned.has(name.toLowerCase()));
  return `<div class="pro-page-heading"><div><span class="pro-kicker">Guidance based on your self-reported profile</span><h2>Skill gap & roadmap</h2><p>Suggestions are general learning guidance, not a prediction of recruiter requirements.</p></div><button class="pro-button secondary" data-pro-nav="profile">Update target role</button></div>
    <section class="pro-panel"><div class="pro-role-heading"><div><small>Target role</small><h3>${escapeHTML(role)}</h3></div><span>Guidance, not a hiring guarantee</span></div>
      <div class="pro-gap-grid"><div><h4>✓ Strong foundations</h4>${strong.length ? strong.map((name) => `<p class="pro-gap-item strong">${escapeHTML(name)}</p>`).join("") : "<p>Add skills with self-assessed proficiency at 70% or above.</p>"}</div>
      <div><h4>↗ Build depth</h4>${weak.length ? weak.map((name) => `<p class="pro-gap-item weak">${escapeHTML(name)}</p>`).join("") : "<p>No target skills currently marked for more practice.</p>"}</div>
      <div><h4>＋ Explore next</h4>${missing.length ? missing.map((name) => `<p class="pro-gap-item missing">${escapeHTML(name)}</p>`).join("") : "<p>Your listed skills cover this guidance set.</p>"}</div></div>
      <p class="pro-guidance-note">This transparent checklist is generated from a small role-based learning guide and your own skill entries. It does not use recruiter data or external AI.</p>
    </section>
    <section class="pro-panel"><div class="pro-section-heading"><div><h3>Your learning roadmap</h3><p>Check off phases as you complete them.</p></div></div>
      <div class="pro-roadmap">${roadmapFor(role).map((phase) => {
        const done = (profile.roadmapProgress || []).includes(phase.id);
        return `<label class="pro-roadmap-phase ${done ? "completed" : ""}"><input type="checkbox" data-pro-phase="${phase.id}" ${done ? "checked" : ""}><span class="pro-phase-number">${phase.id.slice(-1)}</span><span><strong>${escapeHTML(phase.title)}</strong><small>${escapeHTML(phase.topics)}</small><small>Suggested project: ${escapeHTML(phase.project)}</small></span></label>`;
      }).join("")}</div>
    </section>`;
}

function readinessBreakdown(profile, items) {
  const groups = readinessComponents(profile, items);
  return groups.map(([name, score, explanation]) => `<div class="pro-readiness-row"><span><strong>${name}</strong><small>${explanation}</small></span><b>${score}%</b>${progressBar(score, `${name} readiness`)}</div>`).join("");
}

function overviewPage(profile, items, user) {
  const score = readiness(profile, items);
  const projects = rows(items, "project");
  const skillEntries = rows(items, "skill");
  const skillLevel = skillEntries.length
    ? `${Math.round(skillEntries.reduce((sum, skill) => sum + (Number(skill.proficiency) || 0), 0) / skillEntries.length)}% avg. self-assessed`
    : "Not rated yet";
  const achievements = rows(items, "achievement");
  const metrics = [
    ["Skills", rows(items, "skill").length, "⌘"],
    ["Projects", projects.length, "▤"],
    ["Certifications", rows(items, "certification").length, "✧"],
    ["Internships", rows(items, "experience").filter((item) => item.type === "Internship").length, "↗"],
    ["Hackathons", achievements.filter((item) => /hackathon|sih/i.test(item.type || "")).length, "⌁"],
    ["Achievements", achievements.length, "★"],
  ];
  const latest = [...items].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 4);
  return `<section class="pro-hero"><div><span class="pro-kicker">Your campus-to-career workspace</span><h2>Hello, ${escapeHTML((profile.fullName || user.name || "there").split(" ")[0])} <span>✦</span></h2><p>Build your professional story one meaningful step at a time.</p>  <div class="pro-role-chip">${escapeHTML(profile.targetRole || "Add a target role in your profile")} <span>·</span> ${escapeHTML(skillLevel)}</div></div>
    <div class="pro-hero-completion"><div class="pro-ring" style="--progress:${completion(profile) * 3.6}deg"><span>${completion(profile)}<small>%</small></span></div><small>Profile completion</small></div></section>
    <div class="pro-metric-grid">${metrics.map(([label,count,icon]) => `<article class="pro-metric"><span>${icon}</span><small>${label}</small><strong>${count}</strong></article>`).join("")}</div>
    <div class="pro-home-grid"><section class="pro-panel"><div class="pro-section-heading"><div><h3>Career readiness</h3><p>A transparent progress indicator — not an employability prediction.</p></div><strong class="pro-score">${score}<small>/100</small></strong></div>${progressBar(score, "Career readiness") }<div class="pro-readiness-list">${readinessBreakdown(profile, items)}</div><button class="pro-text-button" data-pro-nav="career">See skill guidance and roadmap →</button></section>
    <section class="pro-panel pro-next-panel"><span class="pro-kicker">A good next step</span><h3>${profile.targetRole ? "Strengthen your career profile" : "Choose your target role"}</h3><p>${profile.targetRole ? "Add one project that demonstrates a skill you want employers to notice." : "A target role helps tailor your role-guidance checklist."}</p><button class="pro-button primary" data-pro-nav="${profile.targetRole ? "projects" : "profile"}">${profile.targetRole ? "Add a project" : "Complete profile"}</button></section></div>
    <div class="pro-quick-status"><article><span>Resume</span><strong>${projects.length || rows(items, "skill").length ? "Ready to preview" : "Add career details"}</strong><button data-pro-nav="resume">Preview resume →</button></article><article><span>Public profile links</span><strong>${profile.github || profile.linkedin ? "Links saved to your profile" : "GitHub / LinkedIn not connected"}</strong><button data-pro-nav="profile">Manage profile links →</button></article></div>
    <section class="pro-panel"><div class="pro-section-heading"><div><h3>Recent journey</h3><p>Your latest portfolio updates</p></div><button class="pro-text-button" data-pro-nav="timeline">View timeline →</button></div>
      ${latest.length ? `<div class="pro-activity-list">${latest.map((item) => `<div><span class="pro-activity-dot"></span><span><strong>${escapeHTML(item.name || item.company || item.topic || item.title || item.kind)}</strong><small>${escapeHTML(item.kind)} · ${escapeHTML(item.updatedAt || item.createdAt || "Added recently")}</small></span></div>`).join("")}</div>` : empty("Your career story begins here", "Start with a skill, a project, or your professional profile.")}</section>`;
}

function resumePage(profile, items, user) {
  const fullName = profile.fullName || user.name || "";
  const contact = [profile.email || user.email, profile.phone || user.phone, profile.location].filter(Boolean).map(escapeHTML).join(" · ");
  const links = [link(profile.github, "GitHub"), link(profile.linkedin, "LinkedIn"), link(profile.portfolio, "Portfolio")].filter(Boolean).join(" · ");
  const education = [profile.degree, profile.branch, profile.college, profile.graduationYear].filter(Boolean).map(escapeHTML).join(" · ");
  return `<div class="pro-page-heading no-print"><div><span class="pro-kicker">Generated from your saved profile</span><h2>Resume builder</h2><p>Review your information, then use your browser's print dialog to save a PDF.</p></div><button class="pro-button primary" data-pro-print>Download / print PDF</button></div>
    <article class="pro-resume"><header><h1>${escapeHTML(fullName || "Your Name")}</h1><p>${contact}</p><div>${links}</div><h2>${escapeHTML(profile.headline || profile.targetRole || "")}</h2></header>
      <section><h3>SUMMARY</h3><p>${escapeHTML(profile.about || "Add an about summary to your professional profile.")}</p></section>
      <section><h3>EDUCATION</h3><p>${education || "Add degree, branch, college, and graduation year in your profile."}</p></section>
      <section><h3>SKILLS</h3><p>${rows(items, "skill").map((item) => escapeHTML(item.name)).join(" · ") || "Add skills to your profile."}</p></section>
      <section><h3>PROJECTS</h3>${rows(items, "project").map((project) => `<div><strong>${escapeHTML(project.name)}</strong><p>${escapeHTML(project.description)}${project.technologies ? ` · ${escapeHTML(list(project.technologies))}` : ""}</p></div>`).join("") || "<p>Add projects to your profile.</p>"}</section>
      <section><h3>EXPERIENCE</h3>${rows(items, "experience").map((experience) => `<div><strong>${escapeHTML(experience.role)} · ${escapeHTML(experience.organization)}</strong><p>${escapeHTML(experience.description)}</p></div>`).join("") || "<p>Add experience to your profile.</p>"}</section>
      <section><h3>CERTIFICATIONS</h3>${rows(items, "certification").map((cert) => `<p><strong>${escapeHTML(cert.name)}</strong> · ${escapeHTML(cert.organization)}</p>`).join("") || "<p>Add certifications to your profile.</p>"}</section>
      <section><h3>ACHIEVEMENTS</h3>${rows(items, "achievement").map((achievement) => `<p><strong>${escapeHTML(achievement.name)}</strong> · ${escapeHTML(achievement.result || achievement.type || "")}</p>`).join("") || "<p>Add achievements to your profile.</p>"}</section>
    </article>`;
}

function interviewPage(profile, items) {
  const role = profile.targetRole || "your target role";
  const topics = [
    ["Technical", `Explain a technical trade-off you would make as a ${role}.`, "Technical"],
    ["DSA", "Practice arrays, strings, hash maps, and explaining time complexity.", "DSA"],
    ["Project", "Walk through a project: problem, architecture, your contribution, and lessons.", "Project"],
    ["Behavioral", "Describe a time you received difficult feedback and how you responded.", "Behavioral"],
    ["HR", `Why are you interested in ${role}, and what are you learning next?`, "HR"],
  ];
  return `<div class="pro-page-heading"><div><span class="pro-kicker">Practice at your pace</span><h2>Interview preparation</h2><p>Suggested practice prompts — tailor them to real job descriptions and your own experience.</p></div><button class="pro-button primary" data-pro-add="interview">＋ Add practice topic</button></div>
    <section class="pro-panel"><div class="pro-section-heading"><div><h3>Suggested practice areas</h3><p>These are prompts, not actual interview questions from a recruiter.</p></div></div><div class="pro-interview-prompts">${topics.map(([category,topic,technology]) => `<article><span>${escapeHTML(category)}</span><p>${escapeHTML(topic)}</p><button data-pro-seed-interview="${escapeHTML(topic)}" data-pro-technology="${technology}">Track this topic</button></article>`).join("")}</div></section>
    <div class="pro-section-heading"><div><h3>Your practice tracker</h3><p>Mark topics not started, practicing, or completed.</p></div></div>${genericCards(items, "interview", "Practice topic", "technology")}`;
}

function pageContent(page, profile, items, user) {
  if (page === "overview") return overviewPage(profile, items, user);
  if (page === "profile") return profilePage(profile, user);
  if (page === "skills") return `<div class="pro-page-heading"><div><span class="pro-kicker">Capabilities you choose to share</span><h2>Skills</h2><p>Proficiency is self-assessed unless you add real supporting evidence.</p></div><button class="pro-button primary" data-pro-add="skill">＋ Add skill</button></div>${skillCards(items)}`;
  if (page === "projects") return `<div class="pro-page-heading"><div><span class="pro-kicker">Show what you can build</span><h2>Projects</h2><p>Highlight your contribution, technologies, and outcomes.</p></div><button class="pro-button primary" data-pro-add="project">＋ Add project</button></div>${projectCards(items)}`;
  if (page === "experience") return `<div class="pro-page-heading"><div><span class="pro-kicker">Work, research, and service</span><h2>Experience</h2></div><button class="pro-button primary" data-pro-add="experience">＋ Add experience</button></div>${genericCards(items, "experience", "Experience", "organization")}`;
  if (page === "achievements") return `<div class="pro-page-heading"><div><span class="pro-kicker">Milestones and credentials</span><h2>Achievements & certifications</h2></div><div class="pro-heading-actions"><button class="pro-button secondary" data-pro-add="certification">＋ Certification</button><button class="pro-button primary" data-pro-add="achievement">＋ Achievement</button></div></div>${genericCards(items, "certification", "Certification", "organization")}${genericCards(items, "achievement", "Achievement", "organization")}`;
  if (page === "career") return gapPage(profile, items);
  if (page === "resume") return resumePage(profile, items, user);
  if (page === "applications") {
    const applications = rows(items, "application");
    const counts = ["Applied", "Assessment", "Interview", "Selected"].map((status) => [status, applications.filter((item) => item.status === status).length]);
    return `<div class="pro-page-heading"><div><span class="pro-kicker">Personal application tracker</span><h2>Applications</h2><p>Track opportunities you save; this is not an external job board.</p></div><button class="pro-button primary" data-pro-add="application">＋ Add opportunity</button></div>
      <div class="pro-metric-grid compact">${counts.map(([label,count]) => `<article class="pro-metric"><small>${label}</small><strong>${count}</strong></article>`).join("")}</div>${genericCards(items, "application", "Application", "title")}`;
  }
  if (page === "interview") return interviewPage(profile, items);
  const sorted = [...items].sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return `<div class="pro-page-heading"><div><span class="pro-kicker">Your story, in sequence</span><h2>Professional journey</h2><p>Automatically assembled from the career records you add.</p></div></div>
    ${sorted.length ? `<div class="pro-timeline">${sorted.map((item) => `<article><span class="pro-timeline-dot"></span><small>${escapeHTML(String(item.updatedAt || item.createdAt || "Recently added").slice(0,10))}</small><h3>${escapeHTML(item.name || item.company || item.topic || item.title || item.kind)}</h3><p>${escapeHTML(item.kind)}${item.type ? ` · ${escapeHTML(item.type)}` : ""}</p></article>`).join("")}</div>` : empty("No milestones yet", "Add a project, certification, or experience to begin your timeline.")}`;
}

export function renderModeSelection(name) {
  return `<main class="pro-mode-select"><div class="pro-mode-brand"><span>✦</span> Campus Copilot</div><section><span class="pro-kicker">One student account · Two ways to grow</span><h1>Welcome, ${escapeHTML((name || "student").split(" ")[0])}.</h1><p>Where would you like to start?</p><div class="pro-mode-cards">
    <button type="button" class="${pendingMode === "campus" ? "selected" : ""}" data-set-mode="campus"><span>🏫</span><strong>Campus / ERP</strong><small>College life, academics, notices, and campus tools.</small></button>
    <button type="button" class="${pendingMode === "professional" ? "selected" : ""}" data-set-mode="professional"><span>💼</span><strong>Professional</strong><small>Career profile, projects, skills, and placement preparation.</small></button>
  </div><button class="pro-button primary" data-mode-continue ${pendingMode ? "" : "disabled"}>Continue</button><small class="pro-mode-note">You can switch modes anytime. Your account and sign-in stay the same.</small></section></main>`;
}

export function renderProfessionalShell({ user, profile = {}, items = [], page = "overview", loadError = "" }) {
  const title = sectionNames[page] || sectionNames.overview;
  return `<div class="professional-shell">
    <aside class="professional-sidebar"><a class="pro-brand" href="#" data-pro-nav="overview"><span>✦</span><b>Campus Copilot</b></a><div class="pro-sidebar-label">CAREER WORKSPACE</div><nav>${nav.map(([id,label,icon]) => `<button class="${page === id ? "active" : ""}" data-pro-nav="${id}"><span>${icon}</span>${label}</button>`).join("")}</nav><div class="pro-sidebar-bottom"><small>One student account</small><button data-action="logout">Sign out</button></div></aside>
    <main class="professional-main"><header class="professional-header"><div><small>Career Copilot / ${escapeHTML(title)}</small><h1>${escapeHTML(title)}</h1></div><div class="pro-mode-switch" aria-label="Switch dashboard mode"><button data-set-mode="campus">🏫 Campus</button><button class="selected" aria-current="page">💼 Professional</button></div><button class="pro-avatar" data-pro-nav="profile" aria-label="Open profile">${profile.photoUrl && safeUrl(profile.photoUrl) ? `<img src="${escapeHTML(safeUrl(profile.photoUrl))}" alt="">` : escapeHTML((profile.fullName || user.name || "S").split(" ").map((word) => word[0]).join("").slice(0,2).toUpperCase())}</button></header>
      <section class="professional-content">${loadError ? `<div class="pro-error" role="alert"><strong>Career data could not be loaded.</strong><span>${escapeHTML(loadError)}</span><button data-pro-retry>Retry</button></div>` : pageContent(page, profile, items, user)}</section>
    </main>${itemForm()}</div>`;
}

export function renderPublicProfile(data) {
  const profile = data.profile || {};
  const items = data.items || {};
  return `<main class="pro-public"><header><a href="/">✦ Campus Copilot</a><span>Student professional profile</span></header><section class="pro-public-hero">${profile.photoUrl && safeUrl(profile.photoUrl) ? `<img class="pro-public-photo" src="${escapeHTML(safeUrl(profile.photoUrl))}" alt="">` : ""}<span class="pro-kicker">CAREER PROFILE</span><h1>${escapeHTML(profile.fullName || "Professional profile")}</h1><h2>${escapeHTML(profile.headline || profile.targetRole || "")}</h2><p>${escapeHTML(profile.about || "")}</p><div class="pro-record-links">${link(profile.github, "GitHub")} ${link(profile.linkedin, "LinkedIn")} ${link(profile.portfolio, "Portfolio")}</div></section>
    ${items.skills?.length ? `<section class="pro-panel"><h2>Skills</h2>${items.skills.map((skill) => `<p>${escapeHTML(skill.name)}${skill.category ? ` · ${escapeHTML(skill.category)}` : ""}</p>`).join("")}</section>` : ""}
    ${items.projects?.length ? `<section class="pro-panel"><h2>Projects</h2>${items.projects.map((project) => `<article><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.description)}</p><p>${escapeHTML(list(project.technologies))}</p><div class="pro-record-links">${link(project.github,"GitHub")} ${link(project.demo,"Demo")}</div></article>`).join("")}</section>` : ""}
    ${items.certifications?.length ? `<section class="pro-panel"><h2>Certifications</h2>${items.certifications.map((item) => `<p>${escapeHTML(item.name)} · ${escapeHTML(item.organization)}</p>`).join("")}</section>` : ""}
    ${items.experience?.length ? `<section class="pro-panel"><h2>Experience</h2>${items.experience.map((item) => `<article><h3>${escapeHTML(item.role)} · ${escapeHTML(item.organization)}</h3><p>${escapeHTML(item.description)}</p></article>`).join("")}</section>` : ""}
    ${items.achievements?.length ? `<section class="pro-panel"><h2>Achievements</h2>${items.achievements.map((item) => `<p>${escapeHTML(item.name)}${item.result ? ` · ${escapeHTML(item.result)}` : ""}</p>`).join("")}</section>` : ""}
    <footer>Shared by the student · Campus / ERP records are never part of this profile.</footer></main>`;
}

export function bindProfessionalEvents({ api, onRender, onNavigate, onMode, onUpdate }) {
  document.querySelector("[data-pro-retry]")?.addEventListener("click", () => onUpdate.reload());
  document.querySelectorAll("[data-pro-seed-interview]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await api("/api/professional/items", { method: "POST", body: { kind: "interview", data: {
        topic: button.dataset.proSeedInterview,
        technology: button.dataset.proTechnology,
        difficulty: "Intermediate",
        status: "Not started",
      } } });
      await onUpdate.reload();
    } catch (error) {
      onUpdate.toast(error.message, "error");
    }
  }));
  document.querySelectorAll("[data-pro-nav]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    onNavigate(button.dataset.proNav);
  }));
  document.querySelectorAll("[data-set-mode]").forEach((button) => button.addEventListener("click", () => {
    if (document.querySelector(".pro-mode-select")) {
      pendingMode = button.dataset.setMode;
      onRender();
    } else onMode(button.dataset.setMode);
  }));
  document.querySelector("[data-mode-continue]")?.addEventListener("click", () => {
    if (pendingMode) onMode(pendingMode);
  });
  document.querySelectorAll("[data-pro-add]").forEach((button) => button.addEventListener("click", () => {
    editingItem = { kind: button.dataset.proAdd, item: null };
    onRender();
  }));
  document.querySelectorAll("[data-pro-edit]").forEach((button) => button.addEventListener("click", () => {
    const item = onUpdate.items.find((entry) => String(entry.id) === button.dataset.proEdit);
    if (item) {
      editingItem = { kind: item.kind, item };
      onRender();
    }
  }));
  document.querySelectorAll("[data-pro-delete]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Delete this professional record?")) return;
    try {
      await api(`/api/professional/items/${button.dataset.proDelete}`, { method: "DELETE" });
      editingItem = null;
      await onUpdate.reload();
    } catch (error) {
      onUpdate.toast(error.message, "error");
    }
  }));
  document.querySelectorAll("[data-pro-close]").forEach((button) => button.addEventListener("click", (event) => {
    if (event.target !== button && !button.classList.contains("pro-modal-close")) return;
    editingItem = null;
    onRender();
  }));
  document.querySelector("#professional-item-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const kind = form.dataset.kind;
    const data = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => { data[input.name] = input.checked; });
    for (const key of ["technologies", "responsibilities", "achievements"]) {
      if (typeof data[key] === "string") data[key] = data[key].split(",").map((part) => part.trim()).filter(Boolean);
    }
    if (data.proficiency !== undefined) data.proficiency = Number(data.proficiency);
    if (data.year !== undefined && data.year) data.year = Number(data.year);
    try {
      if (editingItem?.item) await api(`/api/professional/items/${editingItem.item.id}`, { method: "PATCH", body: { kind, data } });
      else await api("/api/professional/items", { method: "POST", body: { kind, data } });
      editingItem = null;
      await onUpdate.reload();
    } catch (error) {
      onUpdate.toast(error.message, "error");
    }
  });
  document.querySelector("#professional-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = Object.fromEntries([...data.entries()].filter(([key]) => key !== "visibility" && key !== "shareFields"));
    const body = {
      profile: { ...profile, roadmapProgress: onUpdate.profile.roadmapProgress || [] },
      visibility: data.get("visibility"),
      shareFields: data.getAll("shareFields"),
    };
    try {
      await api("/api/professional/profile", { method: "POST", body });
      await onUpdate.reload();
      onUpdate.toast("Professional profile saved.");
    } catch (error) {
      onUpdate.toast(error.message, "error");
    }
  });
  document.querySelectorAll("[data-pro-phase]").forEach((checkbox) => checkbox.addEventListener("change", async () => {
    const phases = new Set(onUpdate.profile.roadmapProgress || []);
    if (checkbox.checked) phases.add(checkbox.dataset.proPhase);
    else phases.delete(checkbox.dataset.proPhase);
    try {
      await api("/api/professional/profile", { method: "POST", body: {
        profile: { roadmapProgress: [...phases] },
        visibility: onUpdate.profile.visibility || "private",
        shareFields: onUpdate.profile.shareFields || [],
      } });
      await onUpdate.reload();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      onUpdate.toast(error.message, "error");
    }
  }));
  document.querySelectorAll("[data-pro-copy]").forEach((button) => button.addEventListener("click", async () => {
    const url = new URL(button.dataset.proCopy, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      onUpdate.toast("Share link copied.");
    } catch {
      onUpdate.toast("Could not access the clipboard. Copy the profile URL from your address bar.", "error");
    }
  }));
  document.querySelector("[data-pro-print]")?.addEventListener("click", () => window.print());
}
