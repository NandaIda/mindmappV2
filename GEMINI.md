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
- **Rendering Strategy:** Separated Viewport Architecture.
  - **Fixed UI Layer:** Top-level container (not transformed) holding `SearchOverlay` and `LockIndicator` to ensure they stay fixed to the viewport.
  - **Pannable Canvas:** The `.mindmap-container` div which receives the CSS `transform` (pan/zoom).
    - **Layer 1 (SVG):** `<svg>` layer with `z-index: 0` handles Bezier curve connections.
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

#### `KeyboardShortcutService` (`src/app/services/keyboard-shortcut.service.ts`)
- **Responsibility:** Centralized keyboard event handler. Decouples key bindings from component logic.
- **Pattern:** Translates `KeyboardEvent` -> `KeyCommand` enum.
- **Key Features:**
  - Robust `event.code` detection for Digit keys (handling Shift+Number correctly).
  - Context-aware mapping (ignores certain shortcuts during text editing).

#### `AppStateService` (`src/app/services/app-state.service.ts`)
- **Data Structure:** Flat array of `MindMapNode`. Added `isCollapsed?: boolean` for folding support.
- **Reactivity:** 
  - `nodes`: Signal<MindMapNode[]> - Raw data.
  - `visibleNodes`: Computed Signal - Returns only nodes whose ancestors are all expanded. **Views should bind to this.**
  - `navigationLockLevel`: Signal<number | null> - Filters navigation to a specific depth.
  - `globalCollapseLevel`: Signal<number | null> - Tracks current fold state.
- **Conflict Resolution Logic:**
  - **Folding vs. Locking:**
    - If a Fold hides a Locked level -> Lock is cleared.
    - If a Lock attempts to access a Hidden level -> Lock is blocked.
- **Selection State:**
  - `selectedNodeId`: Signal<string | null> - Focused node.
  - `selectedNodeIds`: Signal<Set<string>> - Multi-select support.
- **Business Logic:**
  - **Structure:** `promoteNode` (Grandchild -> Child) and `demoteNode` (Child -> Grandchild) logic.
  - **Node Creation:** Jitter Algorithm for organic placement.
  - **History:** Command Pattern (undo/redo).

### CSS/SCSS Patterns
- **Visual Feedback:**
  - `.node.selected`: Vibrant Red (#ef4444) border (5px) + strong glow. High visibility for keyboard users.
  - `.node.collapsed::before`: Renders `(+)` badge.
  - `.node.lock-dimmed`: Grayscale/Opacity reduction for nodes outside the locked navigation level.
  - `.node.lock-active`: Double border for nodes in the locked level.
- **Handle Visibility:** `.node:hover .node-handles { opacity: 1 }`.
- **Invisible Bridge Pattern:** Handles use `::after` pseudo-elements to bridge the physical gap between node and handle, preventing `mouseleave` events during cursor traversal.
- **Placeholder Styling:** `:empty::before` with `content: attr(data-placeholder); color: #9ca3af; pointer-events: none;`.
- **Shape Classes:** `.shape-rect`, `.shape-rounded` (default), `.shape-pill`, `.shape-diamond` (via skew transform).
- **Flex Centering:** Nodes use Flexbox to center-align text content vertically and horizontally.

### Event Handling
- **StopPropagation:** Utilized on Quick Add handles, text content, and specific key events (Enter/Escape in edit mode) to prevent selection collision and unwanted state transitions.
- **Shortcuts:** Global `HostListener` handles `Ctrl+Z/Y` (History), `Ctrl+S` (Export), `Ctrl+K` (Help Modal), `Delete` (Smart Focus Fallback), and various customization shortcuts.
