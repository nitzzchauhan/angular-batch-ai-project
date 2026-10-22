# Task 3: Multimodal Document Vision & HITL Quality Pipeline (Angular SPA)

A modern, standalone **Angular 21 SPA** built parallel to the Django application suite. This frontend provides an enterprise-grade document extraction interface, visual inspection viewer, and interactive Human-in-the-Loop (HITL) audit workspace for multimodal identity proofing and handwritten insurance proposal forms.

---

## 🌟 Key Features

1. **Enterprise Document Inspection Canvas**:
   - Split-screen layout displaying high-resolution scans and PDF pages alongside structured extraction results.
   - Interactive zoom controls (`Zoom In`, `Zoom Out`, `Reset 100%`) and full-screen inspection modal.
   - Dynamic PDF rendering with instant fallback to high-resolution page 1 PNGs and direct raw PDF links.

2. **10+ Document Types (Printed IDs & Handwritten Forms)**:
   - **Printed KYC Proofs**: Aadhaar Card, PAN Card, Driving Licence, Passport.
   - **Handwritten Proposals & Mandates**: NACH/ECS Mandate, FATCA Annexure Form, Benefit Illustration Declaration, Moral Hazard Questionnaire, Multiple Policies Consent Form, Suitability Profiler Declaration.
   - **Multi-page Scanned Policies**: Assignment Request Form, Proposal Form.

3. **Interactive Human-In-The-Loop (HITL) Editor**:
   - Inline field correction: Auditors can edit any extracted value directly in the table.
   - Live state recalculation: Editing a field marks it as `✏️ Auditor Verified & Saved`, upgrades confidence to 100%, and updates the header compliance pill from `Review Required` to `Straight-Through Approved` in real time.

4. **Calibrated 0.85 Confidence Threshold & Flagging Engine**:
   - Interactive threshold slider (0.50 – 0.99) enabling real-time experimentation between Straight-Through Processing (STP) rates and audit workloads.
   - Dedicated **Flagging Report** tab showing all intercepted fields with extracted value, confidence score, threshold, and specific failure reason.
   - Out-of-scope document advisory banner for unsupported files.

5. **Aadhaar PII Redaction Compliance**:
   - Automatically sanitizes 12-digit Aadhaar numbers to `[Aadhaar Redacted]` to prevent statutory UIDAI privacy violations.

6. **Batch Corpus Pipeline**:
   - One-click batch execution across all 10+ reference documents.
   - Summary statistics (Ingested count, Flagged entries count, STP percentage, Failures).
   - Instant document inspection via the "Open" action button.

7. **Structured JSON Deliverable**:
   - Syntax-highlighted Pydantic schema JSON view.
   - One-click `Copy JSON` and `Download .json` export buttons.

8. **Engineering Methodology & Failure Analysis**:
   - In-depth technical note comparing traditional OCR (Tesseract) failures vs Gemini Multimodal Vision Transformer beam search on cursive handwriting and slanted strokes.
   - Concrete analysis of high-value targets (IFSC, TIN, bank account numbers, dates).

9. **Adaptive Theme System**:
   - Seamless Light and Dark mode with glassmorphic cards, custom scrollbars, and high-contrast accessibility (WCAG AA compliant).

---

## 🏗️ Architecture & Integration

```
Assessments-DesiCrew-main/
├── ai_assignment/               # Django Backend Suite (Port 8000)
│   ├── ai_assignment/           # Django settings, CORS middleware, URLs
│   ├── task1_agent/             # Task 1 (Inventory Analyst Agent)
│   ├── task2_support/           # Task 2 (DocAware Support Assistant)
│   └── task3_vision/            # Task 3 Backend (Gemini Multimodal Vision Pipeline)
│       ├── pipeline.py          # Gemini vision transformer, PII redaction, flagging
│       └── views.py             # REST endpoints: /task3/api/process/, /task3/api/pipeline/
│
└── task3-angular/               # Angular 21 Application (Port 4200) - Parallel App
    ├── proxy.conf.json          # Proxies /task3/api/* to Django (http://127.0.0.1:8000)
    ├── public/
    │   ├── ground_truth.json    # Reference ground truth answer key for offline fallback
    │   └── samples/             # 10+ reference KYC and proposal documents
    └── src/
        ├── app/
        │   ├── components/
        │   │   ├── header/          # Sticky glass bar, compliance pill, dark mode
        │   │   ├── uploader/        # Drag & drop upload, sample corpus selector
        │   │   ├── viewer/          # Document canvas, zoom, full-screen dialog
        │   │   ├── extracted-fields/# Editable audit table with score indicators
        │   │   ├── flagging-report/ # HITL gate, 0.85 threshold slider, decision rules
        │   │   ├── json-viewer/     # Formatted JSON output & export
        │   │   ├── batch-summary/   # 10-document batch results table
        │   │   └── methodology/     # Handwriting vs printed OCR documentation
        │   ├── models/              # TypeScript interfaces matching Pydantic schemas
        │   └── services/            # DocumentVisionService (signals, HTTP & fallback)
        └── styles.css               # Design tokens, pills, glassmorphism, tables
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+
- **Python**: 3.10+ (for Django backend)

### Step 1: Run the Django Backend (Terminal 1)
```bash
# In repository root:
source .venv/bin/activate
python ai_assignment/manage.py runserver 8000
```
*The Django server will start on `http://127.0.0.1:8000/`.*

### Step 2: Run the Angular Application (Terminal 2)
```bash
cd task3-angular
npm start
```
*The Angular development server will start on `http://localhost:4200/`.*

Open your browser to **[http://localhost:4200/](http://localhost:4200/)**.

> [!NOTE]
> `task3-angular` is pre-configured with `proxy.conf.json` so all requests to `/task3/api/` are automatically routed to `http://127.0.0.1:8000/`.
> Furthermore, if the Django server is offline, the Angular app automatically engages its **Ground Truth Fallback Mode**, allowing full inspection, audit editing, threshold calibration, and JSON export without crashing.

---

## 🧪 Testing

To run the unit test suite:
```bash
cd task3-angular
npm test
```

To create a production build:
```bash
cd task3-angular
npm run build
```
Build artifacts are output to `dist/task3-angular/browser`.
