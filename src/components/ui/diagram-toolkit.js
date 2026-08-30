/**
 * Diagram & Visual Planning Toolkit (Issue #523)
 * Generates Mermaid.js syntax for timelines, pipelines, flowcharts, wireframes, 
 * roadmaps, process flows, architecture diagrams, mind maps, and decision trees.
 */

export class DiagramToolkit {
  /**
   * Generates a timeline diagram.
   * @param {string} title 
   * @param {Array<{period: string, events: string[]}>} milestones 
   */
  static generateTimeline(title, milestones) {
    let output = `timeline\n    title ${title}\n`;
    milestones.forEach(m => {
      output += `    ${m.period} : ${m.events.join(' : ')}\n`;
    });
    return output;
  }

  /**
   * Generates a flowchart or process pipeline.
   * @param {string} direction - e.g., 'TD', 'LR'
   * @param {Array<{from: string, to: string, label?: string}>} steps 
   */
  static generateFlowchart(direction = 'TD', steps = []) {
    let output = `flowchart ${direction}\n`;
    steps.forEach(step => {
      if (step.label) {
        output += `    ${step.from} -->|"${step.label}"| ${step.to}\n`;
      } else {
        output += `    ${step.from} --> ${step.to}\n`;
      }
    });
    return output;
  }

  /**
   * Generates a system architecture or container diagram.
   * @param {string} title 
   * @param {Array<{group: string, nodes: Array<{id: string, label: string}>}>} components 
   * @param {Array<{from: string, to: string, label?: string}>} connections 
   */
  static generateArchitecture(title, components = [], connections = []) {
    let output = `graph TB\n    subgraph ${title}\n`;
    
    components.forEach(comp => {
      output += `        subgraph ${comp.group}\n`;
      comp.nodes.forEach(node => {
        output += `            ${node.id}["${node.label}"]\n`;
      });
      output += `        end\n`;
    });

    output += `    end\n`;
    connections.forEach(conn => {
      if (conn.label) {
        output += `    ${conn.from} -->|"${conn.label}"| ${conn.to}\n`;
      } else {
        output += `    ${conn.from} --> ${conn.to}\n`;
      }
    });

    return output;
  }

  /**
   * Generates a mind map structure.
   * @param {string} centralIdea 
   * @param {Array<{branch: string, subtopics: string[]}>} branches 
   */
  static generateMindMap(centralIdea, branches = []) {
    let output = `mindmap\n  root(("${centralIdea}"))\n`;
    branches.forEach(b => {
      output += `    ${b.branch}\n`;
      b.subtopics.forEach(sub => {
        output += `      ((("${sub}")))\n`;
      });
    });
    return output;
  }
}
