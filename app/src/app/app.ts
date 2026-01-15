import { Component } from '@angular/core';
import { MindMapComponent } from './components/mindmap/mindmap.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { BurgerMenuComponent } from './components/burger-menu/burger-menu.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MindMapComponent, NavbarComponent, BurgerMenuComponent],
  template: `
    <app-burger-menu [mindmap]="mindmap"></app-burger-menu>
    <app-mindmap #mindmap></app-mindmap>
    <app-navbar [mindmap]="mindmap"></app-navbar>
  `,
  providers: [NgbModal]
})
export class App {
  // We'll use template references to access the mindmap component
}
