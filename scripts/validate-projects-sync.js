const {
  validateProjectsSync,
  validateSitemapSync,
  REPO_ROOT,
} = require("./generate-projects");

function main() {
  console.log(
    "Checking that data/projects.json and sitemap.xml are synchronized with current project tree and generator output..."
  );

  const result = validateProjectsSync();
  const sitemapResult = validateSitemapSync();

  const allIssues = [...result.issues, ...sitemapResult.issues];

  if (!result.inSync || !sitemapResult.inSync) {
    console.error(
      `\n❌ Synchronization check failed with ${allIssues.length} issue(s):\n`
    );
    allIssues.forEach(issue => {
      console.error(`  - ${issue}`);
    });
    console.error(
      `\n💡 To synchronize metadata and sitemap, run:\n  npm run generate\n`
    );
    process.exit(1);
  }

  console.log(
    `✅ data/projects.json and sitemap.xml are fully synchronized (${result.expected.length} projects).`
  );
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
