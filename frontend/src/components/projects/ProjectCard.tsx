import React from 'react';
import { sanitizeMetadata } from '../../utils/sanitize';

interface ProjectMetadata {
  id: string;
  title: string;
  description: string;
  author: string;
}

export default function ProjectCard({ project }: { project: ProjectMetadata }) {
  // Sanitize fields cleanly before DOM binding occurs
  const safeTitle = sanitizeMetadata(project.title);
  const safeDescription = sanitizeMetadata(project.description);
  const safeAuthor = sanitizeMetadata(project.author);

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-md text-white">
      <h3 className="text-lg font-bold text-zinc-100">{safeTitle}</h3>
      <p className="text-xs text-purple-400 mt-0.5">By {safeAuthor}</p>
      <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{safeDescription}</p>
    </div>
  );
}
