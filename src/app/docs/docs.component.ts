import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  effect,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

/**
 * STYLES.SCSS ADDITIONS NEEDED:
 *
 * @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
 *
 * APP CONFIG PROVIDERS NEEDED:
 * import { provideHttpClient } from '@angular/common/http';
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideHttpClient(), ...]
 * };
 */

// ============================================================================
// INTERFACES
// ============================================================================

interface DocumentInfo {
  title: string;
  version: string;
  company: string;
  tagline: string;
  totalSections: number;
  lastUpdated: string;
}

interface TableOfContentsEntry {
  id: number;
  title: string;
  page: number;
  module: string;
}

interface Procedure {
  steps: string[];
}

interface ProcedureStep {
  title: string;
  details: string[];
}

interface Field {
  name: string;
  type: string;
  required?: boolean;
}

interface AddingValueStream {
  title: string;
  fields?: Field[];
  steps?: string[];
}

interface Section {
  id: number;
  title: string;
  objective?: string;
  description?: string;
  prerequisites?: string[];
  procedure?: Procedure;
  steps?: ProcedureStep[];
  notes?: string[];
  navigation?: string[];
  accessing?: string | string[];
  viewing?: string | string[];
  fields?: Field[];
  addingValueStream?: AddingValueStream;
  types?: Record<string, any>;
  screenshots?: string[];
  [key: string]: any;
}

interface Module {
  name: string;
  description: string;
  sections: Section[];
}

interface DocsData {
  documentInfo: DocumentInfo;
  tableOfContents: TableOfContentsEntry[];
  modules: Record<string, Module>;
}

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-layout">
      <!-- TOP HEADER BAR -->
      <header class="header-bar">
        <div class="header-content">
          <button class="logo-btn" (click)="navigateToHome()" title="Go to home">
            <span class="logo-text">{{ data()!.documentInfo.title }}</span>
          </button>
          <div class="search-wrapper">
            <input
              type="text"
              class="search-input"
              placeholder="Search docs..."
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event).target.value)"
            />
          </div>
          <div class="version-badge">v{{ data() ? data()!.documentInfo.version : '1.0' }}</div>
        </div>
      </header>

      <div class="main-layout">
        <!-- LEFT SIDEBAR -->
        @if (currentView() === 'section' && data()) {
          <aside class="sidebar-left" [class.collapsed]="sidebarCollapsed()">
            <div class="sidebar-toggle">
              <button (click)="toggleSidebar()" class="toggle-btn" title="Toggle sidebar">
                <span class="chevron">{{ sidebarCollapsed() ? '→' : '←' }}</span>
              </button>
            </div>

            <nav class="sidebar-nav">
              @for (moduleName of getModuleNames(); track moduleName) {
                <div class="module-group">
                  <button
                    class="module-header"
                    (click)="toggleModuleExpanded(moduleName)"
                    [class.expanded]="expandedModules().has(moduleName)"
                  >
                    <span class="module-title">
                      {{ getModule(moduleName)?.name || moduleName }}
                    </span>
                    <span class="module-chevron">
                      {{ expandedModules().has(moduleName) ? '▼' : '▶' }}
                    </span>
                  </button>

                  @if (expandedModules().has(moduleName)) {
                    <div class="sections-list">
                      @for (section of getFilteredSections(moduleName); track section.id) {
                        <button
                          class="section-item"
                          [class.active]="selectedSection()?.id === section.id"
                          (click)="selectSection(section)"
                          [class.hidden]="!isSectionVisible(section)"
                        >
                          {{ section.title }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </nav>
          </aside>
        }

        <!-- MAIN CONTENT AREA -->
        <main class="main-content" #mainContent>
          <!-- HOME VIEW -->
          @if (currentView() === 'home' && data()) {
            <div class="content-home">
              <section class="hero">
                <h1>{{ data()!.documentInfo.title }}</h1>
                <p class="tagline">{{ data()!.documentInfo.tagline }}</p>
              </section>

              <section class="stats">
                <div class="stat-card">
                  <div class="stat-number">{{ getTotalSections() }}</div>
                  <div class="stat-label">Sections</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ getModuleNames().length }}</div>
                  <div class="stat-label">Modules</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ getTotalScreenshots() }}+</div>
                  <div class="stat-label">Screenshots</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">{{ data()!.documentInfo.lastUpdated }}</div>
                  <div class="stat-label">Updated</div>
                </div>
              </section>

              <section class="modules-grid">
                <h2>Documentation Modules</h2>
                <div class="grid">
                  @for (moduleName of getModuleNames(); track moduleName) {
                    <div class="module-card" (click)="selectModuleFirstSection(moduleName)">
                      <h3>{{ getModule(moduleName)?.name }}</h3>
                      <p>{{ getModule(moduleName)?.description }}</p>
                      <div class="card-footer">
                        {{ getModule(moduleName)?.sections?.length || 0 }} sections
                      </div>
                    </div>
                  }
                </div>
              </section>
            </div>
          }

          <!-- SECTION VIEW -->
          @if (currentView() === 'section' && selectedSection() && data()) {
            <div class="content-section">
              <!-- BREADCRUMB -->
              <nav class="breadcrumb">
                <button (click)="navigateToHome()">Home</button>
                <span> / </span>
                <span>{{ getCurrentModuleName() }}</span>
                <span> / </span>
                <span class="current">{{ selectedSection()!.title }}</span>
              </nav>

              <!-- SECTION TITLE -->
              <header class="section-header">
                <h1>{{ selectedSection()!.title }}</h1>
              </header>

              <!-- OBJECTIVE -->
              @if (selectedSection()!.objective) {
                <section class="objective-box">
                  <div class="objective-icon">📋</div>
                  <div>
                    <strong>Objective</strong>
                    <p>{{ selectedSection()!.objective }}</p>
                  </div>
                </section>
              }

              <!-- DESCRIPTION -->
              @if (selectedSection()!.description) {
                <section class="description-block">
                  <p [innerText]="selectedSection()!.description"></p>
                </section>
              }

              <!-- PREREQUISITES -->
              @if (
                selectedSection()!.prerequisites && selectedSection()!.prerequisites!.length > 0
              ) {
                <section class="content-block">
                  <h2>Prerequisites</h2>
                  <ul class="bullet-list">
                    @for (item of selectedSection()!.prerequisites; track $index) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                </section>
              }

              <!-- NAVIGATION -->
              @if (selectedSection()!.navigation && selectedSection()!.navigation!.length > 0) {
                <section class="content-block">
                  <h2>Navigation Steps</h2>
                  <ol class="numbered-list">
                    @for (step of selectedSection()!.navigation; let i = $index; track i) {
                      <li>
                        <span class="step-number">{{ i + 1 }}</span>
                        <span>{{ step }}</span>
                      </li>
                    }
                  </ol>
                </section>
              }

              <!-- VIEWING / ACCESSING -->
              @if (selectedSection()!.viewing || selectedSection()!.accessing) {
                <div class="two-col-grid">
                  @if (selectedSection()!.viewing) {
                    <section class="info-card">
                      <h3>How to View</h3>
                      @if (typeof selectedSection()!.viewing === 'string') {
                        <p>{{ selectedSection()!.viewing }}</p>
                      } @else {
                        <ul class="bullet-list">
                          @for (
                            item of getAsStringArray(selectedSection()!.viewing);
                            track $index
                          ) {
                            <li>{{ item }}</li>
                          }
                        </ul>
                      }
                    </section>
                  }

                  @if (selectedSection()!.accessing) {
                    <section class="info-card">
                      <h3>How to Access</h3>
                      @if (typeof selectedSection()!.accessing === 'string') {
                        <p>{{ selectedSection()!.accessing }}</p>
                      } @else {
                        <ul class="bullet-list">
                          @for (
                            item of getAsStringArray(selectedSection()!.accessing);
                            track $index
                          ) {
                            <li>{{ item }}</li>
                          }
                        </ul>
                      }
                    </section>
                  }
                </div>
              }

              <!-- PROCEDURE STEPS (Traditional) -->
              @if (
                selectedSection()!.procedure?.steps &&
                selectedSection()!.procedure!.steps!.length > 0
              ) {
                <section class="content-block">
                  <h2>Procedure</h2>
                  <ol class="step-list">
                    @for (step of selectedSection()!.procedure!.steps; let i = $index; track i) {
                      <li>
                        <span class="step-badge">{{ i + 1 }}</span>
                        <span>{{ step }}</span>
                      </li>
                    }
                  </ol>
                </section>
              }

              <!-- DETAILED STEPS -->
              @if (selectedSection()!.steps && selectedSection()!.steps!.length > 0) {
                <section class="content-block">
                  @for (stepGroup of selectedSection()!.steps; let i = $index; track i) {
                    <div class="step-group">
                      <h3>
                        <span class="step-badge">{{ i + 1 }}</span>
                        {{ stepGroup.title }}
                      </h3>
                      <ol class="sub-steps">
                        @for (detail of stepGroup.details; let j = $index; track j) {
                          <li>{{ detail }}</li>
                        }
                      </ol>
                    </div>
                  }
                </section>
              }

              <!-- FIELDS TABLE -->
              @if (selectedSection()!.fields && selectedSection()!.fields!.length > 0) {
                <section class="content-block">
                  <h2>Fields</h2>
                  <table class="fields-table">
                    <thead>
                      <tr>
                        <th>Field Name</th>
                        <th>Type</th>
                        <th>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (field of selectedSection()!.fields; track field.name) {
                        <tr>
                          <td class="field-name">
                            <code>{{ field.name }}</code>
                          </td>
                          <td>
                            <code>{{ field.type }}</code>
                          </td>
                          <td>{{ field.required ? 'Yes' : 'No' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
              }

              <!-- ADDING VALUE STREAM -->
              @if (selectedSection()!.addingValueStream) {
                <section class="content-block value-stream-block">
                  <h2>{{ selectedSection()!.addingValueStream!.title }}</h2>

                  @if (
                    selectedSection()!.addingValueStream!.fields &&
                    selectedSection()!.addingValueStream!.fields!.length > 0
                  ) {
                    <div class="subsection">
                      <h3>Fields</h3>
                      <table class="fields-table">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Type</th>
                            <th>Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (
                            field of selectedSection()!.addingValueStream!.fields;
                            track field.name
                          ) {
                            <tr>
                              <td>
                                <code>{{ field.name }}</code>
                              </td>
                              <td>
                                <code>{{ field.type }}</code>
                              </td>
                              <td>{{ field.required ? 'Yes' : 'No' }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }

                  @if (
                    selectedSection()!.addingValueStream!.steps &&
                    selectedSection()!.addingValueStream!.steps!.length > 0
                  ) {
                    <div class="subsection">
                      <h3>Steps</h3>
                      <ol class="step-list">
                        @for (
                          step of selectedSection()!.addingValueStream!.steps;
                          let i = $index;
                          track i
                        ) {
                          <li>
                            <span class="step-badge">{{ i + 1 }}</span>
                            <span>{{ step }}</span>
                          </li>
                        }
                      </ol>
                    </div>
                  }
                </section>
              }

              <!-- TYPES/CATEGORIES (Expandable) -->
              @if (selectedSection()!.types && getObjectKeys(selectedSection()!.types).length > 0) {
                <section class="content-block">
                  <h2>Types & Categories</h2>
                  <div class="accordion">
                    @for (key of getObjectKeys(selectedSection()!.types); track key) {
                      <details class="accordion-item">
                        <summary>
                          <span class="accordion-title">{{ key }}</span>
                          <span class="accordion-icon">▼</span>
                        </summary>
                        <div class="accordion-content">
                          <pre class="json-display">{{
                            selectedSection()!.types![key] | json
                          }}</pre>
                        </div>
                      </details>
                    }
                  </div>
                </section>
              }

              <!-- NOTES -->
              @if (selectedSection()!.notes && selectedSection()!.notes!.length > 0) {
                <section class="content-block notes-block">
                  <h2>Important Notes</h2>
                  <ul class="note-list">
                    @for (note of selectedSection()!.notes; track $index) {
                      <li>
                        <span class="note-icon">i</span>
                        <span>{{ note }}</span>
                      </li>
                    }
                  </ul>
                </section>
              }

              <!-- SCREENSHOTS -->
              @if (selectedSection()!.screenshots && selectedSection()!.screenshots!.length > 0) {
                <section class="content-block screenshots-block">
                  <h2>Screenshots</h2>
                  <div class="screenshots-grid">
                    @for (screenshot of selectedSection()!.screenshots; let i = $index; track i) {
                      <div class="screenshot-card" (click)="openImageViewer(screenshot)">
                        <img
                          [src]="'/assets/images/screenshots/' + screenshot"
                          [alt]="screenshot"
                          class="screenshot-img"
                          (error)="onImageError($event, screenshot)"
                        />
                        <div class="screenshot-filename">
                          <code>{{ screenshot }}</code>
                        </div>
                      </div>
                    }
                  </div>
                </section>
              }

              <!-- NAVIGATION CONTROLS -->
              <div class="section-nav">
                <button
                  class="nav-btn prev-btn"
                  (click)="previousSection()"
                  [disabled]="!canNavigatePrevious()"
                >
                  ← Previous
                </button>
                <span class="nav-counter">
                  {{ selectedSection()!.id }} / {{ getTotalSections() }}
                </span>
                <button
                  class="nav-btn next-btn"
                  (click)="nextSection()"
                  [disabled]="!canNavigateNext()"
                >
                  Next →
                </button>
              </div>
            </div>
          }
        </main>

        <!-- RIGHT TOC PANEL -->
        @if (currentView() === 'section' && selectedSection()) {
          <aside class="toc-panel">
            <h3>On this page</h3>
            <nav class="toc-nav">
              @if (selectedSection()!.objective) {
                <a href="#toc-objective" class="toc-link">Objective</a>
              }
              @if (selectedSection()!.description) {
                <a href="#toc-description" class="toc-link">Description</a>
              }
              @if (
                selectedSection()!.prerequisites && selectedSection()!.prerequisites!.length > 0
              ) {
                <a href="#toc-prerequisites" class="toc-link">Prerequisites</a>
              }
              @if (selectedSection()!.navigation && selectedSection()!.navigation!.length > 0) {
                <a href="#toc-navigation" class="toc-link">Navigation</a>
              }
              @if (selectedSection()!.procedure?.steps || selectedSection()!.steps) {
                <a href="#toc-procedure" class="toc-link">Procedure</a>
              }
              @if (selectedSection()!.viewing || selectedSection()!.accessing) {
                <a href="#toc-info" class="toc-link">How to View/Access</a>
              }
              @if (selectedSection()!.addingValueStream) {
                <a href="#toc-valuestream" class="toc-link">
                  {{ selectedSection()!.addingValueStream!.title }}
                </a>
              }
              @if (selectedSection()!.types) {
                <a href="#toc-types" class="toc-link">Types</a>
              }
              @if (selectedSection()!.notes && selectedSection()!.notes!.length > 0) {
                <a href="#toc-notes" class="toc-link">Notes</a>
              }
              @if (selectedSection()!.screenshots && selectedSection()!.screenshots!.length > 0) {
                <a href="#toc-screenshots" class="toc-link">Screenshots</a>
              }
            </nav>
          </aside>
        }
      </div>
    </div>

    <!-- IMAGE VIEWER MODAL -->
    @if (imageViewerOpen()) {
      <div class="image-viewer-overlay" (click)="closeImageViewer()">
        <div class="image-viewer-modal" (click)="$event.stopPropagation()">
          <div class="viewer-header">
            <h3>Image Viewer</h3>
            <div class="viewer-zoom-controls">
              <button
                class="zoom-btn"
                (click)="zoomOut()"
                [disabled]="imageZoom() <= 1"
                title="Zoom Out (-)"
              >
                −
              </button>
              <span class="zoom-level">{{ (imageZoom() * 100).toFixed(0) }}%</span>
              <button
                class="zoom-btn"
                (click)="zoomIn()"
                [disabled]="imageZoom() >= 5"
                title="Zoom In (+)"
              >
                +
              </button>
              <button class="zoom-reset-btn" (click)="resetZoom()" title="Reset Zoom">Reset</button>
            </div>
            <button class="close-btn" (click)="closeImageViewer()" title="Close">✕</button>
          </div>

          <div class="viewer-body" (wheel)="onImageWheel($event)">
            <div class="viewer-image-container" [style.transform]="'scale(' + imageZoom() + ')'">
              <img
                [src]="'/assets/images/screenshots/' + currentImageName()"
                [alt]="currentImageName()"
                class="viewer-image"
                (error)="onImageError($event, currentImageName())"
              />
            </div>
          </div>

          <div class="viewer-footer">
            <button
              class="viewer-btn"
              (click)="previousImage()"
              [disabled]="currentImageIndex() === 0"
            >
              ← Previous
            </button>
            <span class="viewer-counter">
              {{ currentImageIndex() + 1 }} /
              {{ selectedSection()?.screenshots?.length || 0 }}
            </span>
            <button
              class="viewer-btn"
              (click)="nextImage()"
              [disabled]="currentImageIndex() + 1 >= (selectedSection()?.screenshots?.length || 0)"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    }
  `,

  styles: [
    `
      :host {
        --color-bg-primary: #ffffff;
        --color-bg-secondary: #f8f9fa;
        --color-bg-dark: #161d26;
        --color-text-primary: #1a202c;
        --color-text-secondary: #5f6b7a;
        --color-border: #d5dbdb;
        --color-blue: #0972d3;
        --color-blue-light: #e8f0f9;
        --color-green: #1d8102;
        font-family:
          'IBM Plex Sans',
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      .docs-layout {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: var(--color-bg-primary);
      }

      /* HEADER BAR */
      .header-bar {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--color-bg-primary);
        border-bottom: 1px solid var(--color-border);
        height: 56px;
        display: flex;
        align-items: center;
        padding: 0 24px;
      }

      .header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 24px;
      }

      .logo-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--color-text-primary);
        transition: color 0.2s;
      }

      .logo-btn:hover {
        color: var(--color-blue);
      }

      .logo-text {
        display: block;
        max-width: 280px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .search-wrapper {
        flex: 1;
        max-width: 400px;
      }

      .search-input {
        width: 100%;
        padding: 6px 14px;
        border: 1px solid var(--color-border);
        border-radius: 20px;
        font-size: 13px;
        font-family: 'IBM Plex Sans', sans-serif;
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
        transition: all 0.2s;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-blue);
        background: var(--color-bg-primary);
        box-shadow: 0 0 0 2px rgba(9, 114, 211, 0.1);
      }

      .version-badge {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        color: var(--color-text-secondary);
        background: var(--color-bg-secondary);
        padding: 4px 10px;
        border-radius: 12px;
        white-space: nowrap;
      }

      /* MAIN LAYOUT */
      .main-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      /* LEFT SIDEBAR */
      .sidebar-left {
        width: 260px;
        background: var(--color-bg-dark);
        color: #e5e7eb;
        border-right: 1px solid #1f2937;
        overflow-y: auto;
        overflow-x: hidden;
        transition: width 0.3s ease;
        flex-shrink: 0;
      }

      .sidebar-left.collapsed {
        width: 60px;
      }

      .sidebar-toggle {
        padding: 16px;
        border-bottom: 1px solid #1f2937;
      }

      .toggle-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 16px;
        padding: 4px 8px;
        transition: color 0.2s;
      }

      .toggle-btn:hover {
        color: #d1d5db;
      }

      .sidebar-nav {
        padding: 8px 0;
      }

      .module-group {
        border-bottom: 1px solid #1f2937;
      }

      .module-header {
        width: 100%;
        padding: 12px 16px;
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        transition: all 0.2s;
      }

      .module-header:hover {
        background: #1f2937;
        color: #d1d5db;
      }

      .module-header.expanded {
        color: #d1d5db;
      }

      .module-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .module-chevron {
        font-size: 10px;
        flex-shrink: 0;
      }

      .sections-list {
        max-height: 400px;
        overflow-y: auto;
      }

      .section-item {
        display: block;
        width: 100%;
        padding: 8px 16px 8px 32px;
        background: none;
        border: none;
        border-left: 3px solid transparent;
        color: #9ca3af;
        text-align: left;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .section-item:hover {
        background: #1f2937;
        color: #d1d5db;
      }

      .section-item.active {
        border-left-color: var(--color-blue);
        background: #1a2737;
        color: #fff;
      }

      .section-item.hidden {
        display: none;
      }

      /* MAIN CONTENT */
      .main-content {
        flex: 1;
        overflow-y: auto;
        background: var(--color-bg-primary);
      }

      .content-home,
      .content-section {
        padding: 40px 48px;
        max-width: 860px;
        margin: 0 auto;
      }

      /* HOME VIEW */
      .hero {
        margin-bottom: 48px;
      }

      .hero h1 {
        font-size: 28px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 12px 0;
      }

      .tagline {
        font-size: 16px;
        color: var(--color-text-secondary);
        margin: 0;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 48px;
      }

      .stat-card {
        background: var(--color-bg-secondary);
        padding: 24px;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        text-align: center;
      }

      .stat-number {
        font-size: 24px;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .stat-label {
        font-size: 12px;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: 8px;
      }

      .modules-grid h2 {
        font-size: 20px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 24px 0;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .module-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.3s;
      }

      .module-card:hover {
        border-color: var(--color-blue);
        background: var(--color-blue-light);
        box-shadow: 0 2px 8px rgba(9, 114, 211, 0.1);
      }

      .module-card h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 8px 0;
      }

      .module-card p {
        font-size: 14px;
        color: var(--color-text-secondary);
        margin: 0 0 12px 0;
        line-height: 1.6;
      }

      .card-footer {
        font-size: 12px;
        color: var(--color-text-secondary);
        font-weight: 500;
      }

      /* SECTION VIEW */
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 24px;
        font-size: 13px;
        color: var(--color-text-secondary);
      }

      .breadcrumb button {
        background: none;
        border: none;
        color: var(--color-blue);
        cursor: pointer;
        padding: 0;
        font-family: inherit;
        font-size: inherit;
        transition: color 0.2s;
      }

      .breadcrumb button:hover {
        color: #0559a8;
      }

      .breadcrumb .current {
        color: var(--color-text-primary);
        font-weight: 500;
      }

      .section-header {
        margin-bottom: 32px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--color-border);
      }

      .section-header h1 {
        font-size: 28px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
      }

      /* OBJECTIVE BOX */
      .objective-box {
        display: flex;
        gap: 16px;
        background: var(--color-blue-light);
        border-left: 4px solid var(--color-blue);
        padding: 16px;
        border-radius: 6px;
        margin-bottom: 32px;
        font-size: 14px;
        line-height: 1.6;
      }

      .objective-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .objective-box strong {
        display: block;
        color: var(--color-text-primary);
        margin-bottom: 4px;
      }

      .objective-box p {
        margin: 0;
        color: var(--color-text-secondary);
      }

      /* CONTENT BLOCKS */
      .content-block {
        margin-bottom: 32px;
      }

      .content-block h2 {
        font-size: 20px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 16px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .content-block h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .description-block p {
        color: var(--color-text-secondary);
        line-height: 1.7;
        margin: 0;
        font-size: 14px;
      }

      /* LISTS */
      .bullet-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .bullet-list li {
        color: var(--color-text-secondary);
        margin-bottom: 8px;
        padding-left: 24px;
        position: relative;
        font-size: 14px;
        line-height: 1.6;
      }

      .bullet-list li:before {
        content: '•';
        position: absolute;
        left: 0;
        color: var(--color-blue);
        font-weight: bold;
      }

      .numbered-list {
        list-style: none;
        padding: 0;
        margin: 0;
        counter-reset: step-counter;
      }

      .numbered-list li {
        color: var(--color-text-secondary);
        margin-bottom: 12px;
        padding-left: 32px;
        position: relative;
        font-size: 14px;
        line-height: 1.6;
        counter-increment: step-counter;
      }

      .numbered-list li:before {
        content: counter(step-counter);
        position: absolute;
        left: 0;
        width: 24px;
        height: 24px;
        background: var(--color-blue);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
      }

      .step-number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: var(--color-blue);
        color: white;
        border-radius: 50%;
        font-size: 12px;
        font-weight: 600;
        margin-right: 12px;
        flex-shrink: 0;
      }

      .step-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .step-list li {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        padding: 12px;
        background: var(--color-bg-secondary);
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.6;
        color: var(--color-text-secondary);
      }

      .step-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        min-width: 32px;
        background: var(--color-blue);
        color: white;
        border-radius: 50%;
        font-size: 13px;
        font-weight: 600;
      }

      .step-group {
        margin-bottom: 24px;
      }

      .step-group h3 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .sub-steps {
        list-style: decimal;
        padding-left: 24px;
        margin: 12px 0;
      }

      .sub-steps li {
        color: var(--color-text-secondary);
        margin-bottom: 8px;
        font-size: 14px;
        line-height: 1.6;
      }

      /* TWO COLUMN GRID */
      .two-col-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
        margin-bottom: 32px;
      }

      .info-card {
        background: var(--color-bg-secondary);
        padding: 20px;
        border-radius: 8px;
        border: 1px solid var(--color-border);
      }

      .info-card h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 12px 0;
      }

      .info-card p {
        color: var(--color-text-secondary);
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
      }

      /* FIELDS TABLE */
      .fields-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin-bottom: 12px;
      }

      .fields-table thead {
        background: var(--color-bg-secondary);
        border-bottom: 2px solid var(--color-border);
      }

      .fields-table th {
        padding: 12px;
        text-align: left;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .fields-table td {
        padding: 12px;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }

      .fields-table tbody tr:hover {
        background: var(--color-bg-secondary);
      }

      .field-name code {
        background: var(--color-bg-secondary);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
      }

      code {
        font-family: 'IBM Plex Mono', monospace;
        color: #d46a6a;
        background: #f5e6e6;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 13px;
      }

      /* VALUE STREAM BLOCK */
      .value-stream-block {
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-left: 4px solid var(--color-green);
        padding: 20px;
        border-radius: 8px;
      }

      .value-stream-block h2 {
        border-bottom-color: #86efac;
        color: var(--color-green);
      }

      .subsection {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #d1e7d6;
      }

      .subsection h3 {
        color: var(--color-text-primary);
        font-size: 15px;
      }

      /* ACCORDION */
      .accordion {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .accordion-item {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .accordion-item summary {
        padding: 16px;
        cursor: pointer;
        background: var(--color-bg-secondary);
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
        transition: background 0.2s;
        font-weight: 500;
      }

      .accordion-item summary:hover {
        background: #e8eef5;
      }

      .accordion-item[open] summary {
        background: var(--color-blue-light);
        border-bottom: 1px solid var(--color-border);
      }

      .accordion-title {
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .accordion-icon {
        font-size: 12px;
        color: var(--color-text-secondary);
        transition: transform 0.2s;
      }

      .accordion-item[open] .accordion-icon {
        transform: rotate(180deg);
      }

      .accordion-content {
        padding: 16px;
        background: #fafbfc;
        color: var(--color-text-secondary);
        font-size: 13px;
        line-height: 1.6;
        overflow-x: auto;
      }

      .json-display {
        background: var(--color-bg-dark);
        color: #e5e7eb;
        padding: 12px;
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        overflow-x: auto;
        margin: 0;
        line-height: 1.4;
      }

      .accordion-item[open] summary {
        background: var(--color-blue-light);
        border-bottom: 1px solid var(--color-border);
      }

      .accordion-title {
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .accordion-icon {
        font-size: 12px;
        color: var(--color-text-secondary);
        transition: transform 0.2s;
      }

      .accordion-item[open] .accordion-icon {
        transform: rotate(180deg);
      }

      .accordion-content {
        padding: 16px;
        background: var(--color-bg-primary);
        border-top: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        font-size: 13px;
        font-family: 'IBM Plex Mono', monospace;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* NOTES */
      .notes-block {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-left: 4px solid #f59e0b;
      }

      .notes-block h2 {
        border-bottom-color: #fcd34d;
        color: #92400e;
      }

      .note-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .note-list li {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        color: var(--color-text-secondary);
        font-size: 14px;
        line-height: 1.6;
      }

      .note-icon {
        flex-shrink: 0;
        font-size: 16px;
        width: 24px;
        height: 24px;
        background: #f59e0b;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      }

      /* SCREENSHOTS */
      .screenshots-block {
        margin-bottom: 40px;
      }

      .screenshots-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .screenshot-card {
        border: 1px solid var(--color-border);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s;
        background: var(--color-bg-secondary);
      }

      .screenshot-card:hover {
        border-color: var(--color-blue);
        box-shadow: 0 4px 12px rgba(9, 114, 211, 0.1);
      }

      .screenshot-img {
        width: 100%;
        height: auto;
        display: block;
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }

      .screenshot-filename {
        padding: 12px;
        font-size: 12px;
        color: var(--color-text-secondary);
        font-family: 'IBM Plex Mono', monospace;
        border-top: 1px solid var(--color-border);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* SECTION NAVIGATION */
      .section-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        margin-top: 48px;
        padding-top: 24px;
        border-top: 2px solid var(--color-border);
      }

      .nav-btn {
        padding: 10px 20px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
      }

      .nav-btn:hover:not(:disabled) {
        border-color: var(--color-blue);
        background: var(--color-blue-light);
      }

      .nav-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nav-btn.next-btn:not(:disabled) {
        background: var(--color-blue);
        color: white;
        border-color: var(--color-blue);
      }

      .nav-btn.next-btn:not(:disabled):hover {
        background: #0559a8;
      }

      .nav-counter {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px;
        color: var(--color-text-secondary);
      }

      /* TOC PANEL */
      .toc-panel {
        width: 220px;
        background: var(--color-bg-secondary);
        border-left: 1px solid var(--color-border);
        padding: 24px 16px;
        overflow-y: auto;
        flex-shrink: 0;
        position: sticky;
        top: 56px;
        height: calc(100vh - 56px);
      }

      .toc-panel h3 {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        margin: 0 0 12px 0;
      }

      .toc-nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .toc-link {
        padding: 6px 8px;
        font-size: 13px;
        color: var(--color-text-secondary);
        text-decoration: none;
        border-radius: 4px;
        transition: all 0.2s;
        display: block;
        line-height: 1.5;
      }

      .toc-link:hover {
        color: var(--color-blue);
        background: var(--color-bg-primary);
      }

      /* IMAGE VIEWER MODAL */
      .image-viewer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .image-viewer-modal {
        background: var(--color-bg-dark);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-width: 90vw;
        max-height: 90vh;
        width: 100%;
        height: 100%;
      }

      .viewer-header {
        background: #0f1419;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #1f2937;
        gap: 16px;
      }

      .viewer-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #e5e7eb;
        flex: 1;
      }

      .viewer-zoom-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
        border-right: 1px solid #1f2937;
        border-left: 1px solid #1f2937;
      }

      .zoom-btn {
        background: #1f2937;
        border: 1px solid #374151;
        color: #9ca3af;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }

      .zoom-btn:hover:not(:disabled) {
        background: #374151;
        color: #e5e7eb;
      }

      .zoom-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .zoom-level {
        color: #9ca3af;
        font-size: 12px;
        font-weight: 500;
        min-width: 45px;
        text-align: center;
      }

      .zoom-reset-btn {
        background: #1f2937;
        border: 1px solid #374151;
        color: #9ca3af;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
        font-weight: 500;
      }

      .zoom-reset-btn:hover {
        background: #374151;
        color: #e5e7eb;
      }

      .close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        transition: color 0.2s;
      }

      .close-btn:hover {
        color: #f3f4f6;
      }

      .viewer-body {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        background: #000;
        cursor: zoom-in;
      }

      .viewer-body:hover {
        cursor: zoom-in;
      }

      .viewer-image-container {
        transform-origin: center;
        transition: transform 0.2s ease-in-out;
      }

      .viewer-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
      }

      .viewer-footer {
        background: #0f1419;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        border-top: 1px solid #1f2937;
      }

      .viewer-btn {
        padding: 8px 16px;
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 6px;
        color: #f3f4f6;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .viewer-btn:hover:not(:disabled) {
        background: #374151;
      }

      .viewer-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .viewer-counter {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        color: #9ca3af;
      }

      /* SCROLLBAR STYLING */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: #cbd5e0;
        border-radius: 4px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #a0aec0;
      }

      /* RESPONSIVE */
      @media (max-width: 768px) {
        .stats {
          grid-template-columns: repeat(2, 1fr);
        }

        .grid {
          grid-template-columns: 1fr;
        }

        .two-col-grid {
          grid-template-columns: 1fr;
        }

        .toc-panel {
          display: none;
        }

        .sidebar-left {
          position: absolute;
          height: calc(100vh - 56px);
          z-index: 99;
        }

        .section-nav {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class DocsComponent implements OnInit {
  private http = inject(HttpClient);

  // ========================================================================
  // SIGNALS
  // ========================================================================

  data = signal<DocsData | null>(null);
  currentView = signal<'home' | 'section'>('home');
  selectedSection = signal<Section | null>(null);
  searchQuery = signal('');
  sidebarCollapsed = signal(false);
  expandedModules = signal<Set<string>>(new Set());
  imageViewerOpen = signal(false);
  currentImageName = signal('');
  currentImageIndex = signal(0);
  imageZoom = signal(1);

  @ViewChild('mainContent') mainContentRef?: ElementRef;

  ngOnInit(): void {
    this.loadDocs();
  }

  // ========================================================================
  // LOADING
  // ========================================================================

  loadDocs(): void {
    this.http.get<DocsData>('/assets/data/myidex-hub-sop-complete.json').subscribe({
      next: (data) => this.data.set(data),
      error: (err) => console.error('Failed to load docs:', err),
    });
  }

  // ========================================================================
  // NAVIGATION
  // ========================================================================

  getModuleNames(): string[] {
    return Object.keys(this.data()?.modules || {}).sort();
  }

  getModule(key: string): Module | undefined {
    return this.data()?.modules[key];
  }

  getModuleList() {
    return this.getModuleNames().map((key) => ({
      key,
      module: this.getModule(key),
    }));
  }

  navigateToHome(): void {
    this.currentView.set('home');
    this.selectedSection.set(null);
    this.expandedModules.set(new Set());
  }

  selectSection(section: Section): void {
    this.selectedSection.set(section);
    this.currentView.set('section');
    this.mainContentRef?.nativeElement?.scrollTo(0, 0);
  }

  selectModuleFirstSection(moduleName: string): void {
    const module = this.getModule(moduleName);
    if (module && module.sections.length > 0) {
      this.expandedModules.update((m) => new Set(m).add(moduleName));
      this.selectSection(module.sections[0]);
    }
  }

  nextSection(): void {
    const allSections = this.getAllSections();
    const current = this.selectedSection()?.id;
    if (current !== undefined) {
      const next = allSections.find((s) => s.id === current + 1);
      if (next) this.selectSection(next);
    }
  }

  previousSection(): void {
    const allSections = this.getAllSections();
    const current = this.selectedSection()?.id;
    if (current !== undefined && current > 1) {
      const prev = allSections.find((s) => s.id === current - 1);
      if (prev) this.selectSection(prev);
    }
  }

  canNavigateNext(): boolean {
    const total = this.getTotalSections();
    const current = this.selectedSection()?.id;
    return current !== undefined && current < total;
  }

  canNavigatePrevious(): boolean {
    const current = this.selectedSection()?.id;
    return current !== undefined && current > 1;
  }

  getAllSections(): Section[] {
    const sections: Section[] = [];
    Object.values(this.data()?.modules || {}).forEach((mod) => {
      sections.push(...mod.sections);
    });
    return sections.sort((a, b) => a.id - b.id);
  }

  // ========================================================================
  // SIDEBAR
  // ========================================================================

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleModuleExpanded(moduleName: string): void {
    this.expandedModules.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  }

  getFilteredSections(moduleName: string): Section[] {
    const module = this.getModule(moduleName);
    if (!module) return [];
    const query = this.searchQuery().toLowerCase();
    if (!query) return module.sections;
    return module.sections.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.objective?.toLowerCase().includes(query),
    );
  }

  isSectionVisible(section: Section): boolean {
    const query = this.searchQuery().toLowerCase();
    if (!query) return true;
    return (
      section.title.toLowerCase().includes(query) ||
      (section.description?.toLowerCase().includes(query) ?? false) ||
      (section.objective?.toLowerCase().includes(query) ?? false)
    );
  }

  // ========================================================================
  // IMAGE VIEWER & ZOOM
  // ========================================================================

  openImageViewer(screenshot: string): void {
    this.currentImageName.set(screenshot);
    const screenshots = this.selectedSection()?.screenshots || [];
    this.currentImageIndex.set(screenshots.indexOf(screenshot));
    this.imageViewerOpen.set(true);
    this.imageZoom.set(1);
  }

  closeImageViewer(): void {
    this.imageViewerOpen.set(false);
    this.imageZoom.set(1);
  }

  zoomIn(): void {
    this.imageZoom.update((z) => Math.min(z + 0.2, 5));
  }

  zoomOut(): void {
    this.imageZoom.update((z) => Math.max(z - 0.2, 1));
  }

  resetZoom(): void {
    this.imageZoom.set(1);
  }

  onImageWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  nextImage(): void {
    const screenshots = this.selectedSection()?.screenshots || [];
    const idx = this.currentImageIndex();
    if (idx < screenshots.length - 1) {
      this.currentImageIndex.set(idx + 1);
      this.currentImageName.set(screenshots[idx + 1]);
      this.imageZoom.set(1);
    }
  }

  previousImage(): void {
    const screenshots = this.selectedSection()?.screenshots || [];
    const idx = this.currentImageIndex();
    if (idx > 0) {
      this.currentImageIndex.set(idx - 1);
      this.currentImageName.set(screenshots[idx - 1]);
      this.imageZoom.set(1);
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  getCurrentModuleName(): string {
    const selected = this.selectedSection();
    if (!selected) return '';
    for (const [key, mod] of Object.entries(this.data()?.modules || {})) {
      if (mod.sections.some((s) => s.id === selected.id)) {
        return mod.name;
      }
    }
    return '';
  }

  getTotalSections(): number {
    let count = 0;
    Object.values(this.data()?.modules || {}).forEach((mod) => {
      count += mod.sections.length;
    });
    return count;
  }

  getTotalScreenshots(): number {
    let count = 0;
    Object.values(this.data()?.modules || {}).forEach((mod) => {
      mod.sections.forEach((sec) => {
        count += sec.screenshots?.length || 0;
      });
    });
    return count;
  }

  getObjectKeys(obj: Record<string, any> | undefined): string[] {
    return Object.keys(obj || {});
  }

  getAsStringArray(value: string | string[] | undefined): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  }

  onImageError(event: any, filename: string): void {
    console.warn(`Failed to load image: ${filename}`);
  }
}
