import { Injectable, signal, computed } from '@angular/core';
import {
  ProcessDocumentResponse,
  BatchPipelineResponse,
  FlaggingReport,
  FieldExtraction,
  FlaggedField
} from '../models/document.model';
import { GeminiVisionService } from './gemini-vision.service';

@Injectable({
  providedIn: 'root'
})
export class DocumentVisionService {
  private requestGeneration = 0;
  private stageInterval: ReturnType<typeof setInterval> | null = null;

  // Reactive State Signals
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly previewLabel = signal<string | null>(null);
  readonly isPdfPreview = signal<boolean>(false);
  readonly fullPdfUrl = signal<string | null>(null);

  readonly currentResult = signal<ProcessDocumentResponse | null>(null);
  readonly batchResults = signal<BatchPipelineResponse | null>(null);
  readonly batchCache = signal<Record<string, ProcessDocumentResponse>>({});

  readonly isLoading = signal<boolean>(false);
  readonly loadingStage = signal<string>('Ready');
  readonly errorMessage = signal<string | null>(null);
  readonly infoBanner = signal<string | null>(null);

  readonly confidenceThreshold = signal<number>(0.85);
  readonly activeTab = signal<'extracted' | 'flagging' | 'json' | 'methodology' | 'batch'>('extracted');

  // Compatibility signals
  readonly isFallbackActive = computed(() => false);
  readonly selectedSample = signal<string>('');

  // Computed state
  readonly isHandwritten = computed(() => {
    const res = this.currentResult();
    return res?.json_data?.is_handwritten === true;
  });

  readonly flaggedFields = computed(() => {
    const res = this.currentResult();
    return res?.flagging_report?.flagged_fields || [];
  });

  readonly flaggedCount = computed(() => {
    return this.flaggedFields().length;
  });

  readonly needsHumanReview = computed(() => {
    const res = this.currentResult();
    if (!res) return false;
    if (res.is_supported === false) return true;
    return this.flaggedCount() > 0 || res.flagging_report?.needs_human_review === true;
  });

  readonly overallConfidence = computed(() => {
    const res = this.currentResult();
    const conf = res?.json_data?.overall_confidence;
    return conf !== undefined && conf !== null ? conf : 0.95;
  });

  constructor(private gemini: GeminiVisionService) {}

  handleCustomFile(file: File, autoProcess: boolean = true): void {
    this.selectedFile.set(file);
    this.errorMessage.set(null);

    const isPdf = file.type.includes('pdf') || /\.pdf$/i.test(file.name);
    this.isPdfPreview.set(isPdf);
    this.previewLabel.set(file.name);

    const objectUrl = URL.createObjectURL(file);
    this.previewUrl.set(objectUrl);
    this.fullPdfUrl.set(isPdf ? objectUrl : null);

    if (autoProcess) {
      this.processUploadedFile(file);
    }
  }

  clearSelectedFile(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.previewLabel.set(null);
    this.fullPdfUrl.set(null);
    this.currentResult.set(null);
    this.errorMessage.set(null);
  }

  processCurrent(): void {
    const file = this.selectedFile();
    if (file) {
      this.processUploadedFile(file);
    } else {
      this.errorMessage.set('Please select or upload a document to analyze.');
    }
  }

  private beginRequest(stages: string[]): number {
    const gen = ++this.requestGeneration;
    this.startLoading(stages);
    return gen;
  }

  private isCurrentRequest(gen: number): boolean {
    return gen === this.requestGeneration;
  }

  async processUploadedFile(file: File): Promise<void> {
    const gen = this.beginRequest([
      'Encoding uploaded document in the browser…',
      `Calling Gemini (${this.gemini.model()}) multimodal vision…`,
      'Applying PII redaction and scoring confidence…'
    ]);

    try {
      const data = await this.gemini.analyzeBlob(file, file.name, this.confidenceThreshold());
      if (!this.isCurrentRequest(gen)) return;
      this.handleProcessSuccess(data, file.name);
    } catch (err) {
      if (!this.isCurrentRequest(gen)) return;
      this.handleProcessError(err);
    }
  }

  private handleProcessSuccess(data: ProcessDocumentResponse, filename: string): void {
    this.stopLoading();
    if (!data.filename) data.filename = filename;
    this.currentResult.set(data);
    this.errorMessage.set(null);
    this.updateCache(filename, data);
  }

  private updateCache(filename: string, data: ProcessDocumentResponse): void {
    const cache = { ...this.batchCache() };
    cache[filename] = data;
    this.batchCache.set(cache);
  }

  private handleProcessError(err: unknown): void {
    this.stopLoading();
    this.errorMessage.set(
      err instanceof Error ? err.message : 'Document vision extraction failed.'
    );
  }

  correctField(key: string, newValue: string): void {
    const res = this.currentResult();
    const extracted = res?.json_data?.extracted_data || res?.json_data?.fields;
    if (!res || !extracted || !(key in extracted)) return;

    const currentItem = extracted[key];
    const itemObj = typeof currentItem === 'object' && currentItem !== null ? currentItem : {};
    const updatedExtracted = {
      ...extracted,
      [key]: {
        ...itemObj,
        value: newValue,
        corrected: true,
        confidence: 1.0,
        confidence_score: 1.0,
        flagged: false
      }
    };

    const remainingFlagged = (res.flagging_report?.flagged_fields || []).filter(
      (f) => f.field_name !== key && f.name !== key
    );

    const updatedResult: ProcessDocumentResponse = {
      ...res,
      json_data: {
        ...res.json_data!,
        extracted_data: updatedExtracted,
        needs_human_review: remainingFlagged.length > 0
      },
      flagging_report: {
        ...res.flagging_report,
        confidence_threshold: res.flagging_report?.confidence_threshold ?? this.confidenceThreshold(),
        flagged_fields: remainingFlagged,
        flagged_count: remainingFlagged.length,
        needs_human_review: remainingFlagged.length > 0
      }
    };

    this.currentResult.set(updatedResult);
    if (res.filename) {
      this.updateCache(res.filename, updatedResult);
    }
  }

  setThreshold(val: number): void {
    this.confidenceThreshold.set(val);
    const res = this.currentResult();
    const extracted = res?.json_data?.extracted_data || res?.json_data?.fields;
    if (!res || !extracted) return;

    const newFlagged: FlaggedField[] = Object.entries(extracted)
      .filter(([_, item]) => {
        const score = item?.confidence_score ?? item?.confidence ?? 1.0;
        return score < val && !item?.corrected;
      })
      .map(([k, item]) => {
        const score = item?.confidence_score ?? item?.confidence ?? 1.0;
        return {
          document_name: res.filename,
          document_type: res.classification,
          field_name: k,
          value: item?.value,
          confidence_score: score,
          threshold: val,
          reason: `Confidence score (${(score * 100).toFixed(0)}%) is below calibrated ${val} threshold.`,
          recommended_action: 'Human auditor verification required.'
        };
      });

    this.currentResult.set({
      ...res,
      flagging_report: {
        ...res.flagging_report,
        confidence_threshold: val,
        flagged_fields: newFlagged,
        flagged_count: newFlagged.length,
        needs_human_review: newFlagged.length > 0
      }
    });
  }

  stopRequest(): void {
    this.requestGeneration++;
    this.stopLoading();
    this.errorMessage.set('Processing stopped by user.');
  }

  private startLoading(stages: string[]): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    let i = 0;
    this.loadingStage.set(stages[0]);

    if (this.stageInterval) {
      clearInterval(this.stageInterval);
    }
    this.stageInterval = setInterval(() => {
      i = Math.min(i + 1, stages.length - 1);
      this.loadingStage.set(stages[i]);
    }, 1500);
  }

  private stopLoading(): void {
    this.isLoading.set(false);
    if (this.stageInterval) {
      clearInterval(this.stageInterval);
      this.stageInterval = null;
    }
  }
}
