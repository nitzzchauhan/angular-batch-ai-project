import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render document vision header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Document Vision Pipeline');
  });

  it('should switch active tab', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.switchTab('flagging');
    expect(app.visionService.activeTab()).toBe('flagging');
    app.switchTab('json');
    expect(app.visionService.activeTab()).toBe('json');
    app.switchTab('methodology');
    expect(app.visionService.activeTab()).toBe('methodology');
  });
});
