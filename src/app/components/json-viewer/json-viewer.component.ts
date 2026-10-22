import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentVisionService } from '../../services/document-vision.service';

@Component({
  selector: 'app-json-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-panel rounded-2xl overflow-hidden shadow-sm">
      <div class="p-3.5 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-2 bg-black/[0.02] dark:bg-white/[0.02]">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-[var(--color-text)]">Structured JSON Deliverable</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 font-semibold">
            Pydantic v2 Schema
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="copyJson()"
            class="btn btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1.5 font-bold">
            @if (copied()) {
              <span class="text-emerald-600 dark:text-emerald-400">✓ Copied to Clipboard</span>
            } @else {
              <svg class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy JSON</span>
            }
          </button>

          <button
            type="button"
            (click)="downloadJson()"
            class="btn btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1.5 font-bold">
            <svg class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download .json</span>
          </button>
        </div>
      </div>

      <div class="p-4 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed">
        <pre>{{ jsonFormatted() }}</pre>
      </div>
    </div>
  `
})
export class JsonViewerComponent {
  readonly copied = signal<boolean>(false);

  constructor(public visionService: DocumentVisionService) {}

  jsonFormatted(): string {
    const res = this.visionService.currentResult();
    if (!res) return '{\n  "status": "No active document analyzed yet."\n}';
    return JSON.stringify(res, null, 2);
  }

  copyJson(): void {
    const str = this.jsonFormatted();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(str).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }

  downloadJson(): void {
    const str = this.jsonFormatted();
    const res = this.visionService.currentResult();
    const fname = (res?.filename || 'document_extraction').replace(/[^\w.-]+/g, '_');
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fname}_extracted.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
