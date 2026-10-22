import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FieldExtraction, FlaggedField, ProcessDocumentResponse } from '../models/document.model';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'gemini_api_key_override';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thoughtSignature?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number; status?: string };
}

interface GeminiField {
  name?: string;
  value?: string | number | null;
  confidence?: number;
  method?: string;
}

interface GeminiExtract {
  document_type?: string;
  is_handwritten?: boolean;
  is_supported?: boolean;
  unsupported_reason?: string;
  classification_confidence?: number;
  overall_confidence?: number;
  fields?: GeminiField[] | Record<string, GeminiField | string | number | null>;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiVisionService {
  readonly apiKey = signal(this.readStoredKey());
  readonly model = signal(environment.geminiModel || 'gemini-3.5-flash');
  readonly envKeyCount = environment.geminiApiKeys?.length || (environment.geminiApiKey ? 1 : 0);
  readonly configured = computed(() => this.resolveKeys().length > 0);

  // Model fallback candidates when a model experiences high demand (503) or unavailability
  readonly modelCandidates = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

  constructor(private http: HttpClient) {}

  setApiKey(key: string): void {
    const trimmed = key.trim();
    this.apiKey.set(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures (private mode).
    }
  }

  resolveKeys(): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    const override = this.apiKey().trim();
    const fromEnv = [
      environment.geminiApiKey,
      ...(environment.geminiApiKeys || [])
    ]
      .map((item) => (item || '').trim())
      .filter(Boolean);

    for (const key of [override, ...fromEnv]) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    return keys;
  }

  async analyzeBlob(blob: Blob, filename: string, threshold: number): Promise<ProcessDocumentResponse> {
    const keys = this.resolveKeys();
    if (!keys.length) {
      throw new Error(
        'No Gemini API key found. Add GEMINI_API_KEY to the env file, then restart npm start.'
      );
    }

    const mimeType = blob.type || this.guessMime(filename);
    const base64 = await this.blobToBase64(blob);
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: this.buildPrompt(filename) },
            { inlineData: { mimeType, data: base64 } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    // Build unique model sequence starting with currently configured model
    const requestedModel = this.model();
    const modelsToTry = [
      requestedModel,
      ...this.modelCandidates.filter((m) => m !== requestedModel)
    ];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
      for (let i = 0; i < keys.length; i++) {
        const encodedKey = encodeURIComponent(keys[i]);
        const endpoints = [
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodedKey}`,
          `/gemini/v1beta/models/${currentModel}:generateContent?key=${encodedKey}`
        ];

        for (const url of endpoints) {
          try {
            const resp = await firstValueFrom(this.http.post<GeminiResponse>(url, body));
            if (resp?.error?.message) {
              throw new Error(resp.error.message);
            }
            const text = resp?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
            if (!text.trim()) {
              throw new Error('Gemini returned an empty response.');
            }
            return this.toProcessResponse(this.parseModelJson(text), filename, threshold, currentModel);
          } catch (err) {
            lastError = this.normalizeError(err);
            const status = err instanceof HttpErrorResponse ? err.status : undefined;

            // If key is rate-limited or permission denied, rotate key
            if (this.shouldRotateKey(err, lastError)) {
              if (i < keys.length - 1) {
                break; // Try next key for current model
              }
            }

            // If model is overloaded or unavailable (503/404), advance to next model
            if (this.isModelOverloadedOrNotFound(err, lastError)) {
              break; // Try next model candidate
            }

            if (status && status !== 0 && status !== 503 && status !== 429 && status !== 404) {
              throw lastError;
            }
          }
        }
      }
    }

    throw lastError ?? new Error('Gemini request failed across all key and model failovers.');
  }

  private isModelOverloadedOrNotFound(err: unknown, normalized: Error): boolean {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const msg = normalized.message.toLowerCase();
    return (
      status === 503 ||
      status === 404 ||
      msg.includes('high demand') ||
      msg.includes('unavailable') ||
      msg.includes('no longer available') ||
      msg.includes('not found')
    );
  }

  private shouldRotateKey(err: unknown, normalized: Error): boolean {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const apiStatus =
      err instanceof HttpErrorResponse ? String(err.error?.error?.status || '') : '';
    const message = normalized.message.toLowerCase();
    return (
      status === 429 ||
      status === 403 ||
      status === 503 ||
      apiStatus === 'RESOURCE_EXHAUSTED' ||
      apiStatus === 'PERMISSION_DENIED' ||
      apiStatus === 'UNAVAILABLE' ||
      message.includes('quota') ||
      message.includes('rate') ||
      message.includes('exhausted') ||
      message.includes('high demand') ||
      message.includes('unavailable') ||
      message.includes('api key')
    );
  }

  private buildPrompt(filename: string): string {
    return [
      'You are a multimodal KYC and insurance document vision extractor.',
      `The source filename is "${filename}".`,
      'Inspect the attached image or PDF and return JSON only, matching this exact shape:',
      '{',
      '  "document_type": string,',
      '  "is_handwritten": boolean,',
      '  "is_supported": boolean,',
      '  "unsupported_reason": string,',
      '  "classification_confidence": number,',
      '  "overall_confidence": number,',
      '  "fields": [ { "name": string, "value": string, "confidence": number, "method": string } ]',
      '}',
      'Rules:',
      '- Extract visible identity, policy, bank, date, address, and name fields.',
      '- Set is_handwritten to true if the document is a filled handwriting form (e.g. NACH/ECS mandate, FATCA, questionnaire, consent), false for printed statutory IDs (Aadhaar, PAN, DL, Passport).',
      '- method must be "gemini-vision-handwriting-ocr" for handwritten ink, otherwise "gemini-vision-printed-ocr".',
      '- Handwritten field confidence is typically 0.70-0.92. Printed IDs are typically 0.92-0.99.',
      '- Never invent values. Use an empty string if a field is unreadable.',
      '- Mandatory UIDAI Compliance: If a 12-digit Aadhaar number appears, set its value to "[Aadhaar Redacted]".',
      '- If the file is not a KYC ID or insurance/proposal form, set is_supported to false.',
      '- confidence and overall_confidence must be numbers between 0 and 1.'
    ].join('\n');
  }

  private parseModelJson(text: string): GeminiExtract {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Gemini did not return JSON.');
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as GeminiExtract;
  }

  private toProcessResponse(raw: GeminiExtract, filename: string, threshold: number, activeModel?: string): ProcessDocumentResponse {
    const isHw = raw.is_handwritten === true;
    const docType = raw.document_type || 'Unknown Document';
    const isSupported = raw.is_supported !== false;
    const extractedData: Record<string, FieldExtraction> = {};
    const flaggedFields: FlaggedField[] = [];

    const entries = this.normalizeFields(raw.fields);
    for (const field of entries) {
      const displayName = field.name || 'field';
      const key = this.normalizeKey(displayName);
      let value = field.value ?? '';
      let confidence = this.clampConfidence(field.confidence, isHw ? 0.86 : 0.96);

      if (this.looksLikeAadhaar(displayName, value)) {
        value = '[Aadhaar Redacted]';
        confidence = Math.max(confidence, 0.99);
      }

      const method =
        field.method || (isHw ? 'gemini-vision-handwriting-ocr' : 'gemini-vision-printed-ocr');

      extractedData[key] = {
        value,
        confidence,
        confidence_score: confidence,
        method,
        flagged: confidence < threshold
      };

      if (confidence < threshold) {
        flaggedFields.push({
          document_name: filename,
          document_type: docType,
          field_name: key,
          name: displayName,
          value,
          confidence_score: confidence,
          threshold,
          method,
          reason: `Confidence score (${(confidence * 100).toFixed(0)}%) is below calibrated ${threshold} threshold.`,
          recommended_action: 'Human auditor verification required.'
        });
      }
    }

    const fieldScores = Object.values(extractedData).map((f) => f.confidence_score ?? f.confidence ?? 0);
    const overall =
      raw.overall_confidence ??
      (fieldScores.length ? fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length : 0.9);

    const needsReview = !isSupported || flaggedFields.length > 0;

    return {
      filename,
      classification: docType,
      is_supported: isSupported,
      detected_type: docType,
      unsupported_reason: raw.unsupported_reason,
      json_data: {
        document_filename: filename,
        document_type: docType,
        classification_confidence: this.clampConfidence(raw.classification_confidence, 0.95),
        is_handwritten: isHw,
        overall_confidence: Number(this.clampConfidence(overall, 0.9).toFixed(2)),
        extracted_data: extractedData,
        needs_human_review: needsReview,
        is_supported: isSupported,
        detected_type: docType,
        unsupported_reason: raw.unsupported_reason
      },
      flagging_report: {
        confidence_threshold: threshold,
        threshold_rationale:
          'Calibrated 0.85 threshold balances straight-through processing with handwritten-field review.',
        expected_field_count: entries.length,
        extracted_field_count: Object.keys(extractedData).length,
        missing_fields: [],
        flagged_fields: flaggedFields,
        flagged_count: flaggedFields.length,
        needs_human_review: needsReview,
        is_supported: isSupported,
        detected_type: docType,
        unsupported_reason: raw.unsupported_reason,
        decision_rules: [
          'Rule 1: Field confidence below calibrated threshold (0.85) requires human review.',
          'Rule 2: Statutory UIDAI Aadhaar 12-digit numbers are redacted in the browser to prevent privacy exposure.',
          'Rule 3: Out-of-scope document types trigger an auditor verification alert.'
        ]
      },
      methodology_note: `Extraction executed directly in Angular SPA via Google Gemini (${activeModel || this.model()}). Model key failover and multimodal vision active.`
    };
  }

  private normalizeFields(fields?: GeminiExtract['fields']): GeminiField[] {
    if (!fields) return [];
    if (Array.isArray(fields)) return fields;
    return Object.entries(fields).map(([name, value]) => {
      if (value && typeof value === 'object') {
        return { name, ...(value as GeminiField) };
      }
      return { name, value: value as string | number | null };
    });
  }

  private normalizeKey(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private clampConfidence(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(1, Math.max(0, value));
  }

  private looksLikeAadhaar(name: string, value: string | number | null): boolean {
    if (name.toLowerCase().includes('aadhaar') || name.toLowerCase().includes('aadhar')) {
      return true;
    }
    return /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(String(value ?? ''));
  }

  private guessMime(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error('Could not read the document as base64.'));
      reader.readAsDataURL(blob);
    });
  }

  private readStoredKey(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private normalizeError(err: unknown): Error {
    if (err instanceof HttpErrorResponse) {
      const apiMessage =
        err.error?.error?.message ||
        err.error?.error ||
        err.error?.message ||
        err.message;
      if (err.status === 0) {
        return new Error(
          'The browser could not reach Gemini. Check your network, CORS, and access to generativelanguage.googleapis.com.'
        );
      }
      return new Error(typeof apiMessage === 'string' ? apiMessage : `Gemini HTTP ${err.status}`);
    }
    if (err instanceof Error) return err;
    return new Error(String(err));
  }
}
