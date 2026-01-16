import { Component, EventEmitter, Output, inject, signal, computed, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService, MindMapNode } from '../../services/app-state.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-overlay.component.html',
  styleUrl: './search-overlay.component.scss'
})
export class SearchOverlayComponent implements AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @Output() nodeSelected = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  public appState = inject(AppStateService);
  
  searchQuery = signal('');
  selectedIndex = signal(0);

  // Filter nodes based on query
  searchResults = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return [];

    return this.appState.nodes()
      .filter(node => node.text.toLowerCase().includes(query))
      .slice(0, 8); // Limit to top 8 results
  });

  ngAfterViewInit() {
    this.searchInput.nativeElement.focus();
  }

  onKeyDown(event: KeyboardEvent) {
    const results = this.searchResults();
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.set((this.selectedIndex() + 1) % results.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.set((this.selectedIndex() + results.length - 1) % results.length);
        break;
      case 'Enter':
        event.preventDefault();
        if (results[this.selectedIndex()]) {
          this.selectNode(results[this.selectedIndex()].id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close.emit();
        break;
    }
  }

  selectNode(nodeId: string) {
    this.nodeSelected.emit(nodeId);
  }
}
