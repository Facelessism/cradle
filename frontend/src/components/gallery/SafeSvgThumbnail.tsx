import React from 'react';

interface SafeSvgProps {
  svgContentBase64: string; // Sanitized SVG string pre-converted to base64
  altText?: string;
}

export default function SafeSvgThumbnail({ svgContentBase64, altText = "Project thumbnail" }: SafeSvgProps) {
  // Parsing SVGs via an standard image source tag inherently breaks script 
  // execution lifecycles in all modern browsers, executing a reliable secondary containment wall.
  const imgSrc = `data:image/svg+xml;base64,${svgContentBase64}`;

  return (
    <div className="w-full aspect-video bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center group">
      <img 
        src={imgSrc} 
        alt={altText}
        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}
