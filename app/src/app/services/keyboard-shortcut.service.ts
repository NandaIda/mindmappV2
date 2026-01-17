import { Injectable } from '@angular/core';

export enum KeyCommand {
  // Navigation
  NAVIGATE_UP = 'NAVIGATE_UP',
  NAVIGATE_DOWN = 'NAVIGATE_DOWN',
  NAVIGATE_LEFT = 'NAVIGATE_LEFT',
  NAVIGATE_RIGHT = 'NAVIGATE_RIGHT',
  
  // Precise Node Movement (Ctrl+Arrows)
  MOVE_UP = 'MOVE_UP',
  MOVE_DOWN = 'MOVE_DOWN',
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',

  // Hierarchy Structure
  PROMOTE_NODE = 'PROMOTE_NODE', // Alt + Left
  DEMOTE_NODE = 'DEMOTE_NODE',   // Alt + Right
  TOGGLE_FOLD = 'TOGGLE_FOLD',   // f or Alt+f

  // Depth Focus (Ctrl + Number)
  SET_DEPTH_1 = 'SET_DEPTH_1',
  SET_DEPTH_2 = 'SET_DEPTH_2',
  SET_DEPTH_3 = 'SET_DEPTH_3',
  SET_DEPTH_4 = 'SET_DEPTH_4',
  SET_DEPTH_5 = 'SET_DEPTH_5',
  EXPAND_ALL = 'EXPAND_ALL',     // Ctrl + 0

  // Level-Lock Navigation (Shift + Number)
  LOCK_LEVEL_1 = 'LOCK_LEVEL_1',
  LOCK_LEVEL_2 = 'LOCK_LEVEL_2',
  LOCK_LEVEL_3 = 'LOCK_LEVEL_3',
  LOCK_LEVEL_4 = 'LOCK_LEVEL_4',
  LOCK_LEVEL_5 = 'LOCK_LEVEL_5',
  CLEAR_LOCK = 'CLEAR_LOCK',      // Alt + C

  // Quick Creation (Shift+Arrows)
  QUICK_ADD_TOP = 'QUICK_ADD_TOP',
  QUICK_ADD_BOTTOM = 'QUICK_ADD_BOTTOM',
  QUICK_ADD_LEFT = 'QUICK_ADD_LEFT',
  QUICK_ADD_RIGHT = 'QUICK_ADD_RIGHT',

  // Core Actions
  EDIT_NODE = 'EDIT_NODE',
  SMART_TAB = 'SMART_TAB', // Tab key
  DELETE_NODE = 'DELETE_NODE',
  
  // History
  UNDO = 'UNDO',
  REDO = 'REDO',
  
  // File Operations
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  EXPORT_MERMAID = 'EXPORT_MERMAID', // Ctrl+Alt+E
  IMPORT_MERMAID = 'IMPORT_MERMAID', // Ctrl+Alt+I
  HELP = 'HELP',
  
  // Styling
  BOLD = 'BOLD',
  ITALIC = 'ITALIC',
  CYCLE_SHAPE = 'CYCLE_SHAPE',
  CYCLE_COLOR = 'CYCLE_COLOR',
  
  // View Control
  RESET_VIEW = 'RESET_VIEW',
  CENTER_VIEW = 'CENTER_VIEW',
  
  // Selection
  TOGGLE_SELECTION = 'TOGGLE_SELECTION', // 'm'
  CLEAR_SELECTION = 'CLEAR_SELECTION',   // Escape
  SELECT_ALL = 'SELECT_ALL',              // Ctrl+A
  SELECT_SUBTREE = 'SELECT_SUBTREE',      // s
  SEARCH = 'SEARCH',                      // /
  COMMAND_MODE = 'COMMAND_MODE'           // :
}

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutService {

  constructor() { }

  /**
   * Translates a KeyboardEvent into a high-level KeyCommand.
   * Returns null if the key press doesn't map to any command.
   */
  getKeyCommand(event: KeyboardEvent): KeyCommand | null {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
    const shift = event.shiftKey;
    const alt = event.altKey;
    const key = event.key;
    const code = event.code;

    // --- Navigation & Movement ---
    if (key === 'ArrowUp') {
      if (cmdOrCtrl) return KeyCommand.MOVE_UP;
      if (shift) return KeyCommand.QUICK_ADD_TOP;
      return KeyCommand.NAVIGATE_UP;
    }
    if (key === 'ArrowDown') {
      if (cmdOrCtrl) return KeyCommand.MOVE_DOWN;
      if (shift) return KeyCommand.QUICK_ADD_BOTTOM;
      return KeyCommand.NAVIGATE_DOWN;
    }
    if (key === 'ArrowLeft') {
      if (alt) return KeyCommand.PROMOTE_NODE;
      if (cmdOrCtrl) return KeyCommand.MOVE_LEFT;
      if (shift) return KeyCommand.QUICK_ADD_LEFT;
      return KeyCommand.NAVIGATE_LEFT;
    }
    if (key === 'ArrowRight') {
      if (alt) return KeyCommand.DEMOTE_NODE;
      if (cmdOrCtrl) return KeyCommand.MOVE_RIGHT;
      if (shift) return KeyCommand.QUICK_ADD_RIGHT;
      return KeyCommand.NAVIGATE_RIGHT;
    }

    // --- Creation & Editing ---
    if (key === 'Tab') return KeyCommand.SMART_TAB;
    if (key === 'Enter') return KeyCommand.EDIT_NODE;
    if (key === 'F2') return KeyCommand.EDIT_NODE;

    // --- Deletion ---
    if (['Delete', 'Backspace', '-', '_'].includes(key)) {
      if (!cmdOrCtrl && !shift) return KeyCommand.DELETE_NODE;
    }

    // --- History ---
    if (key === 'z' || key === 'Z') {
      if (cmdOrCtrl && !shift) return KeyCommand.UNDO;
      if (cmdOrCtrl && shift) return KeyCommand.REDO;
    }
    if ((key === 'y' || key === 'Y') && cmdOrCtrl && !shift) {
      return KeyCommand.REDO;
    }

    // --- File Ops ---
    if (key === 's' || key === 'S') {
      if (cmdOrCtrl) return KeyCommand.EXPORT;
      // Note: Shift+S is Cycle Shape (handled below)
    }
    if (key === 'e' || key === 'E') {
      if (cmdOrCtrl && alt) return KeyCommand.EXPORT_MERMAID;
    }
    if (key === 'i' || key === 'I') {
      if (cmdOrCtrl && alt) return KeyCommand.IMPORT_MERMAID;
    }

    if ((key === 'o' || key === 'O') && cmdOrCtrl) return KeyCommand.IMPORT;
    if ((key === 'k' || key === 'K') && cmdOrCtrl) return KeyCommand.HELP;

    // --- Styling ---
    if ((key === 'b' || key === 'B') && cmdOrCtrl) return KeyCommand.BOLD;
    if ((key === 'i' || key === 'I') && cmdOrCtrl) return KeyCommand.ITALIC;
    
    // Shift+S for Shape
    if ((key === 's' || key === 'S') && shift && !cmdOrCtrl) return KeyCommand.CYCLE_SHAPE;
    
    if ((key === 'c' || key === 'C') && shift) return KeyCommand.CYCLE_COLOR;

    // --- View Control ---
    if (code === 'Digit0') {
      if (shift) return KeyCommand.CLEAR_LOCK;
      if (cmdOrCtrl) return KeyCommand.EXPAND_ALL;
      return KeyCommand.RESET_VIEW;
    }

    // Ctrl + Numbers (Depth Focus)
    if (cmdOrCtrl) {
      if (code === 'Digit1') return KeyCommand.SET_DEPTH_1;
      if (code === 'Digit2') return KeyCommand.SET_DEPTH_2;
      if (code === 'Digit3') return KeyCommand.SET_DEPTH_3;
      if (code === 'Digit4') return KeyCommand.SET_DEPTH_4;
      if (code === 'Digit5') return KeyCommand.SET_DEPTH_5;
    }

    // Shift + Numbers (Level Lock)
    if (shift) {
      if (code === 'Digit1') return KeyCommand.LOCK_LEVEL_1;
      if (code === 'Digit2') return KeyCommand.LOCK_LEVEL_2;
      if (code === 'Digit3') return KeyCommand.LOCK_LEVEL_3;
      if (code === 'Digit4') return KeyCommand.LOCK_LEVEL_4;
      if (code === 'Digit5') return KeyCommand.LOCK_LEVEL_5;
    }

    if (key === ' ') return KeyCommand.CENTER_VIEW;

    // --- Selection & Hierarchy ---
    if (key === 'f' || key === 'F' || key === 'c' || key === 'C') {
      return KeyCommand.TOGGLE_FOLD;
    }
    if (key === 's' || key === 'S') {
      if (!cmdOrCtrl && !shift) return KeyCommand.SELECT_SUBTREE;
    }
    if (key === ':') return KeyCommand.COMMAND_MODE;
    if (key === 'm' || key === 'M') return KeyCommand.TOGGLE_SELECTION;
    if (key === '/') return KeyCommand.SEARCH;
    if (key === 'Escape') return KeyCommand.CLEAR_SELECTION;
    if ((key === 'a' || key === 'A') && cmdOrCtrl) return KeyCommand.SELECT_ALL;

    return null;
  }
}
