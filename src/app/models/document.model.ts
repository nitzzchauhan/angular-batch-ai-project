export interface FieldExtraction {
  value: string | number | null;
  confidence?: number;
  confidence_score?: number;
  method?: string;
  corrected?: boolean;
  flagged?: boolean;
}

export interface FlaggedField {
  document_name?: string;
  document_type?: string;
  field_name?: string;
  name?: string;
  extracted_value?: string;
  value?: string | number | null;
  confidence_score?: number;
  confidence?: number;
  threshold?: number;
  extraction_method?: string;
  method?: string;
  flagging_reason?: string;
  reason?: string;
  rationale?: string;
  recommended_action?: string;
}

export interface FlaggingReport {
  confidence_threshold: number;
  threshold_rationale?: string;
  expected_field_count?: number;
  extracted_field_count?: number;
  missing_fields?: string[];
  flagged_fields: FlaggedField[];
  flagged_count?: number;
  needs_human_review?: boolean;
  total_documents?: number;
  failed_documents?: number;
  total_flagged_fields?: number;
  decision_rules?: string[];
  is_supported?: boolean;
  detected_type?: string;
  unsupported_reason?: string;
}

export interface ExtractedJsonData {
  document_filename?: string;
  document_type?: string;
  classification_confidence?: number;
  is_handwritten?: boolean;
  overall_confidence?: number;
  extracted_data?: Record<string, FieldExtraction>;
  fields?: Record<string, FieldExtraction | any>;
  needs_human_review?: boolean;
  is_supported?: boolean;
  detected_type?: string;
  unsupported_reason?: string;
}

export interface ProcessDocumentResponse {
  filename?: string;
  classification?: string;
  is_supported?: boolean;
  detected_type?: string;
  unsupported_reason?: string;
  json_data?: ExtractedJsonData;
  flagging_report?: FlaggingReport;
  methodology_note?: string;
  preview_url?: string;
  error?: string;
  details?: string;
}

export interface BatchPipelineResponse {
  documents: Record<string, ProcessDocumentResponse>;
  failures: Array<{ filename: string; error: string }>;
  flagging_report: FlaggingReport;
  methodology_note?: string;
  confidence_threshold: number;
}

export interface SampleFileInfo {
  name: string;
  label: string;
  category: 'id' | 'handwritten' | 'proposal';
  isPdf: boolean;
  previewPath: string;
  description: string;
}
