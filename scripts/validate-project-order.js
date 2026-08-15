const fs = require("fs");

const file = "data/projects.json";
const projects = JSON.parse(fs.readFileSync(file, "utf8"));

const titles = projects.map(project => project.title);
const sortedTitles = [...titles].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" })
);

const isSorted = titles.every((title, index) => title === sortedTitles[index]);

if (!isSorted) {
  console.error("❌ data/projects.json is not alphabetically ordered by title.");

  for (let i = 0; i < titles.length; i++) {
    if (titles[i] !== sortedTitles[i]) {
      console.error(`Expected "${sortedTitles[i]}" at position ${i + 1}, found "${titles[i]}".`);
      break;
    }
  }

  process.exit(1);
}

console.log("✅ data/projects.json is alphabetically ordered by title.");
