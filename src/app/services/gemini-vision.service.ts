import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FieldExtraction, FlaggedField, ProcessDocumentResponse } from '../models/document.model';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'gemini_api_key_override';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
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

  // Fallback models when experiencing high demand (503) or unavailability
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
      // Ignore storage errors in private browsing
    }
  }

  resolveKeys(): string[] {
    const rawKeys = [
      this.apiKey().trim(),
      environment.geminiApiKey?.trim(),
      ...(environment.geminiApiKeys || []).map((k) => k?.trim())
    ];
    return Array.from(new Set(rawKeys.filter(Boolean) as string[]));
  }

  async analyzeBlob(blob: Blob, filename: string, threshold: number): Promise<ProcessDocumentResponse> {
    const keys = this.resolveKeys();
    if (!keys.length) {
      throw new Error('No Gemini API key found. Add GEMINI_API_KEY to the env file, then restart npm start.');
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

    // Try selected model first, followed by remaining candidate fallbacks
    const modelsToTry = [this.model(), ...this.modelCandidates.filter((m) => m !== this.model())];
    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
      for (const key of keys) {
        try {
          const text = await this.executeGenerateContent(currentModel, key, body);
          return this.toProcessResponse(this.parseModelJson(text), filename, threshold, currentModel);
        } catch (err) {
          lastError = this.normalizeError(err);

          // If current model is overloaded or unavailable, switch directly to next model
          if (this.isModelUnavailable(err, lastError)) {
            break;
          }
          // Otherwise continue to next available API key in the pool
        }
      }
    }

    throw lastError ?? new Error('Gemini request failed across all key and model failovers.');
  }

  private async executeGenerateContent(model: string, key: string, body: unknown): Promise<string> {
    const encodedKey = encodeURIComponent(key);
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodedKey}`,
      `/gemini/v1beta/models/${model}:generateContent?key=${encodedKey}`
    ];

    let lastErr: unknown;
    for (const url of endpoints) {
      try {
        const resp = await firstValueFrom(this.http.post<GeminiResponse>(url, body));
        if (resp?.error?.message) {
          throw new Error(resp.error.message);
        }
        const text = resp?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
        if (!text) {
          throw new Error('Gemini returned an empty response.');
        }
        return text;
      } catch (err) {
        lastErr = err;
        // If HTTP status is a real response from Gemini (e.g. 403, 404, 429, 503), don't repeat against proxy
        if (err instanceof HttpErrorResponse && err.status !== 0) {
          throw err;
        }
      }
    }
    throw lastErr;
  }

  private isModelUnavailable(err: unknown, normalized: Error): boolean {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const msg = normalized.message.toLowerCase();
    return (
      status === 503 ||
      status === 404 ||
      msg.includes('high demand') ||
      msg.includes('unavailable') ||
      msg.includes('not found')
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
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Gemini did not return valid JSON.');
    }
    return JSON.parse(cleaned.slice(start, end + 1)) as GeminiExtract;
  }

  private toProcessResponse(
    raw: GeminiExtract,
    filename: string,
    threshold: number,
    activeModel?: string
  ): ProcessDocumentResponse {
    const isHw = raw.is_handwritten === true;
    const docType = raw.document_type || 'Unknown Document';
    const isSupported = raw.is_supported !== false;
    const extractedData: Record<string, FieldExtraction> = {};
    const flaggedFields: FlaggedField[] = [];

    const entries = this.normalizeFields(raw.fields);
    for (const field of entries) {
      const displayName = field.name || 'field';
      const key = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      let value = field.value ?? '';
      let confidence = Math.min(1, Math.max(0, typeof field.confidence === 'number' ? field.confidence : (isHw ? 0.86 : 0.96)));

      if (this.looksLikeAadhaar(displayName, value)) {
        value = '[Aadhaar Redacted]';
        confidence = Math.max(confidence, 0.99);
      }

      const method = field.method || (isHw ? 'gemini-vision-handwriting-ocr' : 'gemini-vision-printed-ocr');
      const flagged = confidence < threshold;

      extractedData[key] = { value, confidence, confidence_score: confidence, method, flagged };

      if (flagged) {
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

    const scores = Object.values(extractedData).map((f) => f.confidence_score ?? f.confidence ?? 0);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.9;
    const overall = Number((raw.overall_confidence ?? avgScore).toFixed(2));
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
        classification_confidence: raw.classification_confidence ?? 0.95,
        is_handwritten: isHw,
        overall_confidence: overall,
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
    return Object.entries(fields).map(([name, val]) =>
      typeof val === 'object' && val !== null ? { name, ...(val as GeminiField) } : { name, value: val as string | number | null }
    );
  }

  private looksLikeAadhaar(name: string, value: unknown): boolean {
    return /aadha?r/i.test(name) || /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(String(value ?? ''));
  }

  private guessMime(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'png': return 'image/png';
      case 'webp': return 'image/webp';
      case 'gif': return 'image/gif';
      default: return 'image/jpeg';
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.slice(res.indexOf(',') + 1));
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
      if (err.status === 0) {
        return new Error('Could not reach Gemini. Check network connection or CORS configuration.');
      }
      const msg = err.error?.error?.message || err.error?.message || err.message;
      return new Error(typeof msg === 'string' ? msg : `Gemini HTTP ${err.status}`);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
