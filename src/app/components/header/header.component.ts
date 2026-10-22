import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { DocumentVisionService } from '../../services/document-vision.service';
import { GeminiVisionService } from '../../services/gemini-vision.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="glass-bar sticky top-0 z-50 h-14 flex items-center justify-between px-4 sm:px-6">
      <div class="flex items-center gap-3 min-w-0">
        <div class="flex flex-col justify-center">
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-bold leading-tight text-[var(--color-text)] flex items-center gap-1.5">
              <span>Document Vision Pipeline</span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20">Angular SPA</span>
            </h1>
          </div>
          <span class="text-[11px] text-[var(--color-text-muted)] leading-tight">Task 3 · Multimodal KYC & Insurance HITL Quality Pipeline</span>
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0">
        <!-- Live Gemini vs Fallback Status Pill -->
        @if (visionService.isFallbackActive()) {
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 shadow-sm" title="Operating with verified offline ground truth answer key">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>📋 Ground Truth Mode</span>
          </div>
        } @else if (gemini.configured()) {
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 shadow-sm" title="Connected to Google Gemini API with automated multi-key failover">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>⚡ {{ gemini.model() }} ({{ gemini.resolveKeys().length }} keys)</span>
          </div>
        } @else {
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20" title="API keys not found in env">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>API key needed</span>
          </div>
        }

        <!-- Live Compliance Pill -->
        @if (visionService.currentResult()) {
          @if (visionService.needsHumanReview()) {
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ui-pill-warning shadow-sm">
              <span class="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
              <span>{{ visionService.flaggedCount() }} {{ visionService.flaggedCount() === 1 ? 'Field Needs' : 'Fields Need' }} Review</span>
            </div>
          } @else {
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ui-pill-success shadow-sm">
              <span>✓</span>
              <span>Straight-Through Approved ({{ (visionService.overallConfidence() * 100).toFixed(0) }}% Conf)</span>
            </div>
          }
        }

        <span class="hidden md:inline text-xs font-medium text-[var(--color-text-secondary)]">
          Threshold: <strong>{{ (visionService.confidenceThreshold() * 100).toFixed(0) }}%</strong>
        </span>

        <!-- Theme Toggle -->
        <button
          type="button"
          (click)="themeService.toggleTheme()"
          class="p-2 rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          [title]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'">
          @if (themeService.isDark()) {
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" stroke-width="2"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"/>
            </svg>
          } @else {
            <svg class="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          }
        </button>
      </div>
    </header>
  `
})
export class HeaderComponent {
  constructor(
    public themeService: ThemeService,
    public visionService: DocumentVisionService,
    public gemini: GeminiVisionService
  ) {}
}
