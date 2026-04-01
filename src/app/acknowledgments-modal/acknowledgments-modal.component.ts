import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

@Component({
  selector: 'app-acknowledgments-modal',
  templateUrl: './acknowledgments-modal.component.html',
  styleUrls: ['./acknowledgments-modal.component.scss']
})
export class AcknowledgmentsModalComponent {
  @Input() isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();

  onCloseModal() {
    this.closeModal.emit();
  }

  onOverlayClick(event: Event) {
    // Close modal when clicking on overlay (not the modal content)
    if (event.target === event.currentTarget) {
      this.onCloseModal();
    }
  }

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    if (this.isOpen) {
      this.onCloseModal();
    }
  }
}