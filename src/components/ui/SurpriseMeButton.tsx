// src/components/SurpriseMeButton.tsx

import React, { useState } from 'react';

export interface Project {
    id: string;
    title: string;
    description: string;
    category: string;
}

interface SurpriseMeButtonProps {
    projects: Project[];
    filteredProjects: Project[];
    onSelectProject: (project: Project) => void;
}

export default function SurpriseMeButton({
    projects,
    filteredProjects,
    onSelectProject,
}: SurpriseMeButtonProps) {
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleSurpriseMe = () => {
        const pool = filteredProjects.length > 0 ? filteredProjects : projects;
        
        if (pool.length === 0) return;

        setIsAnimating(true);

        setTimeout(() => {
            // Filter out the last selected project if multiple options exist to prevent immediate repetition
            let availablePool = pool;
            if (pool.length > 1 && lastSelectedId) {
                availablePool = pool.filter((p) => p.id !== lastSelectedId);
            }

            const randomIndex = Math.floor(Math.random() * availablePool.length);
            const selected = availablePool[randomIndex];

            setLastSelectedId(selected.id);
            setIsAnimating(false);
            onSelectProject(selected);
        }, 300); // Visual animation delay
    };

    const hasProjects = (filteredProjects.length > 0 || projects.length > 0);

    return (
        <button
            type="button"
            onClick={handleSurpriseMe}
            disabled={!hasProjects || isAnimating}
            className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl shadow-md hover:from-indigo-700 hover:to-violet-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                isAnimating ? 'animate-pulse' : ''
            }`}
            title="Discover a random project">
            <span className="text-lg">🎲</span>
            <span>Surprise Me</span>
        </button>
    );
}
