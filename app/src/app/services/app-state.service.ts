import { Injectable, signal, computed } from '@angular/core';

export interface NodeStyle {
  fontWeight?: string;
  fontStyle?: string;
  shape?: 'rect' | 'rounded' | 'pill' | 'diamond';
  backgroundColor?: string;
  color?: string;
}

export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  width?: number;
  height?: number;
  style?: NodeStyle;
  isCollapsed?: boolean;
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
  selectedNodeId = signal<string | null>(null); // Focused node for keyboard navigation
  selectedNodeIds = signal<Set<string>>(new Set()); // Multi-select support
  navigationLockLevel = signal<number | null>(null); // Level-lock navigation state
  globalCollapseLevel = signal<number | null>(null); // Current folding level (Ctrl+N)
  nodesLoadedFromStorage = false;

  // Computed signal for visible nodes (handling folded branches)
  visibleNodes = computed(() => {
    const allNodes = this.nodes();
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    
    // Helper to check visibility
    const isVisible = (nodeId: string): boolean => {
      const node = nodeMap.get(nodeId);
      if (!node) return false;
      if (!node.parentId) return true; // Root is always visible
      
      const parent = nodeMap.get(node.parentId);
      if (!parent) return true; // Orphaned?
      
      if (parent.isCollapsed) return false; // Parent is collapsed, so I am hidden
      
      return isVisible(parent.id); // Check ancestor
    };

    return allNodes.filter(n => isVisible(n.id));
  });

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
      text: '',
      x: viewportWidth / 2 - 75,
      y: viewportHeight / 2 - 25,
      parentId: null
    };

    this.nodes.update(nodes => [...nodes, rootNode]);
    this.selectedNodeId.set(rootNode.id);
    this.selectedNodeIds.set(new Set()); // Don't add to multi-select by default

    // Add to history
    this.addToHistory('create', nodesBefore);

    return rootNode;
  }

  generateId(): string {
    return 'node-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  addChildNode(parentId: string, direction?: 'top' | 'bottom' | 'left' | 'right'): MindMapNode | null {
    const parent = this.nodes().find(n => n.id === parentId);
    if (!parent) return null;

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    let newX: number;
    let newY: number;

    if (direction) {
      // Add a random offset perpendicular to the direction
      // This prevents perfectly straight lines and creates beautiful curves
      const jitter = () => (Math.random() - 0.5) * 160; // +/- 80px offset for more curve

      switch (direction) {
        case 'right':
          newX = parent.x + (parent.width || 100) + 120; // Increased from 50 to 120
          newY = parent.y + jitter();
          break;
        case 'left':
          newX = parent.x - (parent.width || 100) - 120; // Increased from 50 to 120
          newY = parent.y + jitter();
          break;
        case 'bottom':
          newX = parent.x + jitter();
          newY = parent.y + (parent.height || 40) + 120; // Increased from 50 to 120
          break;
        case 'top':
          newX = parent.x + jitter();
          newY = parent.y - (parent.height || 40) - 120; // Increased from 50 to 120
          break;
        default:
          newX = parent.x + 200;
          newY = parent.y + jitter();
      }
    } else {
      // Generate random position around parent (one of 8 directions)
      const angle = Math.floor(Math.random() * 8) * (Math.PI / 4); // 0, 45, 90, ... degrees
      const distance = 120;
      newX = parent.x + Math.cos(angle) * distance - 50; // -50 to center horizontally
      newY = parent.y + Math.sin(angle) * distance - 20; // -20 to center vertically
    }

    const newNode: MindMapNode = {
      id: this.generateId(),
      text: '',
      x: newX,
      y: newY,
      parentId: parentId,
      style: parent.style ? { ...parent.style } : undefined // Inherit parent's style
    };

    this.nodes.update(nodes => [...nodes, newNode]);
    this.selectedNodeId.set(newNode.id);
    this.selectedNodeIds.set(new Set()); // Don't add to multi-select by default

    // Add to history
    this.addToHistory('create', nodesBefore);

    return newNode;
  }

  addSiblingNode(siblingId: string): MindMapNode | null {
    const sibling = this.nodes().find(n => n.id === siblingId);
    if (!sibling || !sibling.parentId) return null;

    const parent = this.nodes().find(n => n.id === sibling.parentId);
    if (!parent) return null;

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Determine layout direction based on relation to parent
    const dx = sibling.x - parent.x;
    const dy = sibling.y - parent.y;

    let newX = sibling.x;
    let newY = sibling.y;
    const gap = 60; // Standard gap between siblings

    // If mostly horizontal (Right/Left side), stack siblings VERTICALLY
    if (Math.abs(dx) > Math.abs(dy)) {
      newY += gap;
    } 
    // If mostly vertical (Top/Bottom side), stack siblings HORIZONTALLY
    else {
      newX += gap * 2; // Wider gap for horizontal text width
    }

    // Add a tiny jitter to keep lines organic
    const jitter = (Math.random() - 0.5) * 10;
    newX += jitter;
    newY += jitter;

    const newNode: MindMapNode = {
      id: this.generateId(),
      text: '',
      x: newX,
      y: newY,
      parentId: parent.id, // Same parent
      style: sibling.style ? { ...sibling.style } : undefined // Inherit sibling's style
    };

    this.nodes.update(nodes => [...nodes, newNode]);
    this.selectedNodeId.set(newNode.id);
    this.selectedNodeIds.set(new Set()); // Don't add to multi-select by default

    // Add to history
    this.addToHistory('create', nodesBefore);

    return newNode;
  }

  /**
   * Demotes a node (makes it a child of its previous sibling).
   * Analogous to Indent (Alt + Right).
   */
  demoteNode(nodeId: string): void {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node || !node.parentId) return; // Can't demote root

    // Find all siblings in order
    const siblings = this.nodes().filter(n => n.parentId === node.parentId);
    // Sort logic? Currently we rely on creation order (array order).
    // Let's stick to array index for "previous sibling".
    const nodeIndex = siblings.findIndex(n => n.id === nodeId);
    
    if (nodeIndex <= 0) return; // No previous sibling to become parent of

    const newParent = siblings[nodeIndex - 1];
    
    // Save state
    const nodesBefore = [...this.nodes()];

    this.nodes.update(nodes =>
      nodes.map(n =>
        n.id === nodeId ? { ...n, parentId: newParent.id } : n
      )
    );

    this.addToHistory('move', nodesBefore);
  }

  /**
   * Promotes a node (makes it a sibling of its parent).
   * Analogous to Outdent (Alt + Left).
   */
  promoteNode(nodeId: string): void {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node || !node.parentId) return;

    const parent = this.nodes().find(n => n.id === node.parentId);
    if (!parent) return; // Should not happen

    // If parent is root (has no parentId), we can't promote further 
    // (unless we support multiple roots, but let's stick to single root for now)
    if (!parent.parentId) return; 

    // Save state
    const nodesBefore = [...this.nodes()];

    this.nodes.update(nodes =>
      nodes.map(n =>
        n.id === nodeId ? { ...n, parentId: parent.parentId } : n
      )
    );

    this.addToHistory('move', nodesBefore);
  }

  getNodeDepth(nodeId: string): number {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node) return 0;
    if (!node.parentId) return 0; // Root is depth 0 (or 1 depending on preference, let's say 0)
    return 1 + this.getNodeDepth(node.parentId);
  }

  /**
   * Toggles the collapsed state of a node
   */
  toggleNodeCollapse(nodeId: string): void {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node) return;

    // Save state
    const nodesBefore = [...this.nodes()];

    this.nodes.update(nodes =>
      nodes.map(n =>
        n.id === nodeId ? { ...n, isCollapsed: !n.isCollapsed } : n
      )
    );

    this.addToHistory('update', nodesBefore);
  }

  /**
   * Sets the global collapse level (Ctrl + Number)
   * Collapses all nodes at depth >= level
   */
  setGlobalCollapseLevel(level: number): void {
    // Conflict Resolution: If we fold up to Level X, we cannot be locked to Level Y where Y > X
    // because Level Y is now hidden. (Level X itself is visible as the leaf level)
    const currentLock = this.navigationLockLevel();
    if (currentLock !== null && currentLock > level) {
      this.navigationLockLevel.set(null);
    }
    
    this.globalCollapseLevel.set(level);

    // Save state
    const nodesBefore = [...this.nodes()];

    this.nodes.update(nodes =>
      nodes.map(n => {
        const depth = this.getNodeDepth(n.id);
        return {
          ...n,
          isCollapsed: depth >= level
        };
      })
    );

    this.addToHistory('update', nodesBefore);
  }

  /**
   * Sets the navigation lock level (Shift + Number)
   * Prevents locking to a level that is currently folded/hidden
   */
  setNavigationLockLevel(level: number | null): void {
    if (level === null) {
      this.navigationLockLevel.set(null);
      return;
    }

    const currentFold = this.globalCollapseLevel();
    
    // Conflict Resolution: Cannot lock to Level Y if we are folded at Level X where Y > X
    if (currentFold !== null && level > currentFold) {
      // Block if attempting to lock to a hidden level
      return;
    }

    this.navigationLockLevel.set(level);
  }

  /**
   * Expands all nodes
   */
  expandAll(): void {
    this.globalCollapseLevel.set(null);
    const nodesBefore = [...this.nodes()];
    this.nodes.update(nodes => nodes.map(n => ({ ...n, isCollapsed: false })));
    this.addToHistory('update', nodesBefore);
  }

  deleteSelectedNode(selectedId: string): void {
    // Get all selected nodes or just the single one
    const selectedIds = this.selectedNodeIds().size > 0
      ? Array.from(this.selectedNodeIds())
      : [selectedId];

    if (selectedIds.length === 0) return;

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Delete all selected nodes and their descendants
    const nodesToDelete = new Set<string>();

    for (const id of selectedIds) {
      const nodeToDelete = this.nodes().find(n => n.id === id);
      // Prevent deleting root node (node without parent)
      if (!nodeToDelete || !nodeToDelete.parentId) {
        continue;
      }

      // Add this node and all its descendants to delete set
      this.nodes().forEach(node => {
        if (this.isDescendant(node.id, id)) {
          nodesToDelete.add(node.id);
        }
      });
    }

    // Keep only nodes that are not in the delete set
    const nodesToKeep = this.nodes().filter(node => !nodesToDelete.has(node.id));

    this.nodes.set(nodesToKeep);
    this.clearSelection();

    // Add to history
    this.addToHistory('delete', nodesBefore);
  }

  selectNode(nodeId: string, multiSelect: boolean = false): void {
    if (multiSelect) {
      // Multi-select: toggle this node in the selection
      this.toggleNodeSelection(nodeId);
    } else {
      // Single select: clear previous selection and select only this node
      this.selectedNodeId.set(nodeId);
      this.selectedNodeIds.set(new Set([nodeId]));
    }
  }

  /**
   * Toggle a node in/out of multi-selection (M key or Ctrl+Click)
   */
  toggleNodeSelection(nodeId: string): void {
    const currentSelection = new Set(this.selectedNodeIds());

    if (currentSelection.has(nodeId)) {
      // Node is already in multi-select, remove it
      currentSelection.delete(nodeId);
    } else {
      // Node is not in multi-select, add it
      currentSelection.add(nodeId);
    }

    this.selectedNodeIds.set(currentSelection);

    // Update focused node to this node
    this.selectedNodeId.set(nodeId);
  }

  /**
   * Check if a node is in the multi-selection
   */
  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds().has(nodeId);
  }

  /**
   * Clear all multi-selections
   */
  clearSelection(): void {
    this.selectedNodeIds.set(new Set());
    this.selectedNodeId.set(null);
  }

  /**
   * Select all nodes
   */
  selectAll(): void {
    const allIds = new Set(this.nodes().map(n => n.id));
    this.selectedNodeIds.set(allIds);
    // Keep current focused node or select first
    if (!this.selectedNodeId() || !allIds.has(this.selectedNodeId()!)) {
      this.selectedNodeId.set(this.nodes()[0]?.id || null);
    }
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

    // Calculate delta for moving multiple selected nodes together
    const deltaX = x - node.x;
    const deltaY = y - node.y;

    // Get all selected nodes
    const selectedIds = this.selectedNodeIds();

    // If dragging, update position without creating history
    // History will be created when drag ends
    if (selectedIds.size > 1 && selectedIds.has(nodeId)) {
      // Move all selected nodes together
      this.nodes.update(nodes =>
        nodes.map(n =>
          selectedIds.has(n.id) ? { ...n, x: n.x + deltaX, y: n.y + deltaY } : n
        )
      );
    } else {
      // Move only this node
      this.nodes.update(nodes =>
        nodes.map(n =>
          n.id === nodeId ? { ...n, x, y } : n
        )
      );
    }

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

  updateNodeStyle(nodeId: string, style: Partial<NodeStyle>): void {
    // Get all selected nodes or just the single one
    const selectedIds = this.selectedNodeIds().size > 0
      ? Array.from(this.selectedNodeIds())
      : [nodeId];

    // Save current state before modification
    const nodesBefore = [...this.nodes()];

    // Update style for all selected nodes
    this.nodes.update(nodes =>
      nodes.map(n =>
        selectedIds.includes(n.id) ? {
          ...n,
          style: { ...(n.style || {}), ...style }
        } : n
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
    const nodesList = this.visibleNodes(); // Use visible nodes only
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
      text: '',
      x: viewportWidth / 2 - 75,
      y: viewportHeight / 2 - 25,
      parentId: null
    };

    // Clear all nodes and add the new root node
    this.nodes.set([rootNode]);
    this.selectedNodeId.set(rootNode.id);
    this.selectedNodeIds.set(new Set()); // Don't add to multi-select by default

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

  /**
   * Auto-spread nodes using fractal/proportional allocation with 2D adaptive spacing
   */
  autoSpreadNodes(): void {
    const nodesBefore = [...this.nodes()];

    // Find root node
    const rootNode = this.nodes().find(n => !n.parentId);
    if (!rootNode) return;

    // Center the root node at viewport center
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = viewportWidth / 2 - 75;
    const centerY = viewportHeight / 2 - 25;

    // Get all nodes organized by parent
    const nodesByParent = new Map<string | null, MindMapNode[]>();
    this.nodes().forEach(node => {
      if (!nodesByParent.has(node.parentId)) {
        nodesByParent.set(node.parentId, []);
      }
      nodesByParent.get(node.parentId)!.push(node);
    });

    // Count descendants for each node (for proportional space allocation)
    const descendantCount = new Map<string, number>();

    const countDescendants = (nodeId: string): number => {
      if (descendantCount.has(nodeId)) {
        return descendantCount.get(nodeId)!;
      }

      const children = nodesByParent.get(nodeId) || [];
      let count = children.length;

      for (const child of children) {
        count += countDescendants(child.id);
      }

      descendantCount.set(nodeId, count);
      return count;
    };

    // Calculate descendant counts for all nodes
    countDescendants(rootNode.id);

    // Track positioned nodes with dimensions
    const positionedNodes = new Map<string, { x: number, y: number, width: number, height: number }>();

    // Place root at center
    positionedNodes.set(rootNode.id, {
      x: centerX,
      y: centerY,
      width: rootNode.width || 100,
      height: rootNode.height || 40
    });

    // Helper to check if angle is vertical (top or bottom)
    const isVerticalAngle = (angle: number): boolean => {
      const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      // Check if near top (around 3π/2) or bottom (around π/2)
      return (normalized > Math.PI * 0.25 && normalized < Math.PI * 0.75) ||
             (normalized > Math.PI * 1.25 && normalized < Math.PI * 1.75);
    };

    // Recursive function to position nodes with adaptive 2D spacing
    const positionChildren = (
      parentId: string,
      parentX: number,
      parentY: number,
      startAngle: number,
      endAngle: number,
      depth: number
    ) => {
      const children = nodesByParent.get(parentId) || [];
      if (children.length === 0) return;

      // Sort children by their current angle to maintain visual consistency
      const childrenWithAngles = children.map(child => {
        const dx = child.x - parentX;
        const dy = child.y - parentY;
        const currentAngle = Math.atan2(dy, dx);
        return { child, currentAngle };
      });
      childrenWithAngles.sort((a, b) => a.currentAngle - b.currentAngle);

      // Calculate total descendants to determine proportional allocation
      const totalDescendants = childrenWithAngles.reduce((sum, item) => {
        return sum + (descendantCount.get(item.child.id) || 0) + 1;
      }, 0);

      // Calculate base radius with different scaling for first level vs deeper levels
      let baseRadius: number;
      let depthMultiplier: number;

      if (depth === 1) {
        // First level children: keep normal distance
        baseRadius = 25;
        depthMultiplier = 1;
      } else {
        // Second level and beyond: 
        baseRadius = 25; 
        depthMultiplier = Math.pow(0.5, depth - 1); 
      }

      // Calculate minimum radius needed to fit all children based on arc length
      const angularSpan = endAngle - startAngle;
      // Increase node width estimate for vertical positions
      const avgNodeWidth = 5;
      const minRadius = (children.length * avgNodeWidth) / angularSpan;

      // Use the larger of the two radii
      let radiusx = Math.max(baseRadius * depthMultiplier, minRadius) * (Math.random()+0.2);
      let radiusy = Math.max(baseRadius * depthMultiplier, minRadius) * (Math.random()+0.2);

      // Add organic randomization to first level only
      const angleOffset = (depth === 1) ? (Math.random() - 0.5) * Math.PI / 6 : 0; // ±15 degrees

      // Allocate angular space proportionally
      let currentAngle = startAngle;
      const childPositions: Array<{ child: MindMapNode, x: number, y: number, angle: number, angularPortion: number }> = [];

      for (const item of childrenWithAngles) {
        const childDescendants = (descendantCount.get(item.child.id) || 0) + 1;
        const angularPortion = ((endAngle - startAngle) * childDescendants) / totalDescendants;

        // Position this child at the center of its allocated angular space
        let childAngle = currentAngle + angularPortion;

        // Apply randomization for first level
        if (depth === 1) {
          childAngle += angleOffset;
        }

        // Calculate initial position
        let childX = parentX + Math.cos(childAngle) * radiusx;
        let childY = parentY + Math.sin(childAngle) * radiusy;

        childPositions.push({
          child: item.child,
          x: childX,
          y: childY,
          angle: childAngle,
          angularPortion
        });

        currentAngle += angularPortion;
      }

      // Check for collisions and adjust radius if needed
      let hasCollision = true;
      let maxIterations = 15; // Increased from 10
      let iteration = 0;

      while (hasCollision && iteration < maxIterations) {
        hasCollision = false;
        iteration++;

        // Check collisions between all positioned nodes
        for (let i = 0; i < childPositions.length; i++) {
          const pos1 = childPositions[i];
          const isPos1Vertical = isVerticalAngle(pos1.angle);

          // Check against all other positioned nodes (not just siblings)
          for (const [existingId, existingPos] of positionedNodes.entries()) {
            if (existingId === parentId) continue;

            const dx = pos1.x - existingPos.x;
            const dy = pos1.y - existingPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // More aggressive spacing for vertical positions
            const minDistance = isPos1Vertical ? 180 : 110; // Increased vertical from 140 to 180

            if (distance < minDistance) {
              hasCollision = true;
              break;
            }
          }

          if (hasCollision) break;

          // Also check against siblings
          for (let j = i + 1; j < childPositions.length; j++) {
            const pos2 = childPositions[j];
            const isPos2Vertical = isVerticalAngle(pos2.angle);

            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If both are vertical, need even more space
            let minDistance: number;
            if (isPos1Vertical && isPos2Vertical) {
              minDistance = 200; // Both vertical
            } else if (isPos1Vertical || isPos2Vertical) {
              minDistance = 160; // One vertical
            } else {
              minDistance = 110; // Neither vertical
            }

            if (distance < minDistance) {
              hasCollision = true;
              break;
            }
          }

          if (hasCollision) break;
        }

        // If collision detected, increase radius and recalculate
        if (hasCollision) {
          radiusx *= 1.25; // Increased from 1.2
          radiusy *= 1.25; // Increased from 1.2

          for (const pos of childPositions) {
            pos.x = parentX + Math.cos(pos.angle) * radiusx;
            pos.y = parentY + Math.sin(pos.angle) * radiusy;
          }
        }
      }

      // Commit positions and recurse
      let currentAngleForRecursion = startAngle;
      for (const pos of childPositions) {
        const childDescendants = (descendantCount.get(pos.child.id) || 0) + 1;
        const angularPortion = ((endAngle - startAngle) * childDescendants) / totalDescendants;

        positionedNodes.set(pos.child.id, {
          x: pos.x,
          y: pos.y,
          width: pos.child.width || 100,
          height: pos.child.height || 40
        });

        // Recursively position this child's descendants within its allocated angular space
        positionChildren(
          pos.child.id,
          pos.x,
          pos.y,
          currentAngleForRecursion,
          currentAngleForRecursion + angularPortion,
          depth + 1
        );

        currentAngleForRecursion += angularPortion;
      }
    };

    // Start the recursive positioning from the root with random angle offset
    const initialAngleOffset = (Math.PI / 6) + Math.random() * (Math.PI / 9); // Random 30-50 degree rotation
    positionChildren(rootNode.id, centerX, centerY, initialAngleOffset, initialAngleOffset + 2 * Math.PI, 1);

    // Update all node positions
    this.nodes.update(nodes =>
      nodes.map(n => {
        const newPos = positionedNodes.get(n.id);
        return newPos ? { ...n, x: newPos.x, y: newPos.y } : n;
      })
    );

    // Add to history
    this.addToHistory('move', nodesBefore);
  }
}
