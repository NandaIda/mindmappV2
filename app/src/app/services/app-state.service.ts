import { Injectable, signal } from '@angular/core';

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  width?: number;
  height?: number;
}

interface HistoryEntry {
  type: 'create' | 'delete' | 'update' | 'move';
  timestamp: number;
  nodesBefore: MindMapNode[];
  nodesAfter: MindMapNode[];
}

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  nodes = signal<MindMapNode[]>([]);
  selectedNodeId = signal<string | null>(null);
  nodesLoadedFromStorage = false;

  // Undo/redo functionality
  private undoHistory: HistoryEntry[] = [];
  private redoHistory: HistoryEntry[] = [];
  private HISTORY_LIMIT = 50;

  // Drag tracking to batch position updates
  private isDragging = false;
  private dragStartNodes: MindMapNode[] = [];

  constructor() {
    // Load initial state from localStorage if available
    this.loadInitialState();
  }

  private loadInitialState(): void {
    const savedNodes = localStorage.getItem('mindmapNodes');
    if (savedNodes) {
      try {
        const parsedNodes = JSON.parse(savedNodes);
        this.nodes.set(parsedNodes);
        this.nodesLoadedFromStorage = true;
        
        // Clear history when loading from storage (we don't know the history of previous sessions)
        this.clearHistory();
      } catch (e) {
        console.error('Error parsing saved nodes', e);
      }
    }
  }

  saveState(): void {
    localStorage.setItem('mindmapNodes', JSON.stringify(this.nodes()));
    
    // Also save undo/redo history to localStorage for persistence
    localStorage.setItem('mindmapHistory', JSON.stringify({
      undo: this.undoHistory,
      redo: this.redoHistory
    }));
  }

  private loadHistory(): void {
    const savedHistory = localStorage.getItem('mindmapHistory');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        this.undoHistory = parsedHistory.undo || [];
        this.redoHistory = parsedHistory.redo || [];
      } catch (e) {
        console.error('Error parsing saved history', e);
        this.clearHistory();
      }
    }
  }

  private clearHistory(): void {
    this.undoHistory = [];
    this.redoHistory = [];
    localStorage.removeItem('mindmapHistory');
  }

  private addToHistory(type: 'create' | 'delete' | 'update' | 'move', nodesBefore: MindMapNode[]): void {
    const nodesAfter = [...this.nodes()];
    
    // Create a new history entry
    const entry: HistoryEntry = {
      type,
      timestamp: Date.now(),
      nodesBefore: nodesBefore.map(node => ({ ...node })), // Deep copy
      nodesAfter: nodesAfter.map(node => ({ ...node }))    // Deep copy
    };

    // Add to undo history
    this.undoHistory.push(entry);
    
    // Enforce history limit
    if (this.undoHistory.length > this.HISTORY_LIMIT) {
      this.undoHistory.shift();
    }
    
    // Clear redo history when making a new change
    this.redoHistory = [];
    
    // Save state
    this.saveState();
  }

  createRootNode(): MindMapNode {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Create root node in the center
    const rootNode: MindMapNode = {
      id: this.generateId(),
      text: 'Central Topic',
      x: viewportWidth / 2 - 75,
      y: viewportHeight / 2 - 25,
      parentId: null
    };

    this.nodes.update(nodes => [...nodes, rootNode]);
    this.selectedNodeId.set(rootNode.id);
    
    // Add to history
    this.addToHistory('create', nodesBefore);

    return rootNode;
  }

  generateId(): string {
    return 'node-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  addChildNode(parentId: string): MindMapNode | null {
    const parent = this.nodes().find(n => n.id === parentId);
    if (!parent) return null;

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Generate random position around parent (one of 8 directions)
    const angle = Math.floor(Math.random() * 8) * (Math.PI / 4); // 0, 45, 90, ... degrees
    const distance = 120;
    const newX = parent.x + Math.cos(angle) * distance - 50; // -50 to center horizontally
    const newY = parent.y + Math.sin(angle) * distance - 20; // -20 to center vertically

    const newNode: MindMapNode = {
      id: this.generateId(),
      text: 'New Idea',
      x: newX,
      y: newY,
      parentId: parentId
    };

    this.nodes.update(nodes => [...nodes, newNode]);
    this.selectedNodeId.set(newNode.id);
    
    // Add to history
    this.addToHistory('create', nodesBefore);

    return newNode;
  }

  deleteSelectedNode(selectedId: string): void {
    if (!selectedId) return;

    // Prevent deleting root node (node without parent)
    const nodeToDelete = this.nodes().find(n => n.id === selectedId);
    if (!nodeToDelete || !nodeToDelete.parentId) {
      return;
    }

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Delete the node and all its descendants recursively
    const nodesToKeep = this.nodes().filter(node => {
      return !this.isDescendant(node.id, selectedId);
    });

    this.nodes.set(nodesToKeep);
    this.selectedNodeId.set(null);
    
    // Add to history
    this.addToHistory('delete', nodesBefore);
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
  }

  /**
   * Start tracking a drag operation - saves initial state before drag begins
   */
  startDrag(nodeId: string): void {
    this.isDragging = true;
    this.dragStartNodes = [...this.nodes()];
  }

  /**
   * End a drag operation - creates a single history entry for the entire drag
   */
  endDrag(): void {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;
    
    // Only add to history if positions actually changed
    const nodesChanged = !this.nodesEqual(this.dragStartNodes, this.nodes());
    if (nodesChanged) {
      this.addToHistory('move', this.dragStartNodes);
    }
    
    this.dragStartNodes = [];
  }

  /**
   * Helper to compare two node arrays for equality
   */
  private nodesEqual(nodes1: MindMapNode[], nodes2: MindMapNode[]): boolean {
    if (nodes1.length !== nodes2.length) return false;
    
    for (let i = 0; i < nodes1.length; i++) {
      const n1 = nodes1[i];
      const n2 = nodes2[i];
      if (n1.id !== n2.id || n1.x !== n2.x || n1.y !== n2.y || 
          n1.text !== n2.text || n1.parentId !== n2.parentId) {
        return false;
      }
    }
    return true;
  }

  updateNodePosition(nodeId: string, x: number, y: number): void {
    // Only record history for actual position changes
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node || (node.x === x && node.y === y)) {
      return;
    }

    // If dragging, update position without creating history
    // History will be created when drag ends
    this.nodes.update(nodes =>
      nodes.map(n =>
        n.id === nodeId ? { ...n, x, y } : n
      )
    );
    
    // Save state to localStorage but don't add to history during drag
    if (this.isDragging) {
      localStorage.setItem('mindmapNodes', JSON.stringify(this.nodes()));
    } else {
      // Save current state before modification
      const nodesBefore = [...this.nodes()];
      this.addToHistory('move', nodesBefore);
    }
  }

  updateNodeText(nodeId: string, newText: string): void {
    // Only record history for actual text changes
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node || node.text === newText) {
      return;
    }

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    this.nodes.update(nodes =>
      nodes.map(n =>
        n.id === nodeId ? { ...n, text: newText } : n
      )
    );
    
    // Add to history
    this.addToHistory('update', nodesBefore);
  }

  private isDescendant(childId: string, ancestorId: string): boolean {
    // Check if the child itself is the ancestor (should return true)
    if (childId === ancestorId) return true;

    const node = this.nodes().find(n => n.id === childId);
    if (!node) return false;

    let currentId: string | null = node.parentId;
    while (currentId) {
      if (currentId === ancestorId) return true;
      const parent = this.nodes().find(n => n.id === currentId);
      currentId = parent?.parentId || null;
    }
    return false;
  }

  getConnections(): { parent: MindMapNode, child: MindMapNode }[] {
    const nodesList = this.nodes();
    return nodesList.filter(node => node.parentId)
      .map(node => {
        const parent = nodesList.find(n => n.id === node.parentId);
        return parent ? { parent, child: node } : null;
      })
      .filter((conn): conn is {parent: MindMapNode, child: MindMapNode} => conn !== null);
  }

  resetMap(): void {
    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Create root node in the center
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rootNode: MindMapNode = {
      id: this.generateId(),
      text: 'Central Topic',
      x: viewportWidth / 2 - 75,
      y: viewportHeight / 2 - 25,
      parentId: null
    };

    // Clear all nodes and add the new root node
    this.nodes.set([rootNode]);
    this.selectedNodeId.set(rootNode.id);
    
    // Create a single history entry for the entire reset operation
    this.addToHistory('delete', nodesBefore);
  }

  /***************************
   * Undo/Redo Public Methods
   ***************************/

  canUndo(): boolean {
    return this.undoHistory.length > 0;
  }

  canRedo(): boolean {
    return this.redoHistory.length > 0;
  }

  undo(): void {
    if (!this.canUndo()) return;

    // Get the last entry from undo history
    const lastEntry = this.undoHistory.pop()!;
    
    // Save current state to redo history
    this.redoHistory.push({
      type: lastEntry.type,
      timestamp: Date.now(),
      nodesBefore: [...this.nodes()],
      nodesAfter: lastEntry.nodesAfter
    });

    // Restore the previous state
    this.nodes.set(lastEntry.nodesBefore);
    
    // Update selected node if it no longer exists in the restored state
    const selectedNodeStillExists = this.nodes().some(node => node.id === this.selectedNodeId());
    if (!selectedNodeStillExists) {
      this.selectedNodeId.set(null);
    }
    
    // Save state
    this.saveState();
  }

  redo(): void {
    if (!this.canRedo()) return;

    // Get the last entry from redo history
    const lastEntry = this.redoHistory.pop()!;
    
    // Save current state to undo history
    this.undoHistory.push({
      type: lastEntry.type,
      timestamp: Date.now(),
      nodesBefore: [...this.nodes()],
      nodesAfter: lastEntry.nodesAfter
    });

    // Restore the next state
    this.nodes.set(lastEntry.nodesAfter);
    
    // Update selected node if it was in the restored state
    const selectedNodeExists = this.nodes().some(node => node.id === this.selectedNodeId());
    if (selectedNodeExists) {
      this.selectedNodeId.set(this.selectedNodeId()); // Keep it selected
    } else {
      this.selectedNodeId.set(null);
    }
    
    // Save state
    this.saveState();
  }

  clearUndoHistory(): void {
    this.undoHistory = [];
    this.saveState();
  }

  clearRedoHistory(): void {
    this.redoHistory = [];
    this.saveState();
  }

  getUndoHistoryLength(): number {
    return this.undoHistory.length;
  }

  getRedoHistoryLength(): number {
    return this.redoHistory.length;
  }
}
