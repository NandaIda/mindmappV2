import { Component, ViewChild, ElementRef, AfterViewInit, Input, HostListener, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { FileService } from '../../services/file.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { HelpModalComponent } from '../help-modal/help-modal.component';
import { KeyboardShortcutService, KeyCommand } from '../../services/keyboard-shortcut.service';

@Component({
  selector: 'app-mindmap',  standalone: true,
  templateUrl: './mindmap.component.html',
  styleUrl: './mindmap.component.scss'
})
  export class MindMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('nodesLayer') nodesLayer!: ElementRef<HTMLElement>;
  @ViewChild('svgLayer') svgLayer!: ElementRef<SVGElement>;
  @ViewChild('mindmapContainer') mindmapContainer!: ElementRef<HTMLElement>;

  private modalService = inject(NgbModal);
  private shortcutService = inject(KeyboardShortcutService);

  isDragging = false;
  draggedNodeId: string | null = null;
  lastMouseX = 0;
  lastMouseY = 0;
  initialTouchX = 0;
  initialTouchY = 0;
  isTouchDragging = false;
  
  // Zoom and pan state
  scale = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  isZooming = false;
  lastPanX = 0;
  lastPanY = 0;
  
  // Touch state for pinch zoom and pan
  initialDistance = 0;
  initialScale = 1;
  lastTouchEndTime = 0;
  lastTouchedNode: string | null = null;
  TOUCH_DRAG_THRESHOLD = 10; // Minimum pixels to consider as drag (increased for better reliability)
  DOUBLE_TAP_DELAY = 300; // Maximum delay between taps for double-tap
  
  // Speed limiting configuration
  MAX_PAN_SPEED = 50; // Maximum pixels per frame
  MAX_ZOOM_SPEED = 0.2; // Maximum zoom delta per event
  ZOOM_SMOOTHING = 0.1; // Smoothing factor for zoom
  PAN_SMOOTHING = 0.15; // Smoothing factor for pan

  // Wheel event sensitivity adjustment (to match horizontal and vertical speeds)
  WHEEL_PAN_SENSITIVITY_X = 1.0; // Horizontal sensitivity multiplier
  WHEEL_PAN_SENSITIVITY_Y = 0.5; // Vertical sensitivity multiplier (reduced to match horizontal feel)

  // Wheel event smoothing for diagonal movement
  private pendingWheelDeltaX = 0;
  private pendingWheelDeltaY = 0;
  private wheelAnimationFrame: any = null;

  // Track keyboard navigation to disable hover effects
  isKeyboardNavigating = false;
  private keyboardNavigationTimeout: any = null;

  // Track if we're attempting to drag (to prevent immediate edit mode)
  isAttemptingDrag = false;
  touchStartTime = 0;
  lastTouchNodeId: string | null = null;
  
  // Track which node is being edited (for iOS keyboard support)
  editingNodeId: string | null = null;

  // Keyboard node movement
  private moveInterval: any = null;
  private moveStartTime: number = 0;
  private pressedArrowKeys: Set<string> = new Set();

  constructor(
    public appState: AppStateService,
    private cdr: ChangeDetectorRef,
    private fileService: FileService
  ) {}

  ngAfterViewInit() {
    // Create root node if none exists
    if (this.appState.nodes().length === 0) {
      this.appState.createRootNode();
    }
    this.setupEventListeners();

    // Fit view to show all nodes if they were loaded from localStorage
    if (this.appState.nodesLoadedFromStorage) {
      setTimeout(() => {
        this.fitView();
      }, 100); // Small delay to ensure everything is rendered
    }
  }

  setupEventListeners() {
    // HostListener decorators handle these events now
    // No need for manual event listener setup
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Check if we're editing text in a node
    const activeElement = document.activeElement as HTMLElement;
    const isEditingNode = activeElement && activeElement.classList.contains('node-content');
    
    // Also skip shortcuts if user is typing in any input or textarea
    const isTypingInInput = activeElement && 
      (activeElement.tagName === 'INPUT' || 
       activeElement.tagName === 'TEXTAREA' ||
       activeElement.isContentEditable);

    if (isEditingNode || isTypingInInput) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
    const shift = event.shiftKey;

    const command = this.shortcutService.getKeyCommand(event);

    if (!command) return;

    // Handle commands
    switch (command) {
      // --- Navigation ---
      case KeyCommand.NAVIGATE_UP:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.navigateFocus('top');
        break;
      case KeyCommand.NAVIGATE_DOWN:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.navigateFocus('bottom');
        break;
      case KeyCommand.NAVIGATE_LEFT:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.navigateFocus('left');
        break;
      case KeyCommand.NAVIGATE_RIGHT:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.navigateFocus('right');
        break;

      // --- Node Movement (Ctrl+Arrow) ---
      case KeyCommand.MOVE_UP:
        event.preventDefault();
        this.setKeyboardNavigating();
        if (this.appState.selectedNodeId()) {
          this.pressedArrowKeys.add('ArrowUp');
          this.startMovingNode(this.appState.selectedNodeId()!);
        }
        break;
      case KeyCommand.MOVE_DOWN:
        event.preventDefault();
        this.setKeyboardNavigating();
        if (this.appState.selectedNodeId()) {
          this.pressedArrowKeys.add('ArrowDown');
          this.startMovingNode(this.appState.selectedNodeId()!);
        }
        break;
      case KeyCommand.MOVE_LEFT:
        event.preventDefault();
        this.setKeyboardNavigating();
        if (this.appState.selectedNodeId()) {
          this.pressedArrowKeys.add('ArrowLeft');
          this.startMovingNode(this.appState.selectedNodeId()!);
        }
        break;
      case KeyCommand.MOVE_RIGHT:
        event.preventDefault();
        this.setKeyboardNavigating();
        if (this.appState.selectedNodeId()) {
          this.pressedArrowKeys.add('ArrowRight');
          this.startMovingNode(this.appState.selectedNodeId()!);
        }
        break;

      // --- Hierarchy ---
      case KeyCommand.PROMOTE_NODE:
        event.preventDefault();
        if (this.appState.selectedNodeId()) {
          this.appState.promoteNode(this.appState.selectedNodeId()!);
        }
        break;
      case KeyCommand.DEMOTE_NODE:
        event.preventDefault();
        if (this.appState.selectedNodeId()) {
          this.appState.demoteNode(this.appState.selectedNodeId()!);
        }
        break;
      
      case KeyCommand.TOGGLE_FOLD:
        event.preventDefault();
        if (this.appState.selectedNodeId()) {
          this.appState.toggleNodeCollapse(this.appState.selectedNodeId()!);
        }
        break;

      case KeyCommand.EXPAND_ALL:
        event.preventDefault();
        this.appState.expandAll();
        break;
      case KeyCommand.SET_DEPTH_1:
        event.preventDefault();
        this.appState.setGlobalCollapseLevel(1);
        break;
      case KeyCommand.SET_DEPTH_2:
        event.preventDefault();
        this.appState.setGlobalCollapseLevel(2);
        break;
      case KeyCommand.SET_DEPTH_3:
        event.preventDefault();
        this.appState.setGlobalCollapseLevel(3);
        break;
      case KeyCommand.SET_DEPTH_4:
        event.preventDefault();
        this.appState.setGlobalCollapseLevel(4);
        break;
      case KeyCommand.SET_DEPTH_5:
        event.preventDefault();
        this.appState.setGlobalCollapseLevel(5);
        break;

      case KeyCommand.LOCK_LEVEL_1:
        event.preventDefault();
        this.appState.setNavigationLockLevel(1);
        break;
      case KeyCommand.LOCK_LEVEL_2:
        event.preventDefault();
        this.appState.setNavigationLockLevel(2);
        break;
      case KeyCommand.LOCK_LEVEL_3:
        event.preventDefault();
        this.appState.setNavigationLockLevel(3);
        break;
      case KeyCommand.LOCK_LEVEL_4:
        event.preventDefault();
        this.appState.setNavigationLockLevel(4);
        break;
      case KeyCommand.LOCK_LEVEL_5:
        event.preventDefault();
        this.appState.setNavigationLockLevel(5);
        break;
      case KeyCommand.CLEAR_LOCK:
        event.preventDefault();
        this.appState.setNavigationLockLevel(null);
        break;

      // --- Quick Add (Shift+Arrow) ---
      case KeyCommand.QUICK_ADD_TOP:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.quickAddChild('top');
        break;
      case KeyCommand.QUICK_ADD_BOTTOM:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.quickAddChild('bottom');
        break;
      case KeyCommand.QUICK_ADD_LEFT:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.quickAddChild('left');
        break;
      case KeyCommand.QUICK_ADD_RIGHT:
        event.preventDefault();
        this.setKeyboardNavigating();
        this.quickAddChild('right');
        break;

      // --- Editing & Creation ---
      case KeyCommand.SMART_TAB:
        event.preventDefault();
        this.handleTabKey();
        break;

      case KeyCommand.EDIT_NODE: {
        event.preventDefault();
        const selectedId = this.appState.selectedNodeId();
        if (selectedId) {
          this.enableEditMode(selectedId);
        }
        break;
      }

      // --- Deletion ---
      case KeyCommand.DELETE_NODE:
        if (this.appState.selectedNodeId()) {
          event.preventDefault();
          this.handleSmartDelete();
        }
        break;

      // --- History ---
      case KeyCommand.UNDO:
        event.preventDefault();
        this.appState.undo();
        break;
      case KeyCommand.REDO:
        event.preventDefault();
        this.appState.redo();
        break;

      // --- File Ops ---
      case KeyCommand.EXPORT:
        event.preventDefault();
        this.fileService.export();
        break;
      case KeyCommand.IMPORT:
        event.preventDefault();
        this.uploadMindMap();
        break;
      case KeyCommand.HELP:
        event.preventDefault();
        this.openHelpModal();
        break;

      // --- Styling ---
      case KeyCommand.BOLD:
        event.preventDefault();
        this.toggleBold();
        break;
      case KeyCommand.ITALIC:
        event.preventDefault();
        this.toggleItalic();
        break;
      case KeyCommand.CYCLE_SHAPE:
        event.preventDefault();
        this.cycleShape();
        break;
      case KeyCommand.CYCLE_COLOR:
        event.preventDefault();
        this.cycleColor();
        break;

      // --- View ---
      case KeyCommand.RESET_VIEW:
        if (!isEditingNode) {
          event.preventDefault();
          this.resetView();
        }
        break;
      case KeyCommand.CENTER_VIEW:
        if (!isEditingNode) {
          event.preventDefault();
          this.centerOnSelection();
        }
        break;

      // --- Selection ---
      case KeyCommand.TOGGLE_SELECTION:
        if (!isEditingNode) {
          event.preventDefault();
          const selectedId = this.appState.selectedNodeId();
          if (selectedId) {
            this.appState.toggleNodeSelection(selectedId);
          }
        }
        break;
      case KeyCommand.CLEAR_SELECTION:
        if (!isEditingNode) {
          event.preventDefault();
          this.appState.clearSelection();
        }
        break;
      case KeyCommand.SELECT_ALL:
        if (!isEditingNode) {
          event.preventDefault();
          this.appState.selectAll();
        }
        break;
    }
  }

  // --- Styling Helpers ---
  toggleBold() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;
    const node = this.appState.nodes().find(n => n.id === selectedId);
    if (!node) return;
    
    const isBold = node.style?.fontWeight === 'bold';
    this.appState.updateNodeStyle(selectedId, { fontWeight: isBold ? 'normal' : 'bold' });
  }

  toggleItalic() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;
    const node = this.appState.nodes().find(n => n.id === selectedId);
    if (!node) return;
    
    const isItalic = node.style?.fontStyle === 'italic';
    this.appState.updateNodeStyle(selectedId, { fontStyle: isItalic ? 'normal' : 'italic' });
  }

  cycleShape() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;
    const node = this.appState.nodes().find(n => n.id === selectedId);
    if (!node) return;
    
    const shapes: ('rect' | 'rounded' | 'pill' | 'diamond')[] = ['rect', 'rounded', 'pill', 'diamond'];
    const currentShape = node.style?.shape || 'rounded'; // Default is rounded
    const nextIndex = (shapes.indexOf(currentShape as any) + 1) % shapes.length;
    
    this.appState.updateNodeStyle(selectedId, { shape: shapes[nextIndex] });
  }

  cycleColor() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;
    const node = this.appState.nodes().find(n => n.id === selectedId);
    if (!node) return;
    
    const colors = [
      { bg: '#ffffff', text: '#1f2937' }, // White (Default)
      { bg: '#eff6ff', text: '#1e40af' }, // Blue
      { bg: '#f0fdf4', text: '#166534' }, // Green
      { bg: '#fefce8', text: '#854d0e' }, // Yellow
      { bg: '#fff7ed', text: '#9a3412' }, // Orange
      { bg: '#faf5ff', text: '#6b21a8' }, // Purple
    ];
    
    const currentBg = node.style?.backgroundColor || '#ffffff';
    const currentIndex = colors.findIndex(c => c.bg === currentBg);
    const nextIndex = (currentIndex + 1) % colors.length;
    const nextColor = colors[nextIndex];
    
    this.appState.updateNodeStyle(selectedId, { 
      backgroundColor: nextColor.bg,
      color: nextColor.text
    });
  }

  centerOnSelection() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;
    const node = this.appState.nodes().find(n => n.id === selectedId);
    if (!node) return;

    // Calculate center of node
    const nodeCenterX = node.x + (node.width || 100) / 2;
    const nodeCenterY = node.y + (node.height || 40) / 2;

    // Viewport dimensions
    const viewportWidth = this.mindmapContainer?.nativeElement.clientWidth || window.innerWidth;
    const viewportHeight = this.mindmapContainer?.nativeElement.clientHeight || window.innerHeight;

    // Calculate pan to center the node
    this.panX = (viewportWidth / 2) - (nodeCenterX * this.scale);
    this.panY = (viewportHeight / 2) - (nodeCenterY * this.scale);
    
    this.updateTransform();
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.key.startsWith('Arrow')) {
      this.pressedArrowKeys.delete(event.key);
      if (this.pressedArrowKeys.size === 0) {
        this.stopMovingNode();
      }
    }
    
    // Also stop if Ctrl/Cmd is released
    if (event.key === 'Control' || event.key === 'Meta') {
      this.stopMovingNode();
    }
  }

  @HostListener('window:blur')
  onWindowBlur() {
    this.stopMovingNode();
  }

  openHelpModal() {
    this.modalService.open(HelpModalComponent, {
      centered: true,
      size: 'lg'
    });
  }

  // --- Keyboard Logic Helpers ---

  /**
   * Spatially navigate focus to the nearest node in the given direction
   */
  navigateFocus(direction: 'top' | 'bottom' | 'left' | 'right') {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) {
      // If nothing selected, select root
      const root = this.appState.nodes().find(n => !n.parentId);
      if (root) this.selectNode(root.id);
      return;
    }

    const current = this.appState.nodes().find(n => n.id === selectedId);
    if (!current) return;

    // Filter candidates based on direction AND level-lock
    const lockLevel = this.appState.navigationLockLevel();

    // Use visibleNodes() to ensure we don't navigate to hidden/collapsed nodes
    const candidates = this.appState.visibleNodes().filter(node => {
      if (node.id === current.id) return false;
      
      // Level-lock constraint
      if (lockLevel !== null) {
        if (this.appState.getNodeDepth(node.id) !== lockLevel) {
          return false;
        }
      }

      const dx = node.x - current.x;
      const dy = node.y - current.y;

      switch (direction) {
        case 'right': return dx > 0;
        case 'left': return dx < 0;
        case 'bottom': return dy > 0;
        case 'top': return dy < 0;
      }
    });

    if (candidates.length === 0) return;

    // Find closest candidate using a weighted distance formula
    // We penalize orthogonal distance to prefer visual straight lines
    let closestNode = null;
    let minScore = Infinity;

    candidates.forEach(node => {
      const dx = Math.abs(node.x - current.x);
      const dy = Math.abs(node.y - current.y);
      let score = 0;

      // Euclidean distance + Penalty for being off-axis
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (direction === 'left' || direction === 'right') {
        score = dist + (dy * 2); // Penalize vertical deviation
      } else {
        score = dist + (dx * 2); // Penalize horizontal deviation
      }

      if (score < minScore) {
        minScore = score;
        closestNode = node;
      }
    });

    if (closestNode) {
      const nodeId = (closestNode as any).id;

      // Navigation always just moves focus without modifying selection
      // In multi-select mode: focus moves, selections stay
      // In single-select mode: focus moves, ready for 'M' to mark
      this.appState.selectedNodeId.set(nodeId);
    }
  }

  /**
   * Keyboard movement logic
   */
  private moveNodeLoop() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId || this.pressedArrowKeys.size === 0) {
      this.stopMovingNode();
      return;
    }

    const elapsed = Date.now() - this.moveStartTime;
    // Base speed: 2px per frame (assuming ~60fps)
    // Acceleration: increase speed every 300ms
    const acceleration = Math.floor(elapsed / 300);
    const speed = 2 + acceleration;

    const node = this.appState.nodes().find(n => n.id === selectedId);
    if (node) {
      let dx = 0;
      let dy = 0;
      if (this.pressedArrowKeys.has('ArrowUp')) dy -= speed;
      if (this.pressedArrowKeys.has('ArrowDown')) dy += speed;
      if (this.pressedArrowKeys.has('ArrowLeft')) dx -= speed;
      if (this.pressedArrowKeys.has('ArrowRight')) dx += speed;

      if (dx !== 0 || dy !== 0) {
        // Use a small scale-independent movement
        this.appState.updateNodePosition(node.id, node.x + dx, node.y + dy);
      }
    }
  }

  private startMovingNode(selectedId: string) {
    if (this.moveInterval) return;
    
    this.moveStartTime = Date.now();
    this.appState.startDrag(selectedId);
    this.moveInterval = setInterval(() => this.moveNodeLoop(), 16);
  }

  private stopMovingNode() {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
      this.appState.endDrag();
    }
    this.pressedArrowKeys.clear();
  }

  /**
   * Quickly add a child in a direction and immediately edit it (Shift + Arrow)
   */
  quickAddChild(direction: 'top' | 'bottom' | 'left' | 'right') {
    const selectedId = this.appState.selectedNodeId();
    if (selectedId) {
      const newNode = this.appState.addChildNode(selectedId, direction);
      if (newNode) {
        // Use timeout to let the DOM update before focusing
        setTimeout(() => this.enableEditMode(newNode.id), 50);
      }
    }
  }

  /**
   * Smart Tab:
   * 1. If Root/No Parent: Fill empty quadrants (Right -> Left -> Bottom -> Top)
   * 2. If Child: Continue in the direction relative to parent
   */
  handleTabKey() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;

    const current = this.appState.nodes().find(n => n.id === selectedId);
    if (!current) return;

    let direction: 'top' | 'bottom' | 'left' | 'right' = 'right';

    if (!current.parentId) {
      // Root Node Strategy: Fill empty slots
      const children = this.appState.nodes().filter(n => n.parentId === current.id);
      const occupied = new Set<string>();

      children.forEach(child => {
        occupied.add(this.getRelativeDirection(current, child));
      });

      if (!occupied.has('right')) direction = 'right';
      else if (!occupied.has('left')) direction = 'left';
      else if (!occupied.has('bottom')) direction = 'bottom';
      else if (!occupied.has('top')) direction = 'top';
      // If all full, default to Right
    } else {
      // Child Node Strategy: Continue branch direction
      const parent = this.appState.nodes().find(n => n.id === current.parentId);
      if (parent) {
        direction = this.getRelativeDirection(parent, current);
      }
    }

    const newNode = this.appState.addChildNode(selectedId, direction);
    if (newNode) {
      setTimeout(() => this.enableEditMode(newNode.id), 50);
    }
  }

  /**
   * Enter Key: Add Sibling
   */
  handleAddSibling() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;

    // Use the smart service method to place sibling relative to current node
    const newNode = this.appState.addSiblingNode(selectedId);
    
    if (newNode) {
      setTimeout(() => this.enableEditMode(newNode.id), 50);
    }
  }

  /**
   * Smart Delete: Delete and focus nearest valid neighbor
   */
  handleSmartDelete() {
    const selectedId = this.appState.selectedNodeId();
    if (!selectedId) return;

    const current = this.appState.nodes().find(n => n.id === selectedId);
    if (!current) return;

    // Determine next node to focus BEFORE deleting
    let nextFocusId: string | null = null;

    // 1. Try to find a sibling
    if (current.parentId) {
      const siblings = this.appState.nodes().filter(n => n.parentId === current.parentId && n.id !== current.id);
      if (siblings.length > 0) {
        // Pick the closest sibling
        nextFocusId = siblings[siblings.length - 1].id; // Simple strategy: last one created
      } else {
        // 2. Fallback to Parent
        nextFocusId = current.parentId;
      }
    } else {
      // Deleting root? (Usually protected, but just in case)
      // Pick any other node?
      const anyNode = this.appState.nodes().find(n => n.id !== current.id);
      if (anyNode) nextFocusId = anyNode.id;
    }

    // Perform Delete
    this.deleteSelectedNode();

    // Set Focus
    if (nextFocusId) {
      // Need a slight delay because delete might trigger a redraw
      setTimeout(() => this.selectNode(nextFocusId!), 10);
    }
  }

  /**
   * Helper: Calculate relative direction between two nodes
   */
  getRelativeDirection(from: any, to: any): 'right' | 'left' | 'top' | 'bottom' {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'bottom' : 'top';
    }
  }

  /**
   * Opens file dialog to load a mind map
   */
  uploadMindMap(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mind';
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.fileService.import(files[0])
          .then(() => {
            // Fit the map view after import
            this.fitView();
          })
          .catch((error) => {
            console.error('Error importing mind map:', error);
            alert('Error importing mind map: ' + error.message);
          });
      }
    };
    input.click();
  }

  startDragNode(e: MouseEvent | TouchEvent, nodeId: string) {
    e.stopPropagation();

    // Check if Ctrl/Cmd is pressed for multi-select (don't start dragging)
    if ('ctrlKey' in e || 'metaKey' in e) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isMultiSelect = isMac ? (e as MouseEvent).metaKey : (e as MouseEvent).ctrlKey;

      if (isMultiSelect) {
        // Don't start dragging, just let the click handler deal with multi-select
        return;
      }
    }

    let clientX: number;
    let clientY: number;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;

      // Track initial touch position for drag detection
      this.initialTouchX = clientX;
      this.initialTouchY = clientY;
      this.isTouchDragging = false;
      this.isDragging = true;
      this.draggedNodeId = nodeId;
      this.isAttemptingDrag = true;
      this.touchStartTime = Date.now();
      this.lastTouchNodeId = nodeId;

      // If node is not in multi-select, clear selection and select only this node
      if (!this.appState.isNodeSelected(nodeId)) {
        this.selectNode(nodeId);
      }

      // Add dragging class to container
      this.mindmapContainer?.nativeElement.classList.add('dragging');
    } else {
      // For mouse events, start dragging immediately
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
      this.isDragging = true;
      this.draggedNodeId = nodeId;

      // If node is not in multi-select, clear selection and select only this node
      if (!this.appState.isNodeSelected(nodeId)) {
        this.selectNode(nodeId);
      }

      // Add dragging class to container
      this.mindmapContainer?.nativeElement.classList.add('dragging');
    }

    this.lastMouseX = clientX;
    this.lastMouseY = clientY;

    // Start tracking drag for history batching
    this.appState.startDrag(nodeId);

    if ('preventDefault' in e) {
      e.preventDefault();
    }
  }

  selectNode(nodeId: string, multiSelect: boolean = false) {
    if (multiSelect) {
      // Multi-select mode: toggle this node
      this.appState.toggleNodeSelection(nodeId);
    } else {
      // Single select: just set focus, clear multi-selection
      this.appState.selectedNodeId.set(nodeId);
      this.appState.selectedNodeIds.set(new Set());
    }
  }

  /**
   * Blurs any focused editable node content
   */
  blurActiveEdit(): void {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList.contains('node-content')) {
      (activeElement as HTMLElement).blur();
    }
  }

  getConnectionPath(parent: any, child: any): string {
    const pX = parent.x + (parent.width || 100) / 2;
    const pY = parent.y + (parent.height || 40) / 2;
    const cX = child.x + (child.width || 100) / 2;
    const cY = child.y + (child.height || 40) / 2;

    // Calculate control points for smooth curve
    const deltaY = cY - pY;
    const controlY1 = pY + deltaY * 0.5;
    const controlY2 = cY - deltaY * 0.5;

    return `M ${pX} ${pY} C ${pX} ${controlY1}, ${cX} ${controlY2}, ${cX} ${cY}`;
  }

  getParent(parentId: string | null): any | undefined {
    if (!parentId) return undefined;
    return this.appState.nodes().find(n => n.id === parentId);
  }

  addChildNode(parentId?: string, direction?: 'top' | 'bottom' | 'left' | 'right') {
    const targetId = parentId || this.appState.selectedNodeId();
    if (targetId) {
      this.appState.addChildNode(targetId, direction);
    }
  }

  deleteSelectedNode() {
    const selectedId = this.appState.selectedNodeId();
    if (selectedId) {
      this.appState.deleteSelectedNode(selectedId);
    }
  }

  preventDrag(e: MouseEvent | TouchEvent) {
    e.stopPropagation();
  }
  
  /**
   * Handles click events on node content to enable edit mode
   */
  onNodeClick(e: MouseEvent, nodeId: string) {
    // Prevent default to avoid drag interference
    e.preventDefault();
    e.stopPropagation();

    // Check for Ctrl/Cmd key for multi-select
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isMultiSelect = isMac ? e.metaKey : e.ctrlKey;

    // Select the node (with or without multi-select)
    this.selectNode(nodeId, isMultiSelect);
  }

  onNodeDblClick(e: MouseEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();
    this.enableEditMode(nodeId);
  }

  finishEditNode(nodeId: string) {
    // Find the contentEditable element for this node
    const contentElement = document.querySelector(`[data-node-id="${nodeId}"] .node-content`) as HTMLElement;
    
    if (contentElement) {
      const text = contentElement.textContent || '';
      this.appState.updateNodeText(nodeId, text.trim());
      
      // Exit edit mode
      this.editingNodeId = null;
    }
  }
  
  /**
   * Enables edit mode for a node - sets contenteditable and focuses
   * This is crucial for iOS keyboard support
   */
  enableEditMode(nodeId: string) {
    // Set the node as being edited
    this.editingNodeId = nodeId;
    
    // Find the content element
    const contentElement = document.querySelector(`[data-node-id="${nodeId}"] .node-content`) as HTMLElement;
    
    if (contentElement) {
      // Set contenteditable to true (iOS requires this before focus)
      contentElement.setAttribute('contenteditable', 'true');
      
      // Force a reflow to ensure contenteditable is applied
      contentElement.offsetHeight;
      
      // Focus the element - this will trigger iOS keyboard
      contentElement.focus();
    }
  }

  handleEditKeyDown(e: KeyboardEvent, nodeId: string) {
    // Allow Enter to create new lines (multiline support)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Regular Enter - save and finish editing
      e.preventDefault();
      e.stopPropagation();
      this.finishEditNode(nodeId);
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      // Stop editing (save current text via blur)
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).blur();
    }
  }

  handleTouchEnd(e: TouchEvent, nodeId: string) {
    const now = Date.now();
    
    // Check if this was a tap (not a drag) and we're on the same node
    const wasTap = !this.isTouchDragging && !this.isAttemptingDrag && 
                  this.lastTouchNodeId === nodeId && 
                  (now - this.touchStartTime) < 500;
    
    // If we were dragging, reset the drag attempt flag
    if (this.isAttemptingDrag) {
      this.isAttemptingDrag = false;
      this.lastTouchNodeId = null;
      this.touchStartTime = 0;
    }
    
    // Double-tap to focus and select all text
    if (this.lastTouchedNode === nodeId && this.lastTouchEndTime > 0 && 
        now - this.lastTouchEndTime < this.DOUBLE_TAP_DELAY) {
      // This is a double tap - enable edit mode and select all text
      e.preventDefault();
      e.stopPropagation();
      
      if (!this.isTouchDragging) {
        // Enable edit mode first (crucial for iOS keyboard)
        this.enableEditMode(nodeId);
        
        // Then select all text
        const contentElement = document.querySelector(`[data-node-id="${nodeId}"] .node-content`) as HTMLElement;
        if (contentElement) {
          const range = document.createRange();
          range.selectNodeContents(contentElement);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
      
      this.lastTouchedNode = null;
      this.lastTouchEndTime = 0;
      return;
    }
    
    // This is the first tap
    this.lastTouchedNode = nodeId;
    this.lastTouchEndTime = now;
    
    // If it was a single tap (not a drag), enable edit mode for the node
    if (wasTap) {
      // Enable edit mode after a small delay to allow the tap to complete
      setTimeout(() => {
        if (!this.isTouchDragging) {
          this.enableEditMode(nodeId);
        }
      }, 50);
    }
    
    // Set timeout to reset if second tap doesn't come
    setTimeout(() => {
      if (this.lastTouchedNode === nodeId) {
        this.lastTouchedNode = null;
        this.lastTouchEndTime = 0;
      }
    }, this.DOUBLE_TAP_DELAY);
  }
  
  private lastTap: number = 0;
  
  // Zoom and pan methods
  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent) {
    e.preventDefault();

    if (e.ctrlKey) {
      // Zoom with Ctrl + Scroll
      // Adjust sensitivity for trackpad/mouse wheel differences
      // Standard mouse wheel delta is often +/- 100, trackpad is much smaller.
      // We use a small factor to make both usable.
      const zoomIntensity = 0.002;
      const delta = -e.deltaY * zoomIntensity;
      this.zoom(delta, e.clientX, e.clientY);
    } else {
      // Pan with Scroll (Touchpad 2-finger move or Mouse Wheel)
      // Accumulate deltas and apply them in animation frame for smooth diagonal movement
      // Apply sensitivity multipliers to balance horizontal and vertical speeds
      this.pendingWheelDeltaX += e.deltaX * this.WHEEL_PAN_SENSITIVITY_X;
      this.pendingWheelDeltaY += e.deltaY * this.WHEEL_PAN_SENSITIVITY_Y;

      // Schedule update if not already scheduled
      if (!this.wheelAnimationFrame) {
        this.wheelAnimationFrame = requestAnimationFrame(() => {
          // Apply accumulated deltas
          this.panX -= this.pendingWheelDeltaX / this.scale;
          this.panY -= this.pendingWheelDeltaY / this.scale;

          // Reset pending deltas
          this.pendingWheelDeltaX = 0;
          this.pendingWheelDeltaY = 0;
          this.wheelAnimationFrame = null;

          this.updateTransform();
        });
      }
    }
  }
  
  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    // Handle both pinch zoom and single-touch pan
    if (e.touches.length === 2) {
      // Start pinch gesture
      this.initialDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      this.initialScale = this.scale;
      e.preventDefault();
    } else if (e.touches.length === 1 && !this.isDragging) {
      // Single touch - could be for dragging or editing
      // We handle this in the specific touch events on nodes
    }
  }
  
  @HostListener('touchmove', ['$event'])
  onTouchMove(e: TouchEvent) {
    // Handle both pinch zoom and single-touch pan
    if (e.touches.length === 2) {
      // Handle pinch gesture
      this.isZooming = true;
      const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      const scaleDelta = currentDistance / this.initialDistance;
      this.scale = Math.min(Math.max(0.3, this.initialScale * scaleDelta), 3);
      this.updateTransform();
      this.isZooming = false;
      e.preventDefault();
    } else if (e.touches.length === 1 && !this.isDragging && !this.isAttemptingDrag && !this.isZooming) {
      // Handle single touch pan (background drag)
      // Only allow if we're not trying to drag a node and not zooming
      const touch = e.touches[0];
      
      // Check if touch is on a node
      const touchEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const isOnNode = touchEl?.closest('.node') !== null;
      
      // Allow background dragging:
      // 1. If no node is selected - allow drag anywhere on screen
      // 2. If node is selected - only allow drag when not touching a node
      // 3. Never allow if we're attempting to drag a node (prevents conflict)
      // 4. Never allow if we're zooming (prevents conflict)
      if (!isOnNode || this.appState.selectedNodeId() === null) {
        if (!this.isPanning) {
          this.isPanning = true;
          this.lastPanX = touch.clientX;
          this.lastPanY = touch.clientY;
          this.mindmapContainer.nativeElement.classList.add('panning');

          // Cancel all selections when starting background drag
          this.appState.clearSelection();
        }
        
        // Compensate drag speed for current scale
        const deltaX = touch.clientX - this.lastPanX;
        const deltaY = touch.clientY - this.lastPanY;
        
        // Apply speed limiting to prevent too fast panning
        const clampedDeltaX = Math.max(-this.MAX_PAN_SPEED, Math.min(this.MAX_PAN_SPEED, deltaX));
        const clampedDeltaY = Math.max(-this.MAX_PAN_SPEED, Math.min(this.MAX_PAN_SPEED, deltaY));
        
        const scaledDeltaX = clampedDeltaX / this.scale;
        const scaledDeltaY = clampedDeltaY / this.scale;
        
        this.panX += scaledDeltaX;
        this.panY += scaledDeltaY;
        
        this.lastPanX = touch.clientX;
        this.lastPanY = touch.clientY;
        
        this.updateTransform();
      }
      
      e.preventDefault(); // Prevent scrolling while panning
    }
  }
  
  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent) {
    // End touch panning
    this.isPanning = false;
    this.mindmapContainer.nativeElement.classList.remove('panning');
  }
  
  @HostListener('touchcancel', ['$event'])
  onTouchCancel(e: TouchEvent) {
    // Handle touch cancellation
    this.isPanning = false;
    this.mindmapContainer.nativeElement.classList.remove('panning');
  }
  
  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    // Check if click is on background (not on a node)
    const targetElement = e.target as HTMLElement;
    const isOnNode = targetElement.closest('.node') !== null;

    // Allow background dragging in all cases:
    // 1. No node selected - drag anywhere
    // 2. Node selected - drag only when clicking outside the node
    if (!isOnNode) {
      // Cancel all selections when clicking on background
      this.appState.clearSelection();

      // Blur any active edit when clicking outside
      this.blurActiveEdit();

      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.mindmapContainer.nativeElement.classList.add('panning');
      e.preventDefault();
    }
  }
  
  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.isPanning) {
      const deltaX = e.clientX - this.lastPanX;
      const deltaY = e.clientY - this.lastPanY;
      
      // Compensate drag speed for current scale
      const scaledDeltaX = deltaX / this.scale;
      const scaledDeltaY = deltaY / this.scale;
      
      this.panX += scaledDeltaX;
      this.panY += scaledDeltaY;
      
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      
      this.updateTransform();
    }
  }
  
  @HostListener('document:mouseup')
  onDocumentMouseUp() {
    // End drag and create history entry if was dragging
    if (this.isDragging) {
      this.appState.endDrag();
    }
    this.isDragging = false;
    this.draggedNodeId = null;
    this.isPanning = false;
    this.mindmapContainer.nativeElement.classList.remove('panning');
    this.mindmapContainer.nativeElement.classList.remove('dragging');
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(e: MouseEvent) {
    // Clear keyboard navigation flag on mouse movement
    if (this.isKeyboardNavigating) {
      this.isKeyboardNavigating = false;
      if (this.keyboardNavigationTimeout) {
        clearTimeout(this.keyboardNavigationTimeout);
        this.keyboardNavigationTimeout = null;
      }
    }

    // Only handle node dragging if we're actually dragging a node (not panning background)
    if (this.isDragging && this.draggedNodeId && !this.isPanning) {
      const node = this.appState.nodes().find(n => n.id === this.draggedNodeId);
      if (node) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;

        this.appState.updateNodePosition(node.id, node.x + deltaX, node.y + deltaY);

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onDocumentTouchMove(e: TouchEvent) {
    // Only handle node dragging if we're actually dragging a node (not panning background)
    if (this.isDragging && this.draggedNodeId && e.touches.length > 0 && !this.isPanning) {
      const node = this.appState.nodes().find(n => n.id === this.draggedNodeId);
      if (node) {
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        // Check if touch has moved beyond threshold to start dragging
        const deltaX = touchX - this.initialTouchX;
        const deltaY = touchY - this.initialTouchY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (!this.isTouchDragging && distance > this.TOUCH_DRAG_THRESHOLD) {
          this.isTouchDragging = true;
        }
        
        // Only move node if we're actually dragging (beyond threshold)
        if (this.isTouchDragging) {
          const moveDeltaX = touchX - this.lastMouseX;
          const moveDeltaY = touchY - this.lastMouseY;

          this.appState.updateNodePosition(node.id, node.x + moveDeltaX, node.y + moveDeltaY);

          this.lastMouseX = touchX;
          this.lastMouseY = touchY;
        }
      }
    }
    e.preventDefault(); // Prevent scrolling while dragging
  }

  // Track touch start positions to better handle mobile interactions
  private lastTouchStartPosition: { x: number, y: number } | null = null;
  private touchStartedOnNode: boolean = false;
  private touchStartedOnNavbar: boolean = false;
  private touchedNavbarButton: boolean = false;

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouchStart(e: TouchEvent) {
    // Track initial touch position for better mobile interaction handling
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.lastTouchStartPosition = { x: touch.clientX, y: touch.clientY };
      
      // Check if touch started on a node
      const touchedElement = document.elementFromPoint(touch.clientX, touch.clientY);
      this.touchStartedOnNode = !!touchedElement?.closest('.node');
      
      // Check if touch started on navbar
      const navbar = document.querySelector('nav.navbar.fixed-bottom');
      const navbarRect = navbar?.getBoundingClientRect();
      this.touchStartedOnNavbar = !!navbarRect && 
        touch.clientY > navbarRect.top && 
        touch.clientY < navbarRect.bottom &&
        touch.clientX > navbarRect.left && 
        touch.clientX < navbarRect.right;
    }
  }

  @HostListener('document:touchend', ['$event'])
  onDocumentTouchEnd(e: TouchEvent) {
    // Reset dragging state when touch ends
    if (this.isDragging) {
      // End drag and create history entry if was dragging
      this.appState.endDrag();
      this.isDragging = false;
      this.draggedNodeId = null;
      this.isTouchDragging = false;
      this.mindmapContainer.nativeElement.classList.remove('dragging');
      return; // Exit early to prevent node deselection during dragging
    }
    
    // Prevent node deselection when touching navbar buttons or any clickable elements
    if (e.touches.length === 0) {
      try {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchedElement = document.elementFromPoint(touchEndX, touchEndY);
        
        // Get current selection state
        const currentlySelected = this.appState.selectedNodeId();
        
        // Check if touch ended on navbar area (fixed at bottom)
        const navbar = document.querySelector('nav.navbar.fixed-bottom');
        const navbarRect = navbar?.getBoundingClientRect();
        const isInNavbarArea = navbarRect && touchEndY > (navbarRect.bottom - 40); // More tolerance
        
        // Check if touch ended on clickable element
        const isClickableElement = touchedElement?.matches('button, a, [href], [onclick], .btn, [role="button"], [data-action]') ||
                                   touchedElement?.closest('.navbar-action-btn') !== null;
        
        // Check if touch ended outside of any node
        const isOutsideNode = !touchedElement?.closest('.node');
        
        // Special case: if touch started on navbar, preserve selection
        const shouldPreserveSelection = 
          this.touchStartedOnNavbar || 
          isInNavbarArea || 
          isClickableElement ||
          (this.touchedNavbarButton && !this.isTouchDragging) ||
          (this.touchStartedOnNode && !this.isTouchDragging);
        
        // Only unselect node if ALL these conditions are met:
        // 1. Touch ended outside of any node
        // 2. Not in navbar area
        // 3. Not on clickable elements
        // 4. Not dragging
        // 5. Touch didn't start on a node
        if (isOutsideNode && !this.isTouchDragging && !isClickableElement && !isInNavbarArea && !this.touchStartedOnNode) {
          this.appState.clearSelection();
          // Blur any active edit when touching outside
          this.blurActiveEdit();
        }
        
        // Reset touch tracking state
        this.lastTouchStartPosition = null;
        this.touchStartedOnNode = false;
        this.touchStartedOnNavbar = false;
        this.touchedNavbarButton = false;
        
      } catch (error) {
        // Silently handle any errors from elementFromPoint (might occur in some mobile scenarios)
        console.debug('Touch end element detection failed:', error);
        
        // Be conservative - preserve selection when in doubt
        if (!this.isTouchDragging && !this.isDragging) {
          // Don't unselect if we're not sure what the touch was on
        }
      }
    }
  }

  @HostListener('mouseup')
  onMouseUp() {
    this.isPanning = false;
    this.mindmapContainer.nativeElement.classList.remove('panning');
  }

  zoom(delta: number, clientX: number, clientY: number) {
    // Limit zoom delta to prevent too fast zooming
    const clampedDelta = Math.max(-this.MAX_ZOOM_SPEED, Math.min(this.MAX_ZOOM_SPEED, delta));
    const newScale = Math.min(Math.max(0.3, this.scale + clampedDelta), 3);
    
    if (newScale !== this.scale) {
      // Calculate mouse position relative to viewport
      const rect = this.mindmapContainer?.nativeElement.getBoundingClientRect();
      if (rect) {
        // Calculate the position before zoom (world coordinates)
        const xBeforeZoom = (clientX - rect.left - this.panX) / this.scale;
        const yBeforeZoom = (clientY - rect.top - this.panY) / this.scale;
        
        // Update scale
        this.scale = newScale;
        
        // Calculate pan adjustment to zoom around mouse position
        // This locks the cursor position on the mindmap during zoom
        this.panX = clientX - rect.left - xBeforeZoom * this.scale;
        this.panY = clientY - rect.top - yBeforeZoom * this.scale;
      } else {
        this.scale = newScale;
      }
      
      this.updateTransform();
    }
  }
  
  getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  updateTransform() {
    if (this.mindmapContainer?.nativeElement) {
      this.mindmapContainer.nativeElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
    
    // Update background on :host element to compensate for panning
    // This ensures the dotted background stays fixed in viewport coordinates
    const hostElement = this.mindmapContainer?.nativeElement.parentElement;
    if (hostElement) {
      const bgPosX = -this.panX / this.scale;
      const bgPosY = -this.panY / this.scale;
      hostElement.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
      
      // Update background size to scale with zoom
      // This ensures dot spacing follows the current scale
      const baseSize = 20; // Base size from CSS (20px 20px)
      const scaledSize = baseSize * this.scale;
      hostElement.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
    }
    
    // Add panning and zooming classes for cursor styling
    if (this.mindmapContainer?.nativeElement) {
      if (this.isPanning) {
        this.mindmapContainer.nativeElement.classList.add('panning');
      } else {
        this.mindmapContainer.nativeElement.classList.remove('panning');
      }
      
      if (this.isZooming) {
        this.mindmapContainer.nativeElement.classList.add('zooming');
      } else {
        this.mindmapContainer.nativeElement.classList.remove('zooming');
      }
    }
  }
  
  resetView() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  fitView() {
    const nodes = this.appState.nodes();
    if (nodes.length === 0) return;

    // Calculate bounding box of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      const nodeLeft = node.x;
      const nodeTop = node.y;
      const nodeRight = node.x + (node.width || 100);
      const nodeBottom = node.y + (node.height || 40);

      minX = Math.min(minX, nodeLeft);
      minY = Math.min(minY, nodeTop);
      maxX = Math.max(maxX, nodeRight);
      maxY = Math.max(maxY, nodeBottom);
    });

    // Calculate center and size of bounding box
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    // Get viewport dimensions
    const viewportWidth = this.mindmapContainer?.nativeElement.clientWidth || window.innerWidth;
    const viewportHeight = this.mindmapContainer?.nativeElement.clientHeight || window.innerHeight;

    // Calculate scale to fit with some padding
    const padding = 20;
    const scaleX = (viewportWidth - 2 * padding) / bboxWidth;
    const scaleY = (viewportHeight - 2 * padding) / bboxHeight;
    const scale = Math.min(scaleX, scaleY);

    // Cap maximum scale at 1.0 to prevent excessive zooming in
    // Minimum scale is 0.3 for small maps
    this.scale = Math.max(0.3, Math.min(1.0, scale));

    // Calculate pan to center the bounding box
    const panX = viewportWidth / 2 - bboxCenterX * this.scale;
    const panY = viewportHeight / 2 - bboxCenterY * this.scale;

    // Apply the transformations
    this.panX = panX;
    this.panY = panY;
    this.updateTransform();
  }

  autoSpread() {
    this.appState.autoSpreadNodes();
  }

  /**
   * Track keyboard navigation to hide hover effects
   */
  setKeyboardNavigating(): void {
    this.isKeyboardNavigating = true;

    // Clear any existing timeout
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
    }

    // Reset flag after 2 seconds of no keyboard activity
    this.keyboardNavigationTimeout = setTimeout(() => {
      this.isKeyboardNavigating = false;
    }, 2000);
  }

  ngOnDestroy(): void {
    this.stopMovingNode();

    // Cancel any pending wheel animation frame
    if (this.wheelAnimationFrame) {
      cancelAnimationFrame(this.wheelAnimationFrame);
      this.wheelAnimationFrame = null;
    }

    // Clear keyboard navigation timeout
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
      this.keyboardNavigationTimeout = null;
    }

    // HostListeners are automatically cleaned up by Angular
    // No manual cleanup needed for document event listeners
  }
}
