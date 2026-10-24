import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentVisionService } from '../../services/document-vision.service';
import { GeminiVisionService } from '../../services/gemini-vision.service';

@Component({
  selector: 'app-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <!-- File Upload Card (Primary Action) -->
      <div class="glass-panel rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Upload Document</p>
          <span class="text-[10px] font-mono text-[var(--color-text-secondary)]">PNG · JPG · PDF</span>
        </div>

        <input
          #fileInput
          type="file"
          accept="image/*,application/pdf"
          class="hidden"
          (change)="onFileSelected($event)">

        <div
          class="glass-inset rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 p-6 text-center cursor-pointer transition-all hover:border-[var(--color-teal)]"
          [class.dragover]="isDragging"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)">
          
          <div class="w-12 h-12 mx-auto rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <p class="text-xs font-bold text-[var(--color-text)]">Drop document here or click to browse</p>
          <p class="text-[11px] text-[var(--color-text-secondary)] mt-1">Accepts KYC proofs, scanned forms & proposal PDFs</p>

          @if (visionService.selectedFile(); as file) {
            <div class="mt-3 inline-flex items-center gap-2 text-xs bg-white/90 dark:bg-slate-800/90 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-[var(--color-text)] shadow-sm max-w-full" (click)="$event.stopPropagation()">
              <span class="truncate max-w-[170px]">{{ file.name }}</span>
              <span class="text-[10px] text-[var(--color-text-muted)]">({{ formatFileSize(file.size) }})</span>
              <button
                type="button"
                (click)="visionService.clearSelectedFile()"
                class="text-[var(--color-text-muted)] hover:text-red-500 transition-colors ml-1"
                title="Remove file"
                aria-label="Remove file">&times;</button>
            </div>
          }
        </div>

        <div>
          @if (visionService.isLoading()) {
            <button
              type="button"
              (click)="visionService.stopRequest()"
              class="btn btn-stop w-full flex items-center justify-center gap-2 font-bold shadow-md">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5"/>
              </svg>
              <span>Stop Processing</span>
            </button>
          } @else {
            <button
              type="button"
              [disabled]="!visionService.selectedFile()"
              (click)="visionService.processCurrent()"
              class="btn btn-primary w-full flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{{ visionService.currentResult() ? 'Re-analyze with Gemini' : 'Analyze with Gemini' }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Gemini Engine & Key Card -->
      <div class="glass-panel rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Gemini Vision Engine</p>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/20">
            {{ gemini.resolveKeys().length }} Key Pool
          </span>
        </div>

        <!-- Model Selection Dropdown -->
        <div class="space-y-1">
          <label class="text-[11px] font-medium text-[var(--color-text-secondary)]">Active Multimodal Model</label>
          <select
            [ngModel]="gemini.model()"
            (ngModelChange)="onModelChange($event)"
            class="app-input text-xs font-mono cursor-pointer">
            <option value="gemini-3.5-flash">gemini-3.5-flash (Standard Fast Vision)</option>
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Lightweight)</option>
            <option value="gemini-3.8-flash">gemini-3.8-flash (High Performance)</option>
          </select>
        </div>

        <!-- Optional API Key Override -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <label class="text-[10px] text-[var(--color-text-muted)]">Custom Key Override</label>
            @if (gemini.apiKey()) {
              <button
                type="button"
                (click)="gemini.setApiKey('')"
                class="text-[10px] text-red-500 hover:underline">
                Clear override
              </button>
            }
          </div>
          <input
            type="password"
            autocomplete="off"
            [ngModel]="gemini.apiKey()"
            (ngModelChange)="gemini.setApiKey($event)"
            placeholder="Loaded from ./env automatically"
            class="app-input text-xs font-mono">
        </div>
      </div>

      <!-- Pipeline Specifications Card -->
      <div class="glass-panel rounded-2xl p-4 text-xs space-y-2.5">
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Pipeline Standards</p>
        
        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]">
          <span class="text-[var(--color-text-secondary)]">Decision Cutoff:</span>
          <span class="font-mono font-bold text-amber-600 dark:text-amber-400">0.85 (85%)</span>
        </div>

        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]">
          <span class="text-[var(--color-text-secondary)]">Aadhaar Privacy:</span>
          <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">PII Redacted</span>
        </div>

        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]">
          <span class="text-[var(--color-text-secondary)]">Vision Engine:</span>
          <span class="font-mono font-bold text-teal-600 dark:text-teal-400">Gemini Flash Multimodal</span>
        </div>

        <div class="flex items-center justify-between py-1">
          <span class="text-[var(--color-text-secondary)]">Human Review:</span>
          <span class="font-mono font-bold text-teal-600 dark:text-teal-400">Interactive Audit</span>
        </div>
      </div>
    </div>
  `
})
export class UploaderComponent {
  isDragging = false;

  constructor(
    public visionService: DocumentVisionService,
    public gemini: GeminiVisionService
  ) {}

  onModelChange(modelName: string): void {
    this.gemini.model.set(modelName);
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 KB';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.visionService.handleCustomFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.visionService.handleCustomFile(event.dataTransfer.files[0]);
    }
  }
}
