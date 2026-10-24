import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentVisionService } from '../../services/document-vision.service';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-panel rounded-2xl p-4 flex flex-col h-full">
      <!-- Viewer Header & Controls -->
      <div class="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-[var(--color-border)] flex-wrap">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div class="min-w-0">
            <h2 class="text-xs font-bold text-[var(--color-text)] truncate" [title]="visionService.previewLabel()">
              {{ visionService.previewLabel() || 'Document Preview' }}
            </h2>
            <div class="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
              @if (visionService.currentResult()) {
                @if (visionService.isHandwritten()) {
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ui-pill-warning">✍️ Handwritten Form</span>
                } @else {
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ui-pill-neutral">🪪 Printed KYC Proof</span>
                }
                <span>·</span>
              }
              <span>Zoom: {{ (zoomLevel() * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>

        <!-- Zoom & View Controls -->
        <div class="flex items-center gap-1.5 shrink-0">
          @if (visionService.fullPdfUrl()) {
            <a
              [href]="visionService.fullPdfUrl()"
              target="_blank"
              class="btn btn-secondary !py-1 !px-2 text-xs flex items-center gap-1 text-teal-700 dark:text-teal-300 font-bold hover:underline"
              title="Open raw PDF file in new browser tab">
              <span>Open PDF</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          }

          <button
            type="button"
            (click)="zoomOut()"
            class="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-secondary)] transition-colors"
            title="Zoom out"
            aria-label="Zoom out">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>

          <button
            type="button"
            (click)="resetZoom()"
            class="px-2 py-1 rounded-lg border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-mono text-[var(--color-text-secondary)] transition-colors"
            title="Reset Zoom">
            100%
          </button>

          <button
            type="button"
            (click)="zoomIn()"
            class="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-secondary)] transition-colors"
            title="Zoom in"
            aria-label="Zoom in">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button
            type="button"
            (click)="toggleFullScreen()"
            class="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--color-text-secondary)] transition-colors"
            title="Full screen view"
            aria-label="Full screen view">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Preview Viewport -->
      <div class="flex-1 min-h-[380px] max-h-[620px] overflow-auto rounded-xl glass-inset flex items-center justify-center p-3 relative select-none">
        @if (visionService.previewUrl(); as url) {
          @if (visionService.isPdfPreview() && !isRenderedImage(url)) {
            <!-- Embedded PDF Frame -->
            <iframe
              [src]="url"
              class="w-full h-full min-h-[500px] border-none rounded-lg"
              title="PDF Document Preview">
            </iframe>
          } @else {
            <!-- High-Resolution Image Preview -->
            <img
              [src]="url"
              [alt]="visionService.previewLabel()"
              class="max-w-none transition-transform duration-200 rounded-lg shadow-md object-contain"
              [style.transform]="'scale(' + zoomLevel() + ')'"
              [style.transform-origin]="'center top'">
          }
        } @else {
          <div class="text-center p-8 text-[var(--color-text-muted)] space-y-2">
            <div class="w-12 h-12 mx-auto rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xl">
              📄
            </div>
            <p class="text-xs font-semibold text-[var(--color-text)]">No Document Uploaded</p>
            <p class="text-[11px] text-[var(--color-text-secondary)]">Drop or upload a KYC document or proposal form to preview and analyze.</p>
          </div>
        }
      </div>

      <!-- Footer Info -->
      <div class="mt-2 text-center text-[11px] text-[var(--color-text-secondary)]">
        High-fidelity visual inspection canvas · Gemini Vision multimodal resolution
      </div>
    </div>

    <!-- Fullscreen Modal -->
    @if (isFullScreen()) {
      <div
        class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col p-4"
        (click)="toggleFullScreen()">
        <div class="flex items-center justify-between text-white mb-3" (click)="$event.stopPropagation()">
          <span class="font-bold text-sm">{{ visionService.previewLabel() }}</span>
          <button
            type="button"
            (click)="toggleFullScreen()"
            class="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition-all">
            Close ✕
          </button>
        </div>
        <div class="flex-1 flex items-center justify-center overflow-auto" (click)="$event.stopPropagation()">
          <img
            [src]="visionService.previewUrl()"
            class="max-w-[95%] max-h-[90vh] object-contain rounded-lg shadow-2xl">
        </div>
      </div>
    }
  `
})
export class ViewerComponent {
  readonly zoomLevel = signal<number>(1.0);
  readonly isFullScreen = signal<boolean>(false);

  constructor(public visionService: DocumentVisionService) {}

  isRenderedImage(url: string): boolean {
    return /\.(png|jpg|jpeg|webp)$/i.test(url) || url.includes('/rendered/') || url.includes('render=1');
  }

  zoomIn(): void {
    this.zoomLevel.update(z => Math.min(2.5, +(z + 0.15).toFixed(2)));
  }

  zoomOut(): void {
    this.zoomLevel.update(z => Math.max(0.4, +(z - 0.15).toFixed(2)));
  }

  resetZoom(): void {
    this.zoomLevel.set(1.0);
  }

  toggleFullScreen(): void {
    this.isFullScreen.update(v => !v);
  }
}
