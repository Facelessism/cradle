// src/components/ProjectDirectory.tsx (Snippet Integration)

import React, { useState } from 'react';
import SurpriseMeButton, { Project } from './SurpriseMeButton';

export default function ProjectDirectory() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [activeModalProject, setActiveModalProject] = useState<Project | null>(null);

    // Mock project repository list
    const projects: Project[] = [
        { id: '1', title: 'AI Resume Analyzer', description: 'Intelligent career partner for resume optimization.', category: 'AI/ML' },
        { id: '2', title: 'CommitCV', description: 'Match GitHub projects to job descriptions automatically.', category: 'Tools' },
        { id: '3', title: 'Medgrid', description: 'Real-time hospital bed and resource availability tracker.', category: 'Healthcare' },
    ];

    // Filter projects based on search query and category
    const filteredProjects = projects.filter((p) => {
        const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              p.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <input 
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-80 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                />

                {/* Surprise Me Button Integration */}
                <SurpriseMeButton 
                    projects={projects}
                    filteredProjects={filteredProjects}
                    onSelectProject={(project) => setActiveModalProject(project)}
                />
            </div>

            {/* Project Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                    <div 
                        key={project.id}
                        onClick={() => setActiveModalProject(project)}
                        className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-500 cursor-pointer shadow-sm transition-all">
                        <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                            {project.category}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-3">{project.title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{project.description}</p>
                    </div>
                ))}
            </div>

            {/* Active Project Details Modal Preview */}
            {activeModalProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-xl font-bold text-slate-900">{activeModalProject.title}</h3>
                            <button 
                                onClick={() => setActiveModalProject(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                                &times;
                            </button>
                        </div>
                        <p className="text-sm text-slate-600">{activeModalProject.description}</p>
                        <div className="flex justify-end pt-3 border-t">
                            <button
                                onClick={() => setActiveModalProject(null)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium">
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
