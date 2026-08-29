import React from 'react';

export const ProjectThumbnail = ({ projectTitle, projectId, thumbnailSvgPath }) => {
  return (
    <div className="thumbnail-card border rounded p-4 bg-slate-900 text-white">
      {/* 
        Ensures the thumbnail acts as an accessible interactive control.
        Passing aria-label clearly exposes its operational purpose to screen readers.
      */}
      <button
        type="button"
        className="interactive-svg-trigger focus:outline-none focus:ring-2 focus:ring-amber-500"
        aria-label={`Open interactive project blueprint for ${projectTitle}`}
        onClick={() => console.log(`Navigating to project layout: ${projectId}`)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          className="w-full h-auto max-w-xs"
          role="img"
        >
          {/* Main accessible title node within the SVG block */}
          <title>{`Interactive diagram preview of ${projectTitle}`}</title>
          
          {/* Explicitly hides geometric vector paths from assistive tool text streams */}
          <path
            d={thumbnailSvgPath || "M10 10 H 90 V 90 H 10 Z"}
            fill="currentColor"
            className="text-amber-500"
            aria-hidden="true"
          />
        </svg>
      </button>
      <h3 className="mt-2 text-sm font-semibold text-center">{projectTitle}</h3>
    </div>
  );
};

export default ProjectThumbnail;
