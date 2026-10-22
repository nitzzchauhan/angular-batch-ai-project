import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { UploaderComponent } from './components/uploader/uploader.component';
import { ViewerComponent } from './components/viewer/viewer.component';
import { ExtractedFieldsComponent } from './components/extracted-fields/extracted-fields.component';
import { FlaggingReportComponent } from './components/flagging-report/flagging-report.component';
import { JsonViewerComponent } from './components/json-viewer/json-viewer.component';
import { BatchSummaryComponent } from './components/batch-summary/batch-summary.component';
import { MethodologyComponent } from './components/methodology/methodology.component';
import { DocumentVisionService } from './services/document-vision.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    UploaderComponent,
    ViewerComponent,
    ExtractedFieldsComponent,
    FlaggingReportComponent,
    JsonViewerComponent,
    BatchSummaryComponent,
    MethodologyComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(public visionService: DocumentVisionService) {}

  switchTab(tab: 'extracted' | 'flagging' | 'json' | 'methodology' | 'batch'): void {
    this.visionService.activeTab.set(tab);
  }
}
