const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/projects.json');

// Define allowed categories based on your project scope
const ALLOWED_CATEGORIES = ['web', 'mobile', 'ai', 'devops', 'design']; 

function validateProjects() {
  console.log('🔍 Running project metadata validation...');

  if (!fs.existsSync(DATA_PATH)) {
    console.error('❌ Error: data/projects.json does not exist.');
    process.exit(1);
  }

  let projects;
  try {
    projects = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (e) {
    console.error('❌ Error: data/projects.json is not valid JSON syntax.');
    console.error(e.message);
    process.exit(1);
  }

  if (!Array.isArray(projects)) {
    console.error('❌ Error: The root of projects.json must be an Array.');
    process.exit(1);
  }

  let hasErrors = false;
  const seenIds = new Set();

  projects.forEach((project, idx) => {
    const projectLabel = `[Item at index ${idx} (ID: ${project.id || 'MISSING'})]`;

    // 1. Verify required fields exist and are strings
    const requiredFields = ['id', 'title', 'description', 'category', 'path'];
    requiredFields.forEach(field => {
      if (!project[field]) {
        console.error(`  - ${projectLabel}: Missing required field "${field}"`);
        hasErrors = true;
      } else if (typeof project[field] !== 'string') {
        console.error(`  - ${projectLabel}: Field "${field}" must be a string`);
        hasErrors = true;
      }
    });

    // 2. Duplicate ID validation
    if (project.id) {
      if (seenIds.has(project.id)) {
        console.error(`  - ${projectLabel}: Duplicate ID detected! "${project.id}" is already used.`);
        hasErrors = true;
      }
      seenIds.add(project.id);
    }

    // 3. Category verification
    if (project.category && !ALLOWED_CATEGORIES.includes(project.category)) {
      console.error(`  - ${projectLabel}: Invalid category "${project.category}". Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
      hasErrors = true;
    }

    // 4. Project path structure check (e.g., must start with a slash or follow a safe URI scheme)
    if (project.path && !/^\/[a-zA-Z0-9_-]+$/.test(project.path)) {
      console.error(`  - ${projectLabel}: Invalid path format "${project.path}". Must start with '/' followed by alphanumeric characters/hyphens.`);
      hasErrors = true;
    }
  });

  // Final verdict
  if (hasErrors) {
    console.error('\n🛑 Validation failed. Please fix the metadata errors before pushing.');
    process.exit(1);
  }

  console.log('✅ Success: data/projects.json passed all structural checks.');
  process.exit(0);
}

validateProjects();
