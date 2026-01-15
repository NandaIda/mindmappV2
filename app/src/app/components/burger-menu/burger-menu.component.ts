import { Component, inject, Input } from '@angular/core';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownItem, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { HelpModalComponent } from '../help-modal/help-modal.component';
import { AppStateService } from '../../services/app-state.service';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-burger-menu',
  standalone: true,
  imports: [NgbDropdown, NgbDropdownMenu, NgbDropdownItem, NgbDropdownToggle],
  templateUrl: './burger-menu.component.html',
  styleUrl: './burger-menu.component.scss'
})
export class BurgerMenuComponent {
  @Input() mindmap: any;
  private modalService = inject(NgbModal);
  private appState = inject(AppStateService);
  private fileService = inject(FileService);

  downloadMindMap() {
    this.fileService.export();
  }

  uploadMindMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mind';
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.fileService.import(files[0])
          .then(() => {
            // Fit the map view after import
            if (this.mindmap) {
              this.mindmap.fitView();
            }
          })
          .catch((error) => {
            console.error('Error importing mind map:', error);
            alert('Error importing mind map: ' + error.message);
          });
      }
    };
    input.click();
  }

  showHelp() {
    const modalRef = this.modalService.open(HelpModalComponent, {
      centered: true,
      size: 'lg'
    });
  }

  resetMap() {
    this.appState.resetMap();
    if (this.mindmap) {
      this.mindmap.resetView();
    }
  }
}
