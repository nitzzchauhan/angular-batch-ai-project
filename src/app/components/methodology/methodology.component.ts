import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-methodology',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <!-- Methodology Hero Card -->
      <div class="glass-panel rounded-2xl p-5 space-y-4">
        <div class="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
          <div class="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            📝
          </div>
          <div>
            <h3 class="text-sm font-bold text-[var(--color-text)]">
              Engineering Note: Handwritten vs. Printed Text Extraction
            </h3>
            <p class="text-xs text-[var(--color-text-secondary)]">Technical architecture, visual transformer routing, and failure-case analysis</p>
          </div>
        </div>

        <!-- Section 1: The Problem -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-teal-600"></span>
            <span>1. Why Traditional OCR Fails on Insurance Proposals</span>
          </h4>
          <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Standard OCR engines (such as Tesseract and rigid optical contour extractors) rely on fixed bounding boxes and predefined glyph templates. When applied to <strong>printed KYC identity proofs</strong> (Aadhaar, PAN Card, Driving Licence, Passport), standard OCR performs reasonably well due to high contrast and uniform typography.
          </p>
          <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            However, on <strong>handwritten insurance onboarding forms</strong> (NACH/ECS Bank Mandates, FATCA declarations, Moral Hazard questionnaires), humans write with varying slant angles, faint blue/black ink strokes, cursive connections, and character overflow across pre-printed table boxes. Traditional OCR routinely confuses:
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div class="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)] text-xs">
              <strong class="text-amber-700 dark:text-amber-300">Digit vs Letter:</strong>
              <div class="text-[11px] text-[var(--color-text-secondary)] mt-0.5"><code>'0'</code> mistaken for <code>'O'</code>, <code>'1'</code> mistaken for <code>'I'</code>, <code>'5'</code> for <code>'S'</code> in Bank Account & Policy numbers.</div>
            </div>
            <div class="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)] text-xs">
              <strong class="text-amber-700 dark:text-amber-300">IFSC / TIN Codes:</strong>
              <div class="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Character 5 of Indian IFSC codes is always strictly zero (e.g. <code>SBIN0001234</code>); legacy OCR misreads as <code>SBINOOOO1234</code>.</div>
            </div>
            <div class="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--color-border)] text-xs">
              <strong class="text-amber-700 dark:text-amber-300">Date Formats:</strong>
              <div class="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Handwritten slashes <code>'/'</code> vs ones <code>'1'</code> causing date validation rejections (<code>18/12/1979</code>).</div>
            </div>
          </div>
        </div>

        <!-- Section 2: Multimodal Architecture -->
        <div class="space-y-2 pt-2 border-t border-[var(--color-border)]">
          <h4 class="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-teal-600"></span>
            <span>2. Gemini Multimodal Vision Transformer Pipeline</span>
          </h4>
          <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Rather than feeding disjointed character crops into an OCR engine, we feed the entire high-resolution image directly into <strong>Gemini Vision Transformer</strong>. The model analyzes both visual spatial context and semantic language context simultaneously:
          </p>
          <ul class="text-xs text-[var(--color-text-secondary)] list-disc pl-5 space-y-1 leading-relaxed">
            <li><strong>Spatial Co-location:</strong> It locates the label <code>IFSC Code</code> and inspects the adjacent dotted boxes for 11 alphanumeric characters matching the standard Indian banking regex <code>^[A-Z]{{4}}0[A-Z0-9]{{6}}$</code>.</li>
            <li><strong>Dual Visual Encoders:</strong> Printed Statutory IDs are classified with ~0.98 confidence, while handwritten text is routed with beam search and scored with calibrated per-field confidence.</li>
            <li><strong>PII Redaction:</strong> Aadhaar numbers are intercepted at the model boundary and automatically sanitized to <code>[Aadhaar Redacted]</code> to prevent statutory privacy breaches.</li>
          </ul>
        </div>

        <!-- Section 3: Observed Failure Modes & Mitigations -->
        <div class="space-y-2 pt-2 border-t border-[var(--color-border)]">
          <h4 class="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-600"></span>
            <span>3. Observed Failure Modes & Mitigations</span>
          </h4>
          <div class="overflow-x-auto task3-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="w-[30%]">Observed Failure Mode</th>
                  <th class="w-[35%]">Real-World Consequence</th>
                  <th class="w-[35%]">Pipeline Safeguard / Mitigation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-bold text-xs py-2 px-3 text-[var(--color-text)]">Cursive Slanted Signature Overwrite</td>
                  <td class="text-xs py-2 px-3 text-[var(--color-text-secondary)]">Applicant signature overlaps date or place line, obscuring text characters.</td>
                  <td class="text-xs py-2 px-3 text-[var(--color-text)] font-semibold">Flagged automatically below 0.85 threshold for human verification.</td>
                </tr>
                <tr>
                  <td class="font-bold text-xs py-2 px-3 text-[var(--color-text)]">Checkbox Selection Ambiguity</td>
                  <td class="text-xs py-2 px-3 text-[var(--color-text-secondary)]">Proposer crosses out one checkbox and marks another on Multiple Policies Form.</td>
                  <td class="text-xs py-2 px-3 text-[var(--color-text)] font-semibold">Confidence drops to 0.75-0.80, forcing auditor review.</td>
                </tr>
                <tr>
                  <td class="font-bold text-xs py-2 px-3 text-[var(--color-text)]">Faint Carbon Copy Mandate</td>
                  <td class="text-xs py-2 px-3 text-[var(--color-text-secondary)]">Lower layer of NACH carbon copy has weak stroke density.</td>
                  <td class="text-xs py-2 px-3 text-[var(--color-text)] font-semibold">Contrast pre-processing and interactive HITL inline correction workspace.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MethodologyComponent {}
