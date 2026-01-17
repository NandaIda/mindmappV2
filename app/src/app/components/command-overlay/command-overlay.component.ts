import { Component, EventEmitter, Output, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-command-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './command-overlay.component.html',
  styleUrl: './command-overlay.component.scss'
})
export class CommandOverlayComponent implements AfterViewInit {
  @ViewChild('commandInput') commandInput!: ElementRef<HTMLInputElement>;
  @Output() close = new EventEmitter<void>();

  private appState = inject(AppStateService);
  
  commandQuery = signal(':'); // Start with colon
  errorMsg = signal<string | null>(null);

  ngAfterViewInit() {
    this.commandInput.nativeElement.focus();
    // Ensure cursor is at end
    setTimeout(() => {
      this.commandInput.nativeElement.selectionStart = this.commandInput.nativeElement.selectionEnd = 1;
    });
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.executeCommand();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close.emit();
    } else if (event.key === 'Backspace' && this.commandQuery().length <= 1) {
      // Close if user deletes the colon
      this.close.emit();
    }
  }

  executeCommand() {
    const rawCmd = this.commandQuery().trim();
    // Regex: :([vcnds])(\d+)
    const match = rawCmd.match(/^:?([vcnds])(\d+)$/i);

    if (!match) {
      this.errorMsg.set('Invalid command format. Try :v1, :c2, :d1, :n3, :s1');
      return;
    }

    const action = match[1].toLowerCase();
    const count = parseInt(match[2], 10);
    const selectedId = this.appState.selectedNodeId();

    this.errorMsg.set(null);

    switch (action) {
      case 'v': // View (Global Fold)
        this.appState.setGlobalCollapseLevel(count);
        this.close.emit();
        break;
        
      case 'n': // Navigate (Lock)
        // Shift+0 clears, so maybe n0 clears?
        if (count === 0) this.appState.setNavigationLockLevel(null);
        else this.appState.setNavigationLockLevel(count);
        this.close.emit();
        break;

      // The following require a selected node
      case 'c': // Collapse Relative
      case 'd': // Delete Relative
      case 's': // Select Relative
        if (!selectedId) {
          this.errorMsg.set('No node selected.');
          return;
        }

        if (action === 'c') {
          this.appState.collapseRelative(selectedId, count);
        } else if (action === 'd') {
          this.appState.pruneRelative(selectedId, count);
        } else if (action === 's') {
          this.appState.selectRelative(selectedId, count);
        }
        
        this.close.emit();
        break;
    }
  }
}
