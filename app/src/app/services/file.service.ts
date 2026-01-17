import { Injectable } from '@angular/core';
import { AppStateService } from './app-state.service';

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  width?: number;
  height?: number;
}

interface MindMapFile {
  version: string;
  metadata: {
    title: string;
    author?: string;
    created: string;
    modified: string;
    description?: string;
    tags?: string[];
    extra?: any;
  };
  nodes: Array<{
    id: string;
    parentId: string | null;
    text: string;
    type: 'root' | 'topic';
    position: { x: number; y: number };
    style: {
      color?: string;
      backgroundColor?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: string;
      shape?: 'rect' | 'rounded' | 'pill' | 'diamond';
    };
    collapsed: boolean;
    extra?: any;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  constructor(private appState: AppStateService) {}

  /**
   * Exports the current mind map to a .mind file and triggers download
   */
  export(): void {
    const nodes = this.appState.nodes();
    if (nodes.length === 0) return;

    // Convert internal nodes to MINDFILE.md format
    const mindMapFile: MindMapFile = {
      version: '1',
      metadata: {
        title: 'Mind Map',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      },
      nodes: nodes.map(node => ({
        id: node.id,
        parentId: node.parentId,
        text: node.text,
        type: node.parentId === null ? 'root' : 'topic',
        position: { x: node.x, y: node.y },
        style: {
          color: node.style?.color || '#000000',
          backgroundColor: node.style?.backgroundColor || '#ffffff',
          fontSize: 14,
          fontWeight: node.style?.fontWeight || (node.parentId === null ? 'bold' : 'normal'),
          fontStyle: node.style?.fontStyle || 'normal',
          shape: node.style?.shape || 'rounded'
        },
        collapsed: false,
        extra: {}
      }))
    };

    // Create JSON string
    const jsonStr = JSON.stringify(mindMapFile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${new Date().toISOString().split('T')[0]}.mind`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports a mind map from a .mind file
   * @param file The uploaded .mind file
   */
  import(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const result = event.target?.result as string;
          const mindMapFile: MindMapFile = JSON.parse(result);

          // Validate required fields
          if (!mindMapFile.version || !mindMapFile.nodes || !Array.isArray(mindMapFile.nodes)) {
            throw new Error('Invalid mind map file format');
          }

          // Convert MINDFILE.md nodes to internal format
          const internalNodes: MindMapNode[] = mindMapFile.nodes.map(node => ({
            id: node.id,
            parentId: node.parentId,
            text: node.text,
            x: node.position?.x || 0,
            y: node.position?.y || 0,
            style: {
              color: node.style?.color,
              backgroundColor: node.style?.backgroundColor,
              fontWeight: node.style?.fontWeight,
              fontStyle: node.style?.fontStyle,
              shape: node.style?.shape
            }
          }));

          // Update app state
          this.appState.nodes.set(internalNodes);

          // Select the root node if it exists
          const rootNode = internalNodes.find(n => n.parentId === null);
          if (rootNode) {
            this.appState.selectedNodeId.set(rootNode.id);
          }

          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to parse mind map file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Fits the map view after import
   */
  fitViewAfterImport(): void {
    // This method is a placeholder for the navbar to call after import
    // The actual implementation will be handled in the navbar component
  }

  /**
   * Exports the current mind map to a Mermaid (.mmd) file
   */
  exportMermaid(): void {
    const nodes = this.appState.nodes();
    if (nodes.length === 0) return;

    let mermaidContent = 'mindmap\n';
    
    // Find root
    const root = nodes.find(n => !n.parentId);
    if (!root) return;

    // Helper to escape text for Mermaid
    const escapeText = (text: string) => {
      // Mermaid mindmaps don't like parentheses inside the text without quotes
      return text.replace(/[()]/g, '');
    };

    // Recursive traverse
    const traverse = (nodeId: string, depth: number) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      const indent = '  '.repeat(depth + 1);
      
      // Determine shape syntax (Mermaid mindmap shapes: (), [], etc are not fully standard across all parsers yet, 
      // but standard indentation is robust).
      // Let's stick to simple text for compatibility, or basic shapes if supported.
      // Standard Mermaid mindmap just uses indentation.
      
      let line = `${indent}${escapeText(node.text) || 'New Idea'}`;
      
      // Add ID or class? Mermaid mindmap is simple.
      mermaidContent += `${line}\n`;

      const children = nodes.filter(n => n.parentId === nodeId);
      children.forEach(child => traverse(child.id, depth + 1));
    };

    traverse(root.id, 0);

    // Download
    const blob = new Blob([mermaidContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${new Date().toISOString().split('T')[0]}.mmd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports a Mermaid (.mmd) file
   */
  importMermaid(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const lines = content.split('\n');
          
          if (!lines[0].trim().startsWith('mindmap')) {
            throw new Error('Invalid Mermaid file: Must start with "mindmap"');
          }

          const newNodes: MindMapNode[] = [];
          const stack: { id: string, indent: number }[] = [];
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          // Helper to calculate indentation level (2 spaces = 1 level)
          const getIndent = (line: string) => {
            const match = line.match(/^(\s*)/);
            return match ? match[1].length : 0;
          };

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const indent = getIndent(line);
            const text = line.trim();
            const id = this.appState.generateId(); // Use service's generator

            // Determine parent
            // We need to find the last node in the stack with indentation < current indent
            while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
              stack.pop();
            }

            const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

            // Random position for initial import
            const x = (viewportWidth / 2) + (Math.random() - 0.5) * 500;
            const y = (viewportHeight / 2) + (Math.random() - 0.5) * 500;

            const newNode: any = { // Cast to any to match internal structure
              id,
              text,
              parentId,
              x, 
              y,
              style: {
                shape: 'rounded',
                backgroundColor: '#ffffff',
                color: '#000000'
              }
            };

            newNodes.push(newNode);
            stack.push({ id, indent });
          }

          this.appState.nodes.set(newNodes);
          
          // Select root
          const root = newNodes.find(n => !n.parentId);
          if (root) this.appState.selectedNodeId.set(root.id);

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  }
}

