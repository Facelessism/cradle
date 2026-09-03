/**
 * Markdown Parser
 * Extracts [[wikilinks]] and builds a node/edge graph structure.
 */
export class GraphParser {
    static parse(notes) {
        const nodes = new Map();
        const edges = [];

        // Initialize nodes from note titles
        for (const note of notes) {
            nodes.set(note.title, { id: note.title, label: note.title, x: 0, y: 0, vx: 0, vy: 0 });
        }

        // Parse content for links
        const linkRegex = /\[\[(.*?)\]\]/g;

        for (const note of notes) {
            const sourceId = note.title;
            let match;

            while ((match = linkRegex.exec(note.content)) !== null) {
                const targetLabel = match[1].trim();

                // Ensure target node exists
                if (!nodes.has(targetLabel)) {
                    nodes.set(targetLabel, { id: targetLabel, label: targetLabel, x: 0, y: 0, vx: 0, vy: 0 });
                }

                // Add edge (avoid duplicates)
                const edgeExists = edges.some(e => e.source === sourceId && e.target === targetLabel);
                if (!edgeExists) {
                    edges.push({ source: sourceId, target: targetLabel });
                }
            }
        }

        return { nodes: Array.from(nodes.values()), edges };
    }
}
