import { Component, ViewChild, ElementRef, AfterViewInit, Input, HostListener, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-mindmap',
  standalone: true,
  templateUrl: './mindmap.component.html',
  styleUrl: './mindmap.component.scss'
})
  export class MindMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('nodesLayer') nodesLayer!: ElementRef<HTMLElement>;
  @ViewChild('svgLayer') svgLayer!: ElementRef<SVGElement>;
  @ViewChild('mindmapContainer') mindmapContainer!: ElementRef<HTMLElement>;

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
  
  // Track if we're attempting to drag (to prevent immediate edit mode)
  isAttemptingDrag = false;
  touchStartTime = 0;
  lastTouchNodeId: string | null = null;
  
  // Track which node is being edited (for iOS keyboard support)
  editingNodeId: string | null = null;

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
    // Check if we're editing text in a node - don't trigger shortcuts when editing
    const activeElement = document.activeElement as HTMLElement;
    const isEditingNode = activeElement && activeElement.classList.contains('node-content');
    
    // Also skip shortcuts if the user is typing in any input or textarea
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

    // Handle shortcuts
    switch (event.key) {
      case '+':
      case '=': // For keyboards where + is on the same key as =
        if (!cmdOrCtrl && !shift) {
          event.preventDefault();
          this.addChildNode();
        }
        break;

      case '-':
      case '_': // For keyboards where - is on the same key as _
        if (!cmdOrCtrl && !shift) {
          event.preventDefault();
          this.deleteSelectedNode();
        }
        break;

      case 'z':
      case 'Z':
        if (cmdOrCtrl && !shift) {
          event.preventDefault();
          this.appState.undo();
        } else if (cmdOrCtrl && shift) {
          event.preventDefault();
          this.appState.redo();
        }
        break;

      case 'y':
      case 'Y':
        if (cmdOrCtrl && !shift) {
          event.preventDefault();
          this.appState.redo();
        }
        break;

      case 's':
      case 'S':
        if (cmdOrCtrl) {
          event.preventDefault();
          this.fileService.export();
        }
        break;

      case 'o':
      case 'O':
        if (cmdOrCtrl) {
          event.preventDefault();
          this.uploadMindMap();
        }
        break;
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
      
      // Select node on touch start
      this.selectNode(nodeId);
      
      // Add dragging class to container
      this.mindmapContainer?.nativeElement.classList.add('dragging');
    } else {
      // For mouse events, start dragging immediately
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
      this.isDragging = true;
      this.draggedNodeId = nodeId;
      
      // Select node on mouse down
      this.selectNode(nodeId);
      
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

  selectNode(nodeId: string) {
    this.appState.selectNode(nodeId);
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

  addChildNode() {
    const parentId = this.appState.selectedNodeId();
    if (parentId) {
      this.appState.addChildNode(parentId);
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
    
    // Select the node
    this.selectNode(nodeId);
    
    // Enable edit mode for this node
    this.enableEditMode(nodeId);
  }

  onContentEdit(e: Event, nodeId: string) {
    const element = e.target as HTMLElement;
    const text = element.innerText || element.textContent || '';
    
    // Update the node text in the app state
    if (text.trim() !== '') {
      this.appState.updateNodeText(nodeId, text);
    }
  }

  finishEditNode(nodeId: string) {
    // Find the contentEditable element for this node
    const contentElement = document.querySelector(`[data-node-id="${nodeId}"] .node-content`) as HTMLElement;
    
    if (contentElement) {
      const text = contentElement.textContent || '';
      
      // Only update if text is not empty
      if (text.trim() !== '') {
        this.appState.updateNodeText(nodeId, text.trim());
      } else {
        // Revert to original text if empty
        const node = this.appState.nodes().find(n => n.id === nodeId);
        if (node) {
          contentElement.textContent = node.text;
        }
      }
      
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
      this.finishEditNode(nodeId);
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      // Cancel editing
      e.preventDefault();
      const node = this.appState.nodes().find(n => n.id === nodeId);
      if (node) {
        const contentElement = e.target as HTMLElement;
        contentElement.textContent = node.text;
      }
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
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.zoom(delta, e.clientX, e.clientY);
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
          
          // Cancel node selection when starting background drag
          this.appState.selectedNodeId.set(null);
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
      // Cancel node selection when clicking on background
      this.appState.selectedNodeId.set(null);

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
          this.appState.selectedNodeId.set(null);
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
      this.isZooming = true;
      
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
      this.isZooming = false;
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

  ngOnDestroy(): void {
    // HostListeners are automatically cleaned up by Angular
    // No manual cleanup needed for document event listeners
  }
}
