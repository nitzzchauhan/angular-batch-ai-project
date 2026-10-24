import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentVisionService } from '../../services/document-vision.service';

@Component({
  selector: 'app-batch-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <!-- Batch Stats Header Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="glass-panel rounded-xl p-3">
          <span class="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Documents Ingested</span>
          <div class="text-xl font-bold font-mono text-[var(--color-text)] mt-1">{{ totalDocs() }}</div>
        </div>

        <div class="glass-panel rounded-xl p-3">
          <span class="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Flagged Entries</span>
          <div class="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">{{ totalFlagged() }}</div>
        </div>

        <div class="glass-panel rounded-xl p-3">
          <span class="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">STP Rate</span>
          <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{{ stpRate() }}%</div>
        </div>

        <div class="glass-panel rounded-xl p-3">
          <span class="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Processing Failures</span>
          <div class="text-xl font-bold font-mono text-slate-600 dark:text-slate-400 mt-1">{{ totalFailures() }}</div>
        </div>
      </div>

      <!-- Batch Table Card -->
      <div class="glass-panel rounded-2xl overflow-hidden shadow-sm">
        <div class="p-3.5 border-b border-[var(--color-border)] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <h3 class="text-xs font-bold text-[var(--color-text)]">Corpus Batch Pipeline Deliverables</h3>
          <span class="text-[10px] font-mono text-[var(--color-text-secondary)]">Click Open to inspect individual document audit</span>
        </div>

        <div class="overflow-x-auto task3-table">
          <table class="data-table">
            <thead>
              <tr>
                <th class="w-[28%]">Document File</th>
                <th class="w-[24%]">Classification</th>
                <th class="w-[18%]">Form Style</th>
                <th class="w-[12%] text-center">Score</th>
                <th class="w-[10%] text-center">Flagged</th>
                <th class="w-[8%] text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (item of batchDocList(); track item.filename) {
                <tr [class.row-flagged-warning]="item.flaggedCount > 0">
                  <td class="py-2.5 px-3 font-mono text-xs font-semibold text-[var(--color-text)]">
                    {{ item.filename }}
                  </td>
                  <td class="py-2.5 px-3 text-xs font-bold text-[var(--color-text)]">
                    {{ item.classification }}
                  </td>
                  <td class="py-2.5 px-3 text-xs">
                    @if (item.isHandwritten) {
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ui-pill-warning">✍️ Handwritten</span>
                    } @else {
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold ui-pill-neutral">🪪 Printed ID</span>
                    }
                  </td>
                  <td class="py-2.5 px-3 text-center font-mono text-xs font-bold" [class.score-pass]="item.flaggedCount === 0" [class.score-warn]="item.flaggedCount > 0">
                    {{ (item.confidence * 100).toFixed(0) }}%
                  </td>
                  <td class="py-2.5 px-3 text-center font-mono text-xs font-bold">
                    @if (item.flaggedCount > 0) {
                      <span class="text-amber-600 dark:text-amber-400">{{ item.flaggedCount }}</span>
                    } @else {
                      <span class="text-emerald-600 dark:text-emerald-400">0</span>
                    }
                  </td>
                  <td class="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      (click)="inspectDoc(item.filename)"
                      class="btn btn-secondary !py-1 !px-2 text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 transition-colors">
                      Open
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center py-6 text-xs text-[var(--color-text-muted)]">
                    No batch pipeline data loaded yet. Click "Run All 10+ Batch Pipeline" on the left sidebar to execute.
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
export class BatchSummaryComponent {
  constructor(public visionService: DocumentVisionService) {}

  batchResults() {
    return this.visionService.batchResults();
  }

  totalDocs(): number {
    const res = this.batchResults();
    if (res?.documents) return Object.keys(res.documents).length;
    return Object.keys(this.visionService.batchCache()).length;
  }

  totalFlagged(): number {
    const res = this.batchResults();
    return res?.flagging_report?.total_flagged_fields || 0;
  }

  totalFailures(): number {
    return this.batchResults()?.failures?.length || 0;
  }

  stpRate(): number {
    const total = this.totalDocs();
    if (!total) return 100;
    const clean = this.batchDocList().filter(d => d.flaggedCount === 0).length;
    return Math.round((clean / total) * 100);
  }

  batchDocList(): Array<{
    filename: string;
    classification: string;
    isHandwritten: boolean;
    confidence: number;
    flaggedCount: number;
  }> {
    const docs = this.batchResults()?.documents || this.visionService.batchCache();
    return Object.keys(docs).map(filename => {
      const doc = docs[filename];
      const jd = doc.json_data;
      const flagged = doc.flagging_report?.flagged_fields?.length || doc.flagging_report?.flagged_count || 0;
      return {
        filename,
        classification: doc.classification || jd?.document_type || 'KYC Document',
        isHandwritten: jd?.is_handwritten === true,
        confidence: jd?.overall_confidence || 0.95,
        flaggedCount: flagged
      };
    });
  }

  inspectDoc(filename: string): void {
    const cached = this.visionService.batchCache()[filename];
    if (cached) {
      this.visionService.currentResult.set(cached);
      this.visionService.previewLabel.set(filename);
      this.visionService.activeTab.set('extracted');
    }
  }
}
