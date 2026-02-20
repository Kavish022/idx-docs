import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ImageViewerService {
  // State
  selectedImage = signal<string | null>(null);
  imageZoom = signal<number>(-1); // -1 = fit to screen
  imagePanX = signal<number>(0);
  imagePanY = signal<number>(0);
  isImageDragging = signal<boolean>(false);
  dragStartX = signal<number>(0);
  dragStartY = signal<number>(0);

  // Configuration
  readonly MIN_ZOOM = 0.5;
  readonly MAX_ZOOM = 5;
  readonly ZOOM_STEP = 0.25;
  readonly PAN_SENSITIVITY = 1;

  openImage(filename: string): void {
    this.selectedImage.set(filename);
    this.resetZoomAndPan();
  }

  closeImage(): void {
    this.selectedImage.set(null);
    this.resetZoomAndPan();
  }

  resetZoomAndPan(): void {
    this.imageZoom.set(-1);
    this.imagePanX.set(0);
    this.imagePanY.set(0);
    this.isImageDragging.set(false);
  }

  zoomIn(): void {
    const current = this.imageZoom();
    if (current === -1) {
      this.imageZoom.set(1);
    } else {
      this.imageZoom.set(Math.min(current + this.ZOOM_STEP, this.MAX_ZOOM));
    }
  }

  zoomOut(): void {
    const current = this.imageZoom();
    if (current > this.MIN_ZOOM) {
      this.imageZoom.set(Math.max(current - this.ZOOM_STEP, this.MIN_ZOOM));
    }
  }

  setZoomLevel(level: number): void {
    this.imageZoom.set(level);
    this.imagePanX.set(0);
    this.imagePanY.set(0);
  }

  fitToScreen(): void {
    this.imageZoom.set(-1);
    this.imagePanX.set(0);
    this.imagePanY.set(0);
  }

  // Pan/Drag Methods
  startDrag(startX: number, startY: number): void {
    if (this.imageZoom() > 1) {
      this.isImageDragging.set(true);
      this.dragStartX.set(startX);
      this.dragStartY.set(startY);
    }
  }

  updateDrag(currentX: number, currentY: number): void {
    if (this.isImageDragging()) {
      const deltaX = currentX - this.dragStartX();
      const deltaY = currentY - this.dragStartY();

      this.imagePanX.update((x) => x + deltaX * this.PAN_SENSITIVITY);
      this.imagePanY.update((y) => y + deltaY * this.PAN_SENSITIVITY);

      this.dragStartX.set(currentX);
      this.dragStartY.set(currentY);
    }
  }

  endDrag(): void {
    this.isImageDragging.set(false);
  }

  // Wheel Zoom
  zoomByWheel(deltaY: number): void {
    const delta = deltaY > 0 ? -0.05 : 0.05;
    const current = this.imageZoom();

    if (current === -1) {
      this.imageZoom.set(Math.max(this.MIN_ZOOM, Math.min(1 + delta, this.MAX_ZOOM)));
    } else {
      this.imageZoom.set(Math.max(this.MIN_ZOOM, Math.min(current + delta, this.MAX_ZOOM)));
    }
  }

  canZoomIn(): boolean {
    const current = this.imageZoom();
    return current === -1 || current < this.MAX_ZOOM;
  }

  canZoomOut(): boolean {
    const current = this.imageZoom();
    return current > this.MIN_ZOOM && current !== -1;
  }

  getZoomPercentage(): string {
    const current = this.imageZoom();
    if (current === -1) return 'Fit';
    return `${Math.round(current * 100)}%`;
  }
}
