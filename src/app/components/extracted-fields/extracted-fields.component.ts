import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentVisionService } from '../../services/document-vision.service';

@Component({
  selector: 'app-extracted-fields',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <!-- Out of Scope Advisory Banner -->
      @if (currentResult()?.is_supported === false) {
        <div class="rounded-xl p-4 ui-banner-warning text-sm">
          <div class="flex items-start gap-3">
            <span class="text-xl">⚠️</span>
            <div class="space-y-1">
              <div class="font-bold text-sm text-amber-900 dark:text-amber-200">
                Out-of-Scope Document ({{ currentResult()?.detected_type || 'Unrecognized Format' }})
              </div>
              <p class="text-xs text-amber-800 dark:text-amber-100 leading-relaxed">
                {{ currentResult()?.unsupported_reason || 'This document does not match any of the 10 supported KYC identity proofs and insurance proposal form schemas. Automated straight-through onboarding is disabled.' }}
              </p>
            </div>
          </div>
        </div>
      }

      <!-- Missing Mandatory Fields Alert -->
      @if (missingFields().length > 0) {
        <div class="rounded-xl p-3 ui-banner-danger text-xs flex items-center gap-2">
          <span class="font-bold text-sm">⚠️</span>
          <span>
            <strong>Missing mandatory KYC fields:</strong>
            {{ missingFields().join(', ') }}
          </span>
        </div>
      }

      <!-- Extracted Fields Table Card -->
      <div class="glass-panel rounded-2xl overflow-hidden shadow-sm">
        <div class="p-3.5 border-b border-[var(--color-border)] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div class="flex items-center gap-2">
            <h3 class="text-xs font-bold text-[var(--color-text)]">Extracted Field Values & Quality Audit</h3>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 font-bold">
              {{ fieldEntries().length }} fields
            </span>
          </div>

          <div class="text-[11px] text-[var(--color-text-secondary)]">
            Click any value below to correct or verify as human auditor
          </div>
        </div>

        <div class="overflow-x-auto task3-table">
          <table class="data-table">
            <thead>
              <tr>
                <th class="w-[28%]">Field Name</th>
                <th class="w-[42%]">Extracted Value (Editable)</th>
                <th class="w-[15%] text-center">Confidence</th>
                <th class="w-[15%] text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of fieldEntries(); track entry.key) {
                <tr [class.row-flagged-warning]="isFieldFlagged(entry)">
                  <!-- Field Name -->
                  <td class="py-2.5 px-3">
                    <div class="font-bold text-xs text-[var(--color-text)]">
                      {{ formatFieldName(entry.key) }}
                    </div>
                    @if (showRawKey(entry.key)) {
                      <div class="text-[10px] font-mono text-[var(--color-text-muted)]">
                        {{ entry.key }}
                      </div>
                    }
                  </td>

                  <!-- Value Input -->
                  <td class="py-2 px-3">
                    <input
                      type="text"
                      [ngModel]="getFieldValue(entry.item)"
                      (change)="onFieldChange(entry.key, $event)"
                      class="field-edit w-full text-xs font-mono rounded-lg px-3 py-1.5 border border-black/15 dark:border-white/15 bg-white/90 dark:bg-[#11231e]/90 text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-teal)] focus:border-transparent transition-all shadow-sm"
                      [placeholder]="isFieldFlagged(entry) ? 'Missing - click to enter value…' : 'Enter value…'">
                    
                    @if (entry.item?.corrected) {
                      <div class="mt-1">
                        <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ui-pill-verified">
                          ✏️ Auditor Verified & Saved
                        </span>
                      </div>
                    }
                  </td>

                  <!-- Confidence Score -->
                  <td class="py-2.5 px-3 text-center">
                    <span
                      class="font-mono text-xs font-bold"
                      [class.score-pass]="!isFieldFlagged(entry)"
                      [class.score-warn]="isFieldFlagged(entry)">
                      {{ (getFieldScore(entry.item) * 100).toFixed(0) }}%
                    </span>
                  </td>

                  <!-- Compliance Pill -->
                  <td class="py-2.5 px-3 text-center">
                    @if (entry.item?.corrected) {
                      <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ui-pill-verified">
                        ✏️ Corrected
                      </span>
                    } @else if (isFieldFlagged(entry)) {
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ui-pill-warning">
                        Needs Review
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ui-pill-success">
                        ✓ Verified
                      </span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="text-center py-6 text-xs text-[var(--color-text-muted)]">
                    No fields extracted yet. Process a document to inspect fields.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ExtractedFieldsComponent {
  constructor(public visionService: DocumentVisionService) {}

  currentResult() {
    return this.visionService.currentResult();
  }

  missingFields(): string[] {
    return this.currentResult()?.flagging_report?.missing_fields || [];
  }

  fieldEntries(): Array<{ key: string; item: any }> {
    const res = this.currentResult();
    const extracted = res?.json_data?.extracted_data || res?.json_data?.fields || {};
    return Object.keys(extracted).map(key => ({
      key,
      item: extracted[key]
    }));
  }

  getFieldValue(item: any): string {
    if (item && typeof item === 'object' && 'value' in item) {
      return item.value !== null && item.value !== undefined ? String(item.value) : '';
    }
    return item !== null && item !== undefined ? String(item) : '';
  }

  getFieldScore(item: any): number {
    if (!item || typeof item !== 'object') return 1.0;
    if (item.confidence_score !== undefined) return Number(item.confidence_score);
    if (item.confidence !== undefined) return Number(item.confidence);
    return 1.0;
  }

  isFieldFlagged(entry: { key: string; item: any }): boolean {
    if (entry.item?.corrected) return false;
    const score = this.getFieldScore(entry.item);
    const threshold = this.visionService.confidenceThreshold();
    const flaggedList = this.visionService.flaggedFields();
    return score < threshold || flaggedList.some(f => f.field_name === entry.key || f.name === entry.key);
  }

  formatFieldName(k: string): string {
    if (!k) return '';
    return k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  showRawKey(key: string): boolean {
    const formatted = this.formatFieldName(key);
    return key.toLowerCase() !== formatted.toLowerCase() && key.replace(/_/g, ' ').toLowerCase() !== formatted.toLowerCase();
  }

  onFieldChange(key: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.visionService.correctField(key, target.value);
  }
}
