# MindMapp System Context

## System Architecture

### Core Stack
- **Runtime:** Angular 20.3+ (Standalone Components)
- **State Management:** `AppStateService` (Signal-based reactivity)
- **Styling Engine:** SCSS + Bootstrap 5.3 (Utility/Grid)
- **Mobile Bridge:** Capacitor 8.0 (iOS/Android Native Wrapping)
- **Persistence:** LocalStorage + File System API (JSON serialization)

### Component Hierarchy & Responsibilities

#### `MindMapComponent` (`src/app/components/mindmap/`)
- **Rendering Strategy:** Dual-layer rendering.
  - **Layer 1 (SVG):** `<svg>` layer with `z-index: 0` handles Bezier curve connections (`<path>`).
  - **Layer 2 (DOM):** `<div>` layer with `z-index: 1` handles interactive Node elements.
- **Interaction Model:**
  - **Selection vs Editing:** Single-click handles selection only. Edit mode (contenteditable) is triggered via **Double-click**, **Enter** (when selected), or **F2**.
  - **Multi-Select Support (100% Keyboard-Driven):**
    - **'M' Key:** Toggle current node in/out of multi-selection (primary keyboard method).
    - **Ctrl/Cmd + Click:** Add/remove node from multi-selection via mouse (alternative).
    - **Ctrl/Cmd + A:** Select all nodes.
    - **Escape:** Clear all selections.
    - **Visual Feedback:**
      - **Navigation Focus (amber):** Amber border with subtle glow - shows where arrows navigate from
      - **Multi-Selected (green):** Thick green border + green checkmark badge (✓) - marked nodes
      - **Focused in Multi-Select (blue):** Strong blue border + stronger glow - current keyboard focus within selection
      - **Editing (purple):** Purple border when typing/editing text
    - **Batch Operations:** All operations (Delete, Color, Shape, Bold, Italic, Move) work on entire selection simultaneously.
    - **Group Dragging:** Dragging any multi-selected node moves all selected nodes together, maintaining relative positions.
    - **Smart Navigation:** Arrow keys move focus without changing selection when nodes are marked, enabling quick multi-selection workflow.
  - **Keyboard Navigation Engine:**
    - **Arrow Keys:** Spatial search using Euclidean distance + Orthogonal penalty (2x weighting on off-axis deviation) to find the most visually intuitive neighbor.
    - **Fast Flow (Shift + Arrows):** Combined action: `appState.addChildNode(direction)` -> `enableEditMode()`.
    - **Precision Move (Ctrl + Arrows):** Accelerating spatial movement. Speed starts at 2px/frame and increases every 300ms. History is batched into a single entry on key release.
    - **Smart Tab:** 
      - *Root:* Spatial fill (Right -> Left -> Bottom -> Top).
      - *Branch:* Directional continuation based on parent-child vector.
  - **Typing Lifecycle:** 
    - State updates are **DEFERRED**. Text is committed to `AppState` only on `blur` or `Enter` (commit-on-finish).
    - **Enter Key:** In edit mode, commits changes and exits edit mode (stops propagation to prevent re-entry).
  - **Visual Placeholder System:** Nodes are initialized with `text: ''`. CSS pseudo-element `:empty::before` renders "New Idea" (via `data-placeholder` attribute) for all nodes, including the root.
  - **Styling & Customization:**
    - **Rich Text:** Toggle Bold (`Ctrl+B`) and Italic (`Ctrl+I`).
    - **Visuals:** Cycle Shapes (`Shift+S`: Rect, Rounded, Pill, Diamond/Skew) and Colors (`Shift+C`: 6 preset themes).
  - **View Control:**
    - **Reset View:** `0` (Zero) resets zoom and pan to default.
    - **Focus Selection:** `Space` centers the view on the currently selected node.
  - **Enhanced Input Support:**
    - **Smooth Touchpad Panning:** Two-finger touchpad movement with true diagonal support (no "stair stepping"). Separate sensitivity controls for X/Y axes (WHEEL_PAN_SENSITIVITY_X/Y) to balance speeds. Deltas accumulated in requestAnimationFrame for smooth 60fps rendering.
    - **Pinch Zoom Interception:** Wheel events with ctrlKey are intercepted before browser zoom via non-passive event listeners with capture phase. CSS `touch-action: none` prevents default gesture handling. Works on Firefox/Chrome/Safari on desktop.
    - **Keyboard Navigation Mode:** `isKeyboardNavigating` flag set on arrow key press, cleared on mouse movement. CSS `.keyboard-navigating .node:hover .node-handles` hides hover effects during keyboard navigation to prevent visual distraction.
  - **Style Inheritance:**
    - **Child Node Creation:** `Shift+Arrow` creates children that inherit parent's complete style (backgroundColor, color, shape, fontWeight, fontStyle).
    - **Sibling Creation:** Siblings inherit from their sibling's style for visual consistency.
    - **Spacing & Jitter:** Increased distance (120px) and jitter (±80px) for more aesthetic curved connection lines.

#### `AppStateService` (`src/app/services/app-state.service.ts`)
- **Data Structure:** Flat array of `MindMapNode` objects (`id`, `parentId`, `x`, `y`, `text`, `style?: NodeStyle`).
- **Reactivity:** Angular `Signal<MindMapNode[]>` drives template updates.
- **Selection State:**
  - `selectedNodeId`: Signal<string | null> - Focused node for keyboard navigation.
  - `selectedNodeIds`: Signal<Set<string>> - Multi-select support (set of selected node IDs).
  - Operations automatically work on all selected nodes when multiple are selected.
- **Business Logic:**
  - **Node Creation (Jitter Algorithm):** Directional placement uses a random orthogonal offset (`+/- 30px`) to ensure non-linear SVG pathing.
  - **Sibling Logic:** `addSiblingNode()` calculates vector from parent to current node to stack new nodes linearly (preventing overlap).
  - **History Stack:** Command Pattern implementation via `undoHistory` / `redoHistory` (limit: 50).
  - **Root Initialization:** Root node created with empty text (`''`) to trigger placeholder.

### CSS/SCSS Patterns
- **Handle Visibility:** `.node:hover .node-handles { opacity: 1 }`.
- **Invisible Bridge Pattern:** Handles use `::after` pseudo-elements to bridge the physical gap between node and handle, preventing `mouseleave` events during cursor traversal.
- **Placeholder Styling:** `:empty::before` with `content: attr(data-placeholder); color: #9ca3af; pointer-events: none;`.
- **Shape Classes:** `.shape-rect`, `.shape-rounded` (default), `.shape-pill`, `.shape-diamond` (via skew transform).
- **Flex Centering:** Nodes use Flexbox to center-align text content vertically and horizontally.

### Event Handling
- **StopPropagation:** Utilized on Quick Add handles, text content, and specific key events (Enter/Escape in edit mode) to prevent selection collision and unwanted state transitions.
- **Shortcuts:** Global `HostListener` handles `Ctrl+Z/Y` (History), `Ctrl+S` (Export), `Ctrl+K` (Help Modal), `Delete` (Smart Focus Fallback), and various customization shortcuts.
