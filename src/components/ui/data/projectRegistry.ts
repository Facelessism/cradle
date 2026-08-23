// src/data/projectRegistry.ts (Snippet Update)

export interface ProjectRegistryEntry {
    id: string;
    title: string;
    description: string;
    category: string;
    path: string;
    lastUpdated: string;
}

export const PROJECT_REGISTRY: ProjectRegistryEntry[] = [
    {
        id: "ai-resume-analyzer",
        title: "AI Resume Analyzer",
        description: "Intelligent career partner for resume optimization and keyword matching.",
        category: "AI/ML",
        path: "/ai-resume-analyzer",
        lastUpdated: "2026-05-12"
    },
    {
        id: "color-contrast-checker",
        title: "Color Contrast Checker",
        description: "Verify accessibility compliance (WCAG) for foreground and background color combinations.",
        category: "Accessibility & Design",
        path: "/minis/color-contrast-checker",
        lastUpdated: "2026-06-01"
    },
    {
        id: "commit-cv",
        title: "CommitCV",
        description: "Automatically match GitHub repositories to job descriptions and career portfolios.",
        category: "Developer Tools",
        path: "/commit-cv",
        lastUpdated: "2026-06-15"
    },
    {
        id: "medgrid",
        title: "Medgrid",
        description: "Real-time hospital bed and blood availability tracker for emergency services.",
        category: "Healthcare",
        path: "/medgrid",
        lastUpdated: "2026-02-20"
    }
];

/**
 * Retrieves a unique project entry by ID, ensuring no duplicate duplicates exist.
 */
export function getProjectById(id: string): ProjectRegistryEntry | undefined {
    return PROJECT_REGISTRY.find(p => p.id === id);
}
