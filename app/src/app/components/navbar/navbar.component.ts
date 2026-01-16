import { Component, inject, Input } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  @Input() mindmap: any;
  private appState = inject(AppStateService);

  get canUndo(): boolean {
    return this.appState.canUndo();
  }

  get canRedo(): boolean {
    return this.appState.canRedo();
  }

  undo(): void {
    this.appState.undo();
  }

  redo(): void {
    this.appState.redo();
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

  autoSpread() {
    if (this.mindmap) {
      this.mindmap.autoSpread();
    }
  }

  fitView() {
    if (this.mindmap) {
      this.mindmap.fitView();
    }
  }
}
