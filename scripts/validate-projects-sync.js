const { validateProjectsSync, REPO_ROOT } = require("./generate-projects");
const path = require("path");

function main() {
  console.log("Checking that data/projects.json is synchronized with current project tree and generator output...");

  const result = validateProjectsSync();

  if (!result.inSync) {
    console.error(`\n❌ Project metadata synchronization check failed with ${result.issues.length} issue(s):\n`);
    result.issues.forEach(issue => {
      console.error(`  - ${issue}`);
    });
    console.error(
      `\n💡 To synchronize metadata, run:\n  npm run generate\n`
    );
    process.exit(1);
  }

  console.log(`✅ data/projects.json is fully synchronized (${result.expected.length} projects).`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
