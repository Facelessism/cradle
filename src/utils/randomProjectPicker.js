
export function pickRandomProject(
  projects,
  lastPickedPath = null,
  random = Math.random
) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return null;
  }

  const validProjects = projects.filter(
    (project) =>
      project &&
      typeof project.path === "string" &&
      project.path.trim() !== ""
  );

  if (validProjects.length === 0) {
    return null;
  }

  // Avoid selecting the previous project when alternatives exist.
  const alternatives = validProjects.filter(
    (project) => project.path !== lastPickedPath
  );

  const candidates =
    alternatives.length > 0 ? alternatives : validProjects;

  const randomValue = Number(random());

  if (!Number.isFinite(randomValue)) {
    return candidates[0];
  }

  const index = Math.min(
    Math.floor(
      Math.max(0, Math.min(randomValue, 1)) * candidates.length
    ),
    candidates.length - 1
  );

  return candidates[index];
}
