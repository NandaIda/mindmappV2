# MindMapp V2: "Flow State" Expansion Proposal

This proposal outlines the roadmap for transforming the current MindMapp prototype into a robust, "keyboard-first" thinking tool. The goal is to retain the speed of VIM-like efficiency while ensuring the UX remains intuitive.

## 1. Branch Folding & Depth Focus (Managing Complexity)

**Objective:** Allow users to focus on specific ideas by collapsing distracting sub-branches, either locally or globally by depth.

### Technical Implementation
*   **Data Model:** Extend `MindMapNode` interface in `app-state.service.ts` with `isCollapsed: boolean`.
*   **Local Folding:**
    *   `f` (or `Alt+F`): Toggle collapse/expand for the currently selected node.
*   **Global Depth Focus (Ctrl + 1-9):**
    *   `Ctrl + 1`: Show Root + Level 1 children only (collapse all Level 1 nodes).
    *   `Ctrl + 2`: Show up to Level 2 (collapse all Level 2 nodes).
    *   `Ctrl + 0`: Expand All.
    *   **Logic:** Recursive traversal calculating node depth relative to root. If `depth >= target`, set `isCollapsed = true`.
*   **Visuals:**
    *   Update SVG line rendering to stop at collapsed nodes.
    *   Add visual badge (e.g., `(+)`) for collapsed nodes.

---

## 2. Advanced Navigation (The "Matrix" Traversal)

**Objective:** Move through ideas spatially or structurally with precision.

### Search & Jump
*   `/`: Open Search Overlay.
*   `Enter`: Teleport to selected result.

### Level-Lock Navigation (Alt + 1-9)
**Concept:** Constrain navigation to a specific hierarchy depth, allowing the user to "slice" through their mind map horizontally.
*   **Mechanism:**
    *   User presses `Alt + N` (e.g., `Alt + 2`).
    *   App enters `LevelLockMode(depth: 2)`.
    *   **Visual Feedback:** Dim nodes not at Level 2; Highlight Level 2 nodes.
*   **Arrow Keys in Lock Mode:**
    *   Logic changes from "Nearest Euclidean Neighbor" to "Nearest Neighbor *at exact depth N*".
    *   Skips over intervening nodes of different depths.
*   **Exit:**
    *   `Alt + C`: Clear Navigation Lock (restore standard spatial navigation).

---

## 3. Structural Promote/Demote (Refactoring at Speed)

**Objective:** Reorganize hierarchy without drag-and-drop.

*   `Alt + Right` (Demote): Make node a child of its previous sibling.
*   `Alt + Left` (Promote): Make node a sibling of its parent.

---

## 4. Technical Refactoring: The Command Pattern

**Objective:** Decouple keyboard logic from `MindMapComponent` to handle complex modes like "Level Lock".

### Technical Implementation
*   **New Service:** `KeyboardShortcutService`.
*   **State:** Needs to track `NavigationMode` (Standard vs. LevelLocked).
*   **Command Registry:**
    *   Centralized definition of all shortcuts.
    *   Middleware capability to intercept Arrow keys when `LevelLocked` is active.

---

## Implementation Plan (To-Do List)

### Phase 1: Structure & Refactoring (Foundation)
- [ ] Create `KeyboardShortcutService`.
- [ ] Move existing key logic out of `mindmap.component.ts`.
- [ ] Implement `NavigationState` to hold "Lock Mode" status.

### Phase 2: Hierarchy & Depth Logic
- [ ] Implement `promoteNode` / `demoteNode` in `AppStateService`.
- [ ] Implement `getNodeDepth(nodeId)` utility.
- [ ] Implement `setGlobalCollapseLevel(depth)` for `Ctrl + 1-9`.

### Phase 3: The "Level Lock" Engine
- [ ] Implement `Alt + N` triggers in Shortcut Service.
- [ ] Modify `navigateFocus` algorithm to accept an optional `requiredDepth` filter.
- [ ] Add visual classes (`.depth-dimmed`, `.depth-highlighted`) for the lock mode.
- [ ] Implement `Alt + C` reset.

### Phase 4: Search & Polish
- [ ] Create Search Overlay.
- [ ] Final UI polish for folded states.