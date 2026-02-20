import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

/**
 * STYLES.SCSS ADDITIONS NEEDED:
 * @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap');
 *
 * APP CONFIG PROVIDERS NEEDED:
 * import { provideHttpClient } from '@angular/common/http';
 */

// ============================================================================
// INTERFACES — Fully typed, extensible. New fields in JSON just work.
// ============================================================================

interface DocumentInfo {
  title: string;
  version: string;
  company: string;
  tagline: string;
  totalSections?: number;
  lastUpdated?: string;
  [key: string]: any;
}

interface TableOfContentsEntry {
  id: number;
  title: string;
  page?: number;
  module?: string;
  color?: string;
  [key: string]: any;
}

interface Field {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  source?: string;
  [key: string]: any;
}

interface Section {
  id: number;
  title: string;
  objective?: string;
  purpose?: string;
  introduction?: string;
  description?: string;
  scope?: string;
  responsibilities?: string;
  prerequisites?: any[];
  navigation?: any[];
  procedure?: any;
  steps?: any;
  screenshots?: string[];
  pdfUrl?: string;
  fields?: Field[];
  addingValueStream?: { fields?: Field[] } & Record<string, any>;
  types?: Record<string, any>;
  notes?: string[];
  [key: string]: any;
}

interface Module {
  name: string;
  description?: string;
  sections: Section[];
  [key: string]: any;
}

interface DocsData {
  documentInfo: DocumentInfo;
  tableOfContents?: TableOfContentsEntry[];
  modules: Record<string, Module>;
  commonTerminology?: Record<string, string>;
  systemFeatures?: Record<string, any>;
  [key: string]: any;
}

type ViewType = 'home' | 'module' | 'section';

// Icon + color map — add new module keys here, or fallback to defaults
const MODULE_META: Record<string, { icon: string; color: string; accent: string }> = {
  master: { icon: '⚙️', color: '#0f62fe', accent: '#eaf1ff' },
  users: { icon: '👥', color: '#6929c4', accent: '#f3eeff' },
  orders: { icon: '📦', color: '#005d5d', accent: '#e3f6f6' },
  dashboard: { icon: '📊', color: '#9f1853', accent: '#fff0f4' },
  service: { icon: '🔧', color: '#b28600', accent: '#fef9e7' },
};
const DEFAULT_META = { icon: '📄', color: '#0972d3', accent: '#eaf1ff' };

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-root">
      <!-- ════════════════════ TOP NAVBAR ════════════════════ -->
      <header class="navbar">
        <div class="navbar-inner">
          <button class="navbar-logo" (click)="goHome()">
            <span class="logo-mark">●</span>
            <span class="logo-text">{{ data()?.documentInfo?.title ?? 'Documentation' }}</span>
          </button>

          <div class="navbar-center">
            <div class="search-bar">
              <svg class="search-icon" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5" />
                <path
                  d="M10.5 10.5L14 14"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search documentation..."
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event).target.value)"
                (keydown.Escape)="searchQuery.set('')"
              />
              @if (searchQuery()) {
                <button class="search-clear" (click)="searchQuery.set('')">✕</button>
              }
            </div>
          </div>

          <div class="navbar-right">
            <span class="version-chip">v{{ data()?.documentInfo?.version ?? '1.0' }}</span>
            <span class="updated-chip">{{ data()?.documentInfo?.lastUpdated ?? '' }}</span>
          </div>
        </div>
      </header>

      <!-- ════════════════════ BODY ════════════════════ -->
      <div class="body-layout" [class.has-sidebar]="currentView() === 'section'">
        <!-- LEFT SIDEBAR — only on section view -->
        @if (currentView() === 'section') {
          <aside class="sidebar" [class.collapsed]="sidebarCollapsed()">
            <div class="sidebar-header">
              @if (!sidebarCollapsed()) {
                <span class="sidebar-title">Contents</span>
              }
              <button
                class="sidebar-toggle"
                (click)="toggleSidebarCollapsed()"
                [title]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
              >
                <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                  <path
                    [attr.d]="sidebarCollapsed() ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <nav class="sidebar-nav">
              @for (key of moduleKeys(); track key) {
                @let meta = getModuleMeta(key);
                @let mod = data()!.modules[key];
                @let isExpanded = expandedModules().has(key);
                @let filteredSections = getFilteredSections(key);

                @if (filteredSections.length > 0) {
                  <div class="sidebar-group">
                    <button
                      class="sidebar-group-btn"
                      [class.expanded]="isExpanded"
                      [class.has-active]="isModuleActive(key)"
                      (click)="toggleModule(key)"
                      [title]="mod.name"
                    >
                      @if (!sidebarCollapsed()) {
                        <span class="sidebar-group-icon" [style.color]="meta.color">{{
                          meta.icon
                        }}</span>
                        <span class="sidebar-group-name">{{ mod.name }}</span>
                        <span class="sidebar-group-count">{{ filteredSections.length }}</span>
                        <svg
                          class="sidebar-chevron"
                          [class.open]="isExpanded"
                          viewBox="0 0 12 12"
                          fill="none"
                          width="12"
                        >
                          <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                          />
                        </svg>
                      } @else {
                        <span
                          class="sidebar-group-icon-only"
                          [style.color]="meta.color"
                          [title]="mod.name"
                          >{{ meta.icon }}</span
                        >
                      }
                    </button>

                    @if (isExpanded && !sidebarCollapsed()) {
                      <div class="sidebar-sections">
                        @for (section of filteredSections; track section.id) {
                          <button
                            class="sidebar-section-btn"
                            [class.active]="selectedSection()?.id === section.id"
                            (click)="selectSection(section, key)"
                          >
                            <span class="sidebar-section-num">{{ section.id }}</span>
                            <span class="sidebar-section-title">{{ section.title }}</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              }
            </nav>

            <!-- Terminology at bottom -->
            @if (!sidebarCollapsed() && data()?.commonTerminology) {
              <div class="sidebar-glossary">
                <div class="sidebar-glossary-title">Quick Reference</div>
                @for (entry of getTerminologyEntries(); track entry.key) {
                  <div class="glossary-row">
                    <code class="glossary-key">{{ entry.key }}</code>
                    <span class="glossary-val">{{ entry.value }}</span>
                  </div>
                }
              </div>
            }
          </aside>
        }

        <!-- ════════════════════ MAIN SCROLL AREA ════════════════════ -->
        <main class="main-scroll" #mainContent>
          <!-- ══════ VIEW 1: HOME ══════ -->
          @if (currentView() === 'home' && data()) {
            <div class="home-hero">
              <div class="home-hero-inner">
                <div class="hero-eyebrow">{{ data()!.documentInfo.company }}</div>
                <h1 class="hero-title">{{ data()!.documentInfo.title }}</h1>
                <p class="hero-tagline">{{ data()!.documentInfo.tagline }}</p>
                <div class="hero-meta">
                  <span class="hero-stat"
                    ><strong>{{ getTotalSections() }}</strong> sections</span
                  >
                  <span class="hero-divider">·</span>
                  <span class="hero-stat"
                    ><strong>{{ moduleKeys().length }}</strong> modules</span
                  >
                  <span class="hero-divider">·</span>
                  <span class="hero-stat"
                    >Updated <strong>{{ data()!.documentInfo.lastUpdated }}</strong></span
                  >
                </div>
              </div>
            </div>

            <!-- Search results inline -->
            @if (searchQuery()) {
              <div class="home-section">
                <div class="home-section-label">Search Results for "{{ searchQuery() }}"</div>
                <div class="search-results-grid">
                  @for (result of globalSearchResults(); track result.id) {
                    <button
                      class="search-result-card"
                      (click)="selectSection(result.section, result.moduleKey)"
                    >
                      <div class="src-module" [style.color]="getModuleMeta(result.moduleKey).color">
                        {{ getModuleMeta(result.moduleKey).icon }}
                        {{ data()!.modules[result.moduleKey].name }}
                      </div>
                      @if (firstScreenshot(result.section)) {
                        <div class="search-thumb">
                          <img
                            [src]="'/assets/images/screenshots/' + firstScreenshot(result.section)"
                            [alt]="result.section.title + ' preview'"
                            (error)="onImgError($event)"
                          />
                        </div>
                      }
                      <div class="src-title">{{ result.section.title }}</div>
                      <div class="src-id">Section {{ result.section.id }}</div>
                    </button>
                  }
                  @if (globalSearchResults().length === 0) {
                    <div class="no-results">No results found for "{{ searchQuery() }}"</div>
                  }
                </div>
              </div>
            }

            @if (!searchQuery()) {
              <!-- Module grid — AWS style -->
              <div class="home-section">
                <div class="home-section-label">Documentation Modules</div>
                <div class="modules-grid">
                  @for (key of moduleKeys(); track key) {
                    @let meta = getModuleMeta(key);
                    @let mod = data()!.modules[key];
                    <div
                      class="module-card"
                      role="button"
                      tabindex="0"
                      (click)="goToModule(key)"
                      (keydown.enter)="goToModule(key)"
                      (keydown.space)="$any($event).preventDefault(); goToModule(key)"
                      [style.--accent]="meta.accent"
                      [style.--c]="meta.color"
                    >
                      <div class="mc-top">
                        <span class="mc-icon">{{ meta.icon }}</span>
                        <span class="mc-badge">{{ mod.sections.length }} sections</span>
                      </div>
                      <div class="mc-name">{{ mod.name }}</div>
                      <div class="mc-desc">{{ mod.description }}</div>
                      @if (firstScreenshot(mod.sections[0])) {
                        <div class="mc-thumb">
                          <img
                            [src]="'/assets/images/screenshots/' + firstScreenshot(mod.sections[0])"
                            [alt]="mod.name + ' preview'"
                            (error)="onImgError($event)"
                          />
                        </div>
                      }
                      <div class="mc-arrow">
                        <svg viewBox="0 0 16 16" fill="none" width="14">
                          <path
                            d="M3 8h10M9 4l4 4-4 4"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        Browse sections
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- System Features -->
              @if (data()!.systemFeatures) {
                <div class="home-section">
                  <div class="home-section-label">Platform Features</div>
                  <div class="features-row">
                    @for (feat of getFeatureEntries(); track feat.key) {
                      <div class="feature-pill">
                        <span class="feature-dot"></span>{{ feat.label }}
                      </div>
                    }
                  </div>
                </div>
              }
            }
          }

          <!-- ══════ VIEW 2: MODULE LISTING ══════ -->
          @if (currentView() === 'module' && activeModuleKey() && data()) {
            @let meta = getModuleMeta(activeModuleKey()!);
            @let mod = data()!.modules[activeModuleKey()!];

            <!-- Breadcrumb -->
            <div class="breadcrumb-bar">
              <button class="bc-link" (click)="goHome()">Home</button>
              <span class="bc-sep">›</span>
              <span class="bc-current">{{ mod.name }}</span>
            </div>

            <div
              class="module-listing-header"
              [style.--c]="meta.color"
              [style.--accent]="meta.accent"
            >
              <div class="mlh-icon">{{ meta.icon }}</div>
              <div class="mlh-text">
                <h1>{{ mod.name }}</h1>
                <p>{{ mod.description }}</p>
              </div>
            </div>

            <!-- Section cards -->
            <div class="section-cards-list">
              @for (section of mod.sections; track section.id) {
                <div class="section-listing-card">
                  <div class="slc-left">
                    @if (firstScreenshot(section)) {
                      <div
                        class="slc-thumb"
                        tabindex="0"
                        role="button"
                        aria-label="open section"
                        (click)="selectSection(section, activeModuleKey()!)"
                        (keydown.enter)="selectSection(section, activeModuleKey()!)"
                        (keydown.space)="
                          $any($event).preventDefault(); selectSection(section, activeModuleKey()!)
                        "
                      >
                        <img
                          [src]="'/assets/images/screenshots/' + firstScreenshot(section)"
                          [alt]="section.title + ' thumbnail'"
                          (error)="onImgError($event)"
                        />
                      </div>
                    }
                    <span class="slc-num">{{ section.id }}</span>
                    <div class="slc-body">
                      <button
                        class="slc-title-link"
                        (click)="selectSection(section, activeModuleKey()!)"
                      >
                        {{ section.title }}
                      </button>
                      @if (section.objective || section.description) {
                        <p class="slc-desc">
                          {{ truncate(section.objective || section.description, 140) }}
                        </p>
                      }
                      <div class="slc-tags">
                        @if (section.prerequisites?.length) {
                          <span class="slc-tag">Prerequisites</span>
                        }
                        @if (section.screenshots?.length) {
                          <span class="slc-tag">{{ section.screenshots?.length }} screenshots</span>
                        }
                        @if (section.fields?.length || section.addingValueStream?.fields?.length) {
                          <span class="slc-tag">Fields reference</span>
                        }
                      </div>
                    </div>
                  </div>
                  <div class="slc-right">
                    <button
                      class="slc-btn-primary"
                      (click)="selectSection(section, activeModuleKey()!)"
                    >
                      Read →
                    </button>
                    @if (section.pdfUrl) {
                      <a
                        class="slc-btn-pdf"
                        [href]="section.pdfUrl"
                        target="_blank"
                        title="Download PDF"
                      >
                        <svg viewBox="0 0 16 16" fill="none" width="14">
                          <path d="M4 1h5l4 4v10H4V1z" stroke="currentColor" stroke-width="1.2" />
                          <path d="M9 1v4h4" stroke="currentColor" stroke-width="1.2" />
                        </svg>
                        PDF
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- ══════ VIEW 3: SECTION DETAIL ══════ -->
          @if (currentView() === 'section' && selectedSection() && data()) {
            @let section = selectedSection()!;
            @let modKey = activeModuleKey()!;
            @let meta = getModuleMeta(modKey);
            @let mod = data()!.modules[modKey];

            <!-- Breadcrumb -->
            <div class="breadcrumb-bar">
              <button class="bc-link" (click)="goHome()">Home</button>
              <span class="bc-sep">›</span>
              <button class="bc-link" (click)="goToModule(modKey)">{{ mod.name }}</button>
              <span class="bc-sep">›</span>
              <span class="bc-current">{{ section.title }}</span>
            </div>

            <!-- Section header -->
            <div class="section-page-header">
              <div class="sph-left">
                <div class="sph-eyebrow" [style.color]="meta.color">
                  {{ meta.icon }} {{ mod.name }}
                </div>
                <h1 class="sph-title">{{ section.title }}</h1>
                <div class="sph-meta">
                  <span>Section {{ section.id }}</span>
                  @if (section.screenshots?.length) {
                    <span class="sph-dot">·</span>
                    <span>{{ section.screenshots?.length }} screenshots</span>
                  }
                </div>
              </div>
              @if (section.pdfUrl) {
                <a class="sph-pdf-btn" [href]="section.pdfUrl" target="_blank">
                  <svg viewBox="0 0 16 16" fill="none" width="14">
                    <path d="M4 1h5l4 4v10H4V1z" stroke="currentColor" stroke-width="1.2" />
                    <path d="M9 1v4h4" stroke="currentColor" stroke-width="1.2" />
                  </svg>
                  Download PDF
                </a>
              }
            </div>

            <div class="section-body">
              <div class="section-body-inner">
                <div class="section-content">
                  <!-- OBJECTIVE / PURPOSE / INTRODUCTION (any "objective-like" key) -->
                  @for (key of ['objective', 'purpose', 'introduction']; track key) {
                    @if (section[key]) {
                      <div class="callout callout-blue" id="{{ key }}">
                        <div class="callout-icon">📋</div>
                        <div>
                          <div class="callout-label">{{ toLabel(key) }}</div>
                          <p class="callout-text">{{ section[key] }}</p>
                        </div>
                      </div>
                    }
                  }

                  <!-- DESCRIPTION -->
                  @if (section['description']) {
                    <p class="prose-text" id="description">{{ section['description'] }}</p>
                  }

                  <!-- SCOPE -->
                  @if (section['scope']) {
                    <div class="callout callout-gray" id="scope">
                      <div class="callout-icon">🎯</div>
                      <div>
                        <div class="callout-label">Scope</div>
                        <p class="callout-text">{{ section['scope'] }}</p>
                      </div>
                    </div>
                  }

                  <!-- RESPONSIBILITIES -->
                  @if (section['responsibilities']) {
                    <div class="callout callout-yellow" id="responsibilities">
                      <div class="callout-icon">👤</div>
                      <div>
                        <div class="callout-label">Responsibilities</div>
                        <p class="callout-text">{{ section['responsibilities'] }}</p>
                      </div>
                    </div>
                  }

                  <!-- PREREQUISITES -->
                  @if (section['prerequisites']?.length) {
                    <div class="content-block" id="prerequisites">
                      <h2 class="block-heading">Prerequisites</h2>
                      <ul class="check-list">
                        @for (item of asArray(section['prerequisites']); track $index) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </div>
                  }

                  <!-- NAVIGATION (numbered steps) -->
                  @if (section['navigation']?.length) {
                    <div class="content-block" id="navigation">
                      <h2 class="block-heading">Navigation</h2>
                      <ol class="step-ol">
                        @for (step of asArray(section['navigation']); let i = $index; track i) {
                          <li>
                            <span class="step-num">{{ i + 1 }}</span
                            >{{ step }}
                          </li>
                        }
                      </ol>
                    </div>
                  }

                  <!-- PROCEDURE -->
                  @if (section['procedure']) {
                    <div class="content-block" id="procedure">
                      <h2 class="block-heading">Procedure</h2>
                      @if (isArray(section['procedure'])) {
                        <ol class="step-ol">
                          @for (
                            step of renderProcedure(section['procedure']);
                            let i = $index;
                            track i
                          ) {
                            @if (step.type === 'string') {
                              <li>
                                <span class="step-num">{{ i + 1 }}</span
                                >{{ step.text }}
                              </li>
                            } @else {
                              <li class="step-substep-container">
                                <span class="step-num">{{ i + 1 }}</span>
                                <div>
                                  <details class="nested-details">
                                    <summary class="nested-summary">
                                      <strong>{{ step.title }}</strong>
                                    </summary>
                                    <div class="nested-content">
                                      @if (step.substeps?.length) {
                                        <ul class="substep-list">
                                          @for (sub of step.substeps; track $index) {
                                            <li>{{ sub }}</li>
                                          }
                                        </ul>
                                      }
                                      @if (step.details && !isArray(step.details)) {
                                        <p class="substep-detail">{{ step.details }}</p>
                                      }
                                    </div>
                                  </details>
                                </div>
                              </li>
                            }
                          }
                        </ol>
                      } @else if (section['procedure']?.steps?.length) {
                        <ol class="step-ol">
                          @for (step of section['procedure'].steps; let i = $index; track i) {
                            <li>
                              <span class="step-num">{{ i + 1 }}</span
                              >{{ step }}
                            </li>
                          }
                        </ol>
                      }
                    </div>
                  }

                  <!-- STEPS (array of objects with title+details OR plain strings) -->
                  @if (section['steps'] && !isEmptySteps(section['steps'])) {
                    <div class="content-block">
                      <h2 class="block-heading">Steps</h2>
                      @if (isArray(section['steps'])) {
                        <ol class="step-ol">
                          @for (
                            step of renderProcedure(section['steps']);
                            let i = $index;
                            track i
                          ) {
                            @if (step.type === 'string') {
                              <li>
                                <span class="step-num">{{ i + 1 }}</span
                                >{{ step.text }}
                              </li>
                            } @else {
                              <li class="step-substep-container">
                                <span class="step-num">{{ i + 1 }}</span>
                                <div>
                                  @if (step.title) {
                                    <strong>{{ step.title }}</strong>
                                  }
                                  @if (step.substeps?.length) {
                                    <ul class="substep-list">
                                      @for (sub of step.substeps; track $index) {
                                        <li>{{ sub }}</li>
                                      }
                                    </ul>
                                  }
                                  @if (step.details && !isArray(step.details)) {
                                    <p class="substep-detail">{{ step.details }}</p>
                                  }
                                  @if (isArray(step.details)) {
                                    <ul class="substep-list">
                                      @for (d of step.details; track $index) {
                                        <li>{{ d }}</li>
                                      }
                                    </ul>
                                  }
                                  @if (step.forMultipleInputFields?.length) {
                                    <div class="substep-sub-label">For multiple input fields:</div>
                                    <ul class="substep-list">
                                      @for (d of step.forMultipleInputFields; track $index) {
                                        <li>{{ d }}</li>
                                      }
                                    </ul>
                                  }
                                  @if (step.forSingleInputField?.length) {
                                    <div class="substep-sub-label">For single input field:</div>
                                    <ul class="substep-list">
                                      @for (d of step.forSingleInputField; track $index) {
                                        <li>{{ d }}</li>
                                      }
                                    </ul>
                                  }
                                  @if (step.fieldConfiguration?.length) {
                                    <div class="substep-sub-label">Field configuration:</div>
                                    <ul class="substep-list">
                                      @for (d of step.fieldConfiguration; track $index) {
                                        <li>{{ d }}</li>
                                      }
                                    </ul>
                                  }
                                  @if (step.substeps?.length) {
                                    <ul class="substep-list">
                                      @for (d of step.substeps; track $index) {
                                        <li>{{ d }}</li>
                                      }
                                    </ul>
                                  }
                                </div>
                              </li>
                            }
                          }
                        </ol>
                      }
                    </div>
                  }

                  <!-- STEPS TO ADD / STEPS TO EDIT (any stepTo* key) -->
                  @for (key of getStepKeys(section); track key) {
                    <div class="content-block">
                      <h2 class="block-heading">{{ toLabel(key) }}</h2>
                      <ol class="step-ol">
                        @for (step of asArray(section[key]); let i = $index; track i) {
                          <li>
                            <span class="step-num">{{ i + 1 }}</span
                            >{{ step }}
                          </li>
                        }
                      </ol>
                    </div>
                  }

                  <!-- VIEWING / ACCESSING (two-column when both exist) -->
                  @if (section['viewing'] || section['accessing']) {
                    <div
                      class="two-col"
                      [class.one-col]="!section['viewing'] || !section['accessing']"
                    >
                      @if (section['viewing']) {
                        <div class="info-panel">
                          <div class="info-panel-title">How to View</div>
                          @if (isString(section['viewing'])) {
                            <p>{{ section['viewing'] }}</p>
                          } @else if (section['viewing']?.description) {
                            <p>{{ section['viewing'].description }}</p>
                          } @else {
                            <ul class="plain-list">
                              @for (item of asArray(section['viewing']); track $index) {
                                <li>{{ item }}</li>
                              }
                            </ul>
                          }
                        </div>
                      }
                      @if (section['accessing']) {
                        <div class="info-panel">
                          <div class="info-panel-title">How to Access</div>
                          @if (isString(section['accessing'])) {
                            <p>{{ section['accessing'] }}</p>
                          } @else {
                            <ul class="plain-list">
                              @for (item of asArray(section['accessing']); track $index) {
                                <li>{{ item }}</li>
                              }
                            </ul>
                          }
                        </div>
                      }
                    </div>
                  }

                  <!-- FIELDS TABLE -->
                  @if (section['fields']?.length) {
                    <div class="content-block" id="fields">
                      <h2 class="block-heading">Fields Reference</h2>
                      <div class="table-wrap">
                        <table class="ref-table">
                          <thead>
                            <tr>
                              <th>Field</th>
                              <th>Type</th>
                              <th>Required</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (field of section['fields']; track field.name) {
                              <tr>
                                <td>
                                  <code>{{ field.name }}</code>
                                </td>
                                <td>
                                  <span class="type-badge">{{ field.type }}</span>
                                </td>
                                <td>
                                  @if (field.required) {
                                    <span class="req-yes">Yes</span>
                                  } @else {
                                    <span class="req-no">No</span>
                                  }
                                </td>
                                <td class="td-muted">
                                  {{ field.description || field.source || '—' }}
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  }

                  <!-- ADDING VALUE STREAM -->
                  @if (section['addingValueStream']) {
                    @let avs = section['addingValueStream'];
                    <div class="content-block callout-green-block" id="addingValueStream">
                      <h2 class="block-heading">{{ avs['title'] }}</h2>
                      @if (avs['fields']?.length) {
                        <div class="table-wrap">
                          <table class="ref-table">
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Type</th>
                                <th>Required</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (f of avs['fields']; track f.name) {
                                <tr>
                                  <td>
                                    <code>{{ f.name }}</code>
                                  </td>
                                  <td>
                                    <span class="type-badge">{{ f.type }}</span>
                                  </td>
                                  <td>{{ f.required ? '✓' : '—' }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                      @if (avs['steps']?.length) {
                        <ol class="step-ol mt-12">
                          @for (step of avs['steps']; let i = $index; track i) {
                            <li>
                              <span class="step-num">{{ i + 1 }}</span
                              >{{ step }}
                            </li>
                          }
                        </ol>
                      }
                      @if (avs['action']) {
                        <div class="action-note">→ {{ avs['action'] }}</div>
                      }
                    </div>
                  }

                  <!-- TYPES (expandable accordion) -->
                  @if (section['types'] && objectKeys(section['types']).length) {
                    <div class="content-block" id="types">
                      <h2 class="block-heading">Types & Categories</h2>
                      @for (key of objectKeys(section['types']); track key) {
                        @let typeData = section['types'][key];
                        <details class="accordion">
                          <summary class="accordion-summary">
                            <span>{{ typeData.name || toLabel(key) }}</span>
                            <svg class="acc-arrow" viewBox="0 0 12 12" fill="none" width="12">
                              <path
                                d="M3 4.5L6 7.5L9 4.5"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                              />
                            </svg>
                          </summary>
                          <div class="accordion-body">
                            @if (typeData.description) {
                              <p class="acc-desc">{{ typeData.description }}</p>
                            }
                            @if (typeData.navigation?.length || typeData.accessing?.length) {
                              <div class="acc-sub-label">Access</div>
                              <ol class="step-ol-sm">
                                @for (
                                  s of asArray(typeData.navigation || typeData.accessing);
                                  let i = $index;
                                  track i
                                ) {
                                  <li>
                                    <span class="step-num-sm">{{ i + 1 }}</span
                                    >{{ s }}
                                  </li>
                                }
                              </ol>
                            }
                            @if (typeData.adding?.steps?.length) {
                              <div class="acc-sub-label">Adding</div>
                              <ol class="step-ol-sm">
                                @for (s of typeData.adding.steps; let i = $index; track i) {
                                  <li>
                                    <span class="step-num-sm">{{ i + 1 }}</span
                                    >{{ s }}
                                  </li>
                                }
                              </ol>
                            }
                            @if (typeData.viewing) {
                              <div class="acc-sub-label">Viewing</div>
                              <p class="acc-desc">{{ typeData.viewing }}</p>
                            }
                          </div>
                        </details>
                      }
                    </div>
                  }

                  <!-- DYNAMIC OBJECT SECTIONS (operations, components, listing page, etc) -->
                  @for (key of getDynamicObjectKeys(section); track key) {
                    <div class="content-block">
                      <h2 class="block-heading">{{ toLabel(key) }}</h2>
                      <div class="dynamic-object">
                        @for (subKey of objectKeys(section[key]); track subKey) {
                          @let val = section[key][subKey];
                          <div class="dyn-row">
                            <div class="dyn-label">{{ toLabel(subKey) }}</div>
                            <div class="dyn-value">
                              @if (isString(val)) {
                                {{ val }}
                              } @else if (isArray(val)) {
                                <ul class="plain-list-sm">
                                  @for (v of val; track $index) {
                                    @if (isString(v)) {
                                      <li>{{ v }}</li>
                                    } @else if (v?.description || v?.name) {
                                      <li>
                                        <strong>{{ v.name || '' }}</strong
                                        >{{ v.description ? ' — ' + v.description : '' }}
                                      </li>
                                    }
                                  }
                                </ul>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- NOTES -->
                  @if (section['notes']?.length) {
                    <div class="callout callout-yellow" id="notes">
                      <div class="callout-icon">⚠️</div>
                      <div>
                        <div class="callout-label">Important Notes</div>
                        <ul class="note-list">
                          @for (note of section['notes']; track $index) {
                            <li>{{ note }}</li>
                          }
                        </ul>
                      </div>
                    </div>
                  }

                  <!-- SCREENSHOTS -->
                  @if (section['screenshots']?.length) {
                    <div class="content-block">
                      <h2 class="block-heading">Screenshots</h2>
                      <div class="screenshots-grid">
                        @for (img of section['screenshots']; let i = $index; track i) {
                          <div
                            class="screenshot-card"
                            role="button"
                            tabindex="0"
                            (click)="openViewer(img, i)"
                            (keydown.enter)="openViewer(img, i)"
                            (keydown.space)="$any($event).preventDefault(); openViewer(img, i)"
                          >
                            <div class="screenshot-img-wrap">
                              <img
                                [src]="'/assets/images/screenshots/' + img"
                                [alt]="img"
                                (error)="onImgError($event)"
                              />
                            </div>
                            <div class="screenshot-label">
                              <code>{{ img }}</code>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- PREV / NEXT NAVIGATION -->
                  <div class="page-nav">
                    <button class="page-nav-btn" (click)="prevSection()" [disabled]="!hasPrev()">
                      <svg viewBox="0 0 16 16" fill="none" width="14">
                        <path
                          d="M10 3L6 8l4 5"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      Previous
                    </button>
                    <span class="page-nav-counter"
                      >{{ section.id }} of {{ getTotalSections() }}</span
                    >
                    <button
                      class="page-nav-btn page-nav-next"
                      (click)="nextSection()"
                      [disabled]="!hasNext()"
                    >
                      Next
                      <svg viewBox="0 0 16 16" fill="none" width="14">
                        <path
                          d="M6 3l4 5-4 5"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- /section-content -->

                <!-- RIGHT RAIL: On This Page -->
                <aside class="right-rail" [class.collapsed]="rightRailCollapsed()">
                  <div class="rr-title">
                    On this page
                    <button
                      class="rr-toggle"
                      type="button"
                      (click)="toggleRightRail()"
                      [attr.aria-expanded]="!rightRailCollapsed()"
                      aria-label="Toggle table of contents"
                    >
                      ▢
                    </button>
                  </div>
                  <nav class="rr-nav">
                    @for (anchor of getAnchors(section); track anchor.key) {
                      <a
                        class="rr-link"
                        [href]="'#' + anchor.key"
                        (click)="scrollToAnchor(anchor.key, $any($event))"
                        >{{ anchor.label }}</a
                      >
                    }
                  </nav>

                  <div class="rr-divider"></div>
                  <div class="rr-meta">
                    <div class="rr-meta-row">
                      <span class="rr-meta-label">Module</span>
                      <span>{{ mod.name }}</span>
                    </div>
                    <div class="rr-meta-row">
                      <span class="rr-meta-label">Section</span>
                      <span>#{{ section.id }}</span>
                    </div>
                    @if (section.screenshots?.length) {
                      <div class="rr-meta-row">
                        <span class="rr-meta-label">Screenshots</span>
                        <span>{{ section.screenshots?.length }}</span>
                      </div>
                    }
                  </div>
                </aside>
              </div>
              <!-- /section-body-inner -->
            </div>
            <!-- /section-body -->
          }
        </main>
        <!-- /main-scroll -->
      </div>
      <!-- /body-layout -->
    </div>
    <!-- /docs-root -->

    <!-- ════════════════════ IMAGE VIEWER ════════════════════ -->
    @if (viewerOpen()) {
      <div class="viewer-overlay" (click)="closeViewer()">
        <div class="viewer-modal" (click)="$event.stopPropagation()">
          <div class="viewer-topbar">
            <code class="viewer-filename">{{ viewerImg() }}</code>
            <div class="viewer-controls">
              <button (click)="zoomOut()" [disabled]="zoom() <= 0.5">−</button>
              <span>{{ (zoom() * 100).toFixed(0) }}%</span>
              <button (click)="zoomIn()" [disabled]="zoom() >= 4">+</button>
              <button (click)="resetZoom()">Reset</button>
              <button class="viewer-close" (click)="closeViewer()">✕</button>
            </div>
          </div>
          <div class="viewer-body" (wheel)="onWheel($event)">
            <div class="viewer-img-wrap" [style.transform]="'scale(' + zoom() + ')'">
              <img
                [src]="'/assets/images/screenshots/' + viewerImg()"
                [alt]="viewerImg()"
                (error)="onImgError($event)"
              />
            </div>
          </div>
          <div class="viewer-footer">
            <button (click)="prevImg()" [disabled]="viewerIdx() === 0">← Prev</button>
            <span>{{ viewerIdx() + 1 }} / {{ selectedSection()?.screenshots?.length ?? 0 }}</span>
            <button
              (click)="nextImg()"
              [disabled]="viewerIdx() + 1 >= (selectedSection()?.screenshots?.length ?? 0)"
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
        --navy: #0f1b2d;
        --blue: #0972d3;
        --blue-hover: #0559a8;
        --blue-light: #eaf1ff;
        --border: #e3e8ef;
        --border-dark: #c8d0dc;
        --text-primary: #0f1b2d;
        --text-secondary: #5f6b7a;
        --text-muted: #8d99a8;
        --bg: #ffffff;
        --bg-subtle: #f8f9fb;
        --bg-hover: #f2f4f8;
        --green: #037f51;
        --green-light: #e8f5f0;
        --yellow: #b28600;
        --yellow-light: #fef9e7;
        --yellow-border: #f5c518;
        --sidebar-bg: #0f1b2d;
        --sidebar-text: #9aafca;
        --sidebar-hover: #1a2e47;
        --sidebar-active: #0972d3;
        --sidebar-width: 252px;
        --sidebar-collapsed: 52px;
        --navbar-h: 52px;
        font-family:
          'Inter',
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
        display: block;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      button {
        font-family: inherit;
        cursor: pointer;
      }
      a {
        text-decoration: none;
      }

      /* ── NAVBAR ──────────────────────────────────── */
      .navbar {
        position: sticky;
        top: 0;
        z-index: 200;
        height: var(--navbar-h);
        background: var(--navy);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .navbar-inner {
        display: flex;
        align-items: center;
        gap: 16px;
        height: 100%;
        padding: 0 20px;
      }
      .navbar-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
        max-width: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 4px 0;
        transition: opacity 0.15s;
      }
      .navbar-logo:hover {
        opacity: 0.8;
      }
      .logo-mark {
        color: var(--blue);
        font-size: 10px;
      }
      .navbar-center {
        flex: 1;
        display: flex;
        justify-content: center;
      }
      .search-bar {
        position: relative;
        width: 100%;
        max-width: 420px;
        display: flex;
        align-items: center;
      }
      .search-icon {
        position: absolute;
        left: 10px;
        color: var(--sidebar-text);
        width: 14px;
        height: 14px;
        pointer-events: none;
      }
      .search-input {
        width: 100%;
        padding: 7px 32px 7px 34px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        font-family: inherit;
        transition: all 0.2s;
      }
      .search-input::placeholder {
        color: var(--sidebar-text);
      }
      .search-input:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.13);
        border-color: rgba(255, 255, 255, 0.25);
      }
      .search-clear {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        color: var(--sidebar-text);
        font-size: 12px;
        padding: 2px 4px;
        transition: color 0.15s;
      }
      .search-clear:hover {
        color: #fff;
      }
      .navbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .version-chip,
      .updated-chip {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--sidebar-text);
        font-family: 'IBM Plex Mono', monospace;
      }
      .updated-chip {
        display: none;
      }
      @media (min-width: 1200px) {
        .updated-chip {
          display: inline;
        }
      }

      /* ── BODY ──────────────────────────────────── */
      .docs-root {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
        background: var(--bg);
      }
      .body-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      /* ── SIDEBAR ──────────────────────────────────── */
      .sidebar {
        width: var(--sidebar-width);
        background: var(--sidebar-bg);
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        overflow: hidden;
        transition: width 0.25s ease;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
      }
      .sidebar.collapsed {
        width: var(--sidebar-collapsed);
      }
      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
        min-height: 44px;
      }
      .sidebar-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--sidebar-text);
      }
      .sidebar-toggle {
        background: none;
        border: none;
        color: var(--sidebar-text);
        padding: 4px;
        border-radius: 4px;
        transition:
          background 0.15s,
          color 0.15s;
        display: flex;
        align-items: center;
      }
      .sidebar-toggle:hover {
        background: var(--sidebar-hover);
        color: #fff;
      }
      .sidebar-nav {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 6px 0;
      }
      .sidebar-nav::-webkit-scrollbar {
        width: 4px;
      }
      .sidebar-nav::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
      }

      .sidebar-group {
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }
      .sidebar-group-btn {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px;
        background: none;
        border: none;
        color: var(--sidebar-text);
        font-size: 12px;
        font-weight: 500;
        text-align: left;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .sidebar-group-btn:hover {
        background: var(--sidebar-hover);
        color: #d0dbe8;
      }
      .sidebar-group-btn.has-active {
        color: #c5d8f0;
      }
      .sidebar-group-icon {
        font-size: 14px;
        flex-shrink: 0;
      }
      .sidebar-group-icon-only {
        font-size: 16px;
        display: block;
        text-align: center;
        width: 100%;
        padding: 6px 0;
      }
      .sidebar-group-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-group-count {
        font-size: 10px;
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .sidebar-chevron {
        flex-shrink: 0;
        color: var(--sidebar-text);
        transition: transform 0.2s;
      }
      .sidebar-chevron.open {
        transform: rotate(180deg);
      }

      .sidebar-sections {
        padding: 2px 0;
      }
      .sidebar-section-btn {
        width: 100%;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 7px 14px 7px 28px;
        background: none;
        border: none;
        border-left: 2px solid transparent;
        color: rgba(154, 175, 202, 0.75);
        font-size: 12px;
        text-align: left;
        transition: all 0.15s;
        cursor: pointer;
        line-height: 1.4;
      }
      .sidebar-section-btn:hover {
        background: var(--sidebar-hover);
        color: #c5d8f0;
        border-left-color: rgba(9, 114, 211, 0.4);
      }
      .sidebar-section-btn.active {
        background: rgba(9, 114, 211, 0.15);
        color: #fff;
        border-left-color: var(--blue);
      }
      .sidebar-section-num {
        font-size: 10px;
        opacity: 0.5;
        flex-shrink: 0;
        margin-top: 1px;
        font-family: 'IBM Plex Mono', monospace;
      }
      .sidebar-section-title {
        flex: 1;
      }

      .sidebar-glossary {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 12px 14px;
        flex-shrink: 0;
        max-height: 200px;
        overflow-y: auto;
      }
      .sidebar-glossary-title {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--sidebar-text);
        margin-bottom: 8px;
      }
      .glossary-row {
        display: flex;
        gap: 8px;
        align-items: baseline;
        margin-bottom: 5px;
      }
      .glossary-key {
        font-size: 10px;
        color: var(--blue);
        background: rgba(9, 114, 211, 0.2);
        padding: 1px 5px;
        border-radius: 3px;
        flex-shrink: 0;
      }
      .glossary-val {
        font-size: 10px;
        color: rgba(154, 175, 202, 0.7);
      }

      /* ── MAIN SCROLL ──────────────────────────────────── */
      .main-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        background: var(--bg);
      }
      .main-scroll::-webkit-scrollbar {
        width: 6px;
      }
      .main-scroll::-webkit-scrollbar-thumb {
        background: var(--border-dark);
        border-radius: 3px;
      }

      /* ── HOME VIEW ──────────────────────────────────── */
      .home-hero {
        background: linear-gradient(135deg, var(--navy) 0%, #1a3050 100%);
        padding: 56px 40px 52px;
      }
      .home-hero-inner {
        max-width: 760px;
        margin: 0 auto;
      }
      .hero-eyebrow {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--blue);
        margin-bottom: 12px;
      }
      .hero-title {
        font-size: 34px;
        font-weight: 700;
        color: #fff;
        line-height: 1.25;
        margin-bottom: 12px;
      }
      .hero-tagline {
        font-size: 16px;
        color: rgba(200, 218, 240, 0.75);
        margin-bottom: 24px;
      }
      .hero-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: rgba(154, 175, 202, 0.8);
      }
      .hero-meta strong {
        color: #fff;
      }
      .hero-divider {
        opacity: 0.4;
      }

      .home-section {
        max-width: 1200px;
        margin: 0 auto;
        padding: 36px 40px 0;
      }
      .home-section:last-child {
        padding-bottom: 48px;
      }
      .home-section-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 18px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
      }

      .modules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 14px;
      }
      .module-card {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .module-card:hover {
        border-color: var(--c, var(--blue));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--c, var(--blue)) 12%, transparent);
        background: var(--accent, var(--blue-light));
      }
      .mc-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .mc-icon {
        font-size: 22px;
      }
      .mc-badge {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-subtle);
        padding: 2px 8px;
        border-radius: 10px;
        border: 1px solid var(--border);
      }
      .mc-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .mc-desc {
        font-size: 14px;
        color: var(--text-secondary);
        line-height: 1.55;
        flex: 1;
      }
      .mc-arrow {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: var(--c, var(--blue));
        font-weight: 500;
        margin-top: 4px;
      }
      /* Thumbnails & subtle image hover */
      .mc-thumb {
        margin-top: 12px;
        width: 100%;
        height: 120px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--border);
      }
      .mc-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .slc-thumb {
        width: 96px;
        height: 64px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--border);
        margin-right: 12px;
        flex-shrink: 0;
      }
      .slc-thumb img,
      .search-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .search-thumb {
        width: 80px;
        height: 56px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--border);
        margin: 6px 0;
      }
      .screenshot-card {
        transition:
          transform 0.18s,
          box-shadow 0.18s;
      }
      .screenshot-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(2, 6, 23, 0.12);
      }

      .search-results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 10px;
      }
      .search-result-card {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 14px 16px;
        text-align: left;
        cursor: pointer;
        transition: all 0.15s;
      }
      .search-result-card:hover {
        border-color: var(--blue);
        background: var(--blue-light);
      }
      .src-module {
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 5px;
      }
      .src-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
      }
      .src-id {
        font-size: 11px;
        color: var(--text-muted);
        font-family: 'IBM Plex Mono', monospace;
      }
      .no-results {
        color: var(--text-muted);
        font-size: 14px;
        padding: 20px 0;
      }

      .features-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .feature-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        padding: 5px 12px;
        border-radius: 20px;
      }
      .feature-dot {
        width: 6px;
        height: 6px;
        background: var(--green);
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* ── BREADCRUMB ──────────────────────────────────── */
      .breadcrumb-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 12px 40px;
        font-size: 13px;
        background: var(--bg-subtle);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .bc-link {
        background: none;
        border: none;
        color: var(--blue);
        font-size: 13px;
        font-family: inherit;
        padding: 0;
        transition: color 0.15s;
      }
      .bc-link:hover {
        color: var(--blue-hover);
        text-decoration: underline;
      }
      .bc-sep {
        color: var(--text-muted);
      }
      .bc-current {
        color: var(--text-primary);
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── MODULE LISTING (View 2) ──────────────────────────────────── */
      .module-listing-header {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 32px 40px;
        background: color-mix(in srgb, var(--accent, #eaf1ff) 60%, white);
        border-bottom: 1px solid var(--border);
      }
      .mlh-icon {
        font-size: 36px;
      }
      .mlh-text h1 {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 4px;
      }
      .mlh-text p {
        font-size: 14px;
        color: var(--text-secondary);
      }

      .section-cards-list {
        max-width: 860px;
        margin: 0 auto;
        padding: 24px 40px 48px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .section-listing-card {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg);
        transition: all 0.15s;
        margin-bottom: 8px;
      }
      .section-listing-card:hover {
        border-color: var(--blue-hover);
        box-shadow: 0 2px 8px rgba(9, 114, 211, 0.08);
      }
      .slc-left {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        flex: 1;
        min-width: 0;
      }
      .slc-num {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: var(--text-muted);
        font-family: 'IBM Plex Mono', monospace;
        margin-top: 2px;
      }
      .slc-body {
        flex: 1;
        min-width: 0;
      }
      .slc-title-link {
        background: none;
        border: none;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--blue);
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        transition: color 0.15s;
        margin-bottom: 5px;
        display: block;
      }
      .slc-title-link:hover {
        color: var(--blue-hover);
        text-decoration: underline;
      }
      .slc-desc {
        font-size: 14px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin-bottom: 8px;
      }
      .slc-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .slc-tag {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        padding: 2px 8px;
        border-radius: 10px;
      }
      .slc-right {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;
      }
      .slc-btn-primary {
        padding: 6px 14px;
        background: var(--blue);
        color: #fff;
        border: none;
        border-radius: 5px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }
      .slc-btn-primary:hover {
        background: var(--blue-hover);
      }
      .slc-btn-pdf {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border: 1px solid var(--border);
        border-radius: 5px;
        font-size: 11px;
        color: var(--text-secondary);
        background: var(--bg-subtle);
        transition: all 0.15s;
      }
      .slc-btn-pdf:hover {
        border-color: var(--blue);
        color: var(--blue);
        background: var(--blue-light);
      }

      /* ── SECTION PAGE (View 3) ──────────────────────────────────── */
      .section-page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 28px 40px 24px;
        border-bottom: 1px solid var(--border);
      }
      .sph-eyebrow {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        margin-bottom: 6px;
      }
      .sph-title {
        font-size: 28px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.2;
        margin-bottom: 8px;
      }
      .sph-meta {
        font-size: 12px;
        color: var(--text-muted);
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .sph-dot {
        opacity: 0.5;
      }
      .sph-pdf-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        padding: 7px 14px;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        background: var(--bg-subtle);
        transition: all 0.15s;
        margin-top: 4px;
      }
      .sph-pdf-btn:hover {
        border-color: var(--blue);
        color: var(--blue);
        background: var(--blue-light);
      }

      .section-body {
        display: flex;
        justify-content: center;
        flex: 1;
      }
      .section-body-inner {
        width: 100%;
        max-width: 1200px;
        display: flex;
        gap: 24px;
        align-items: flex-start;
        padding: 0 20px;
        box-sizing: border-box;
      }
      .section-content {
        flex: 0 1 780px;
        min-width: 0;
        padding: 32px 40px 56px;
        max-width: 780px;
        margin: 0;
      }

      /* ── CONTENT BLOCKS ──────────────────────────────────── */
      .content-block {
        margin-bottom: 32px;
      }
      .block-heading {
        font-size: 17px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
      }
      .prose-text {
        font-size: 15px;
        color: var(--text-secondary);
        line-height: 1.75;
        margin-bottom: 24px;
      }
      .mt-12 {
        margin-top: 12px;
      }

      /* Callouts */
      .callout {
        display: flex;
        gap: 14px;
        padding: 16px 18px;
        border-radius: 8px;
        margin-bottom: 24px;
        border: 1px solid;
        font-size: 13px;
      }
      .callout-blue {
        background: var(--blue-light);
        border-color: rgba(9, 114, 211, 0.2);
      }
      .callout-gray {
        background: var(--bg-subtle);
        border-color: var(--border);
      }
      .callout-yellow {
        background: var(--yellow-light);
        border-color: rgba(242, 197, 0, 0.3);
      }
      .callout-icon {
        font-size: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .callout-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .callout-text {
        color: var(--text-secondary);
        line-height: 1.6;
        margin: 0;
      }
      .callout-green-block {
        background: var(--green-light);
        border: 1px solid rgba(3, 127, 81, 0.2);
        border-left: 3px solid var(--green);
        padding: 20px;
        border-radius: 6px;
      }
      .callout-green-block .block-heading {
        color: var(--green);
        border-bottom-color: rgba(3, 127, 81, 0.15);
      }

      /* Step lists */
      .step-ol {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .step-ol li {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 14px;
        color: var(--text-secondary);
        line-height: 1.6;
      }
      .step-ol li.step-substep-container {
        flex-direction: row;
        align-items: flex-start;
      }
      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        min-width: 22px;
        background: var(--blue);
        color: #fff;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 600;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .step-ol-sm {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .step-ol-sm li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.55;
      }
      .step-num-sm {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        min-width: 18px;
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        color: var(--text-muted);
        border-radius: 50%;
        font-size: 10px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .substep-list {
        list-style: disc;
        padding-left: 18px;
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .substep-list li {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.55;
      }
      .substep-detail {
        font-size: 13px;
        color: var(--text-secondary);
        margin-top: 6px;
        line-height: 1.55;
      }
      .substep-sub-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: 10px;
        margin-bottom: 4px;
      }

      .check-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .check-list li {
        font-size: 13.5px;
        color: var(--text-secondary);
        line-height: 1.6;
        padding-left: 20px;
        position: relative;
      }
      .check-list li::before {
        content: '✓';
        position: absolute;
        left: 0;
        color: var(--green);
        font-weight: 700;
        font-size: 12px;
        top: 2px;
      }

      .plain-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .plain-list li {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.6;
        padding-left: 12px;
        border-left: 2px solid var(--border);
      }
      .plain-list-sm {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .plain-list-sm li {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
      }

      .note-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .note-list li {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.6;
        padding-left: 14px;
        position: relative;
      }
      .note-list li::before {
        content: '•';
        position: absolute;
        left: 0;
        color: var(--yellow);
        font-weight: 700;
      }

      /* Two-column info */
      .two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 28px;
      }
      .one-col {
        grid-template-columns: 1fr;
      }
      .info-panel {
        background: var(--bg-subtle);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 16px;
      }
      .info-panel-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .info-panel p {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      /* Table */
      .table-wrap {
        overflow-x: auto;
        border-radius: 6px;
        border: 1px solid var(--border);
      }
      .ref-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .ref-table thead {
        background: var(--bg-subtle);
      }
      .ref-table th {
        padding: 10px 14px;
        text-align: left;
        font-weight: 600;
        color: var(--text-primary);
        font-size: 12px;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      .ref-table td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--border);
        color: var(--text-secondary);
        vertical-align: top;
      }
      .ref-table tbody tr:last-child td {
        border-bottom: none;
      }
      .ref-table tbody tr:hover td {
        background: var(--bg-hover);
      }
      code {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        color: #b83232;
        background: #fff0f0;
        padding: 2px 5px;
        border-radius: 3px;
      }
      .type-badge {
        font-size: 11px;
        background: var(--blue-light);
        color: var(--blue);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
      }
      .req-yes {
        color: var(--green);
        font-weight: 600;
        font-size: 12px;
      }
      .req-no {
        color: var(--text-muted);
        font-size: 12px;
      }
      .td-muted {
        color: var(--text-muted) !important;
        font-size: 12px;
      }

      /* Accordion */
      .accordion {
        border: 1px solid var(--border);
        border-radius: 6px;
        margin-bottom: 8px;
        overflow: hidden;
      }
      .accordion-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 16px;
        cursor: pointer;
        background: var(--bg-subtle);
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        user-select: none;
        list-style: none;
        transition: background 0.15s;
      }
      .accordion-summary::-webkit-details-marker {
        display: none;
      }
      .accordion-summary:hover {
        background: var(--bg-hover);
      }
      details[open] .accordion-summary {
        background: var(--blue-light);
      }
      details[open] .acc-arrow {
        transform: rotate(180deg);
      }
      .acc-arrow {
        transition: transform 0.2s;
        color: var(--text-muted);
      }
      .accordion-body {
        padding: 16px;
        border-top: 1px solid var(--border);
        background: var(--bg);
      }
      .acc-desc {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.6;
        margin-bottom: 10px;
      }
      .acc-sub-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      /* Nested details (AWS-like) */
      .nested-details {
        border: 1px solid var(--border);
        border-radius: 6px;
        overflow: hidden;
        margin-top: 8px;
        background: var(--bg-subtle);
      }
      .nested-summary {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        cursor: pointer;
        font-weight: 600;
        color: var(--text-primary);
        background: transparent;
        user-select: none;
        list-style: none;
      }
      .nested-summary::-webkit-details-marker {
        display: none;
      }
      .nested-summary::after {
        content: '\\25B6';
        margin-left: auto;
        transform: rotate(0deg);
        transition: transform 0.18s ease;
        color: #111;
        font-size: 12px;
      }
      details[open] > .nested-summary::after {
        transform: rotate(90deg);
      }
      .nested-content {
        padding: 10px 12px 14px;
        border-top: 1px solid var(--border);
        background: var(--bg);
      }

      /* Dynamic object */
      .dynamic-object {
        border: 1px solid var(--border);
        border-radius: 6px;
        overflow: hidden;
      }
      .dyn-row {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--border);
      }
      .dyn-row:last-child {
        border-bottom: none;
      }
      .dyn-label {
        width: 180px;
        min-width: 180px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
        padding: 10px 14px;
        background: var(--bg-subtle);
        border-right: 1px solid var(--border);
      }
      .dyn-value {
        flex: 1;
        font-size: 13px;
        color: var(--text-secondary);
        padding: 10px 14px;
        line-height: 1.5;
      }

      /* Action note */
      .action-note {
        font-size: 13px;
        color: var(--green);
        font-weight: 500;
        margin-top: 12px;
        padding: 8px 12px;
        background: var(--green-light);
        border-radius: 4px;
      }

      /* Screenshots */
      .screenshots-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .screenshot-card {
        border: 1px solid var(--border);
        border-radius: 6px;
        overflow: hidden;
        cursor: zoom-in;
        transition: all 0.2s;
      }
      .screenshot-card:hover {
        border-color: var(--blue);
        box-shadow: 0 4px 16px rgba(9, 114, 211, 0.1);
      }
      .screenshot-img-wrap {
        background: var(--bg-subtle);
      }
      .screenshot-img-wrap img {
        width: 100%;
        height: auto;
        display: block;
        aspect-ratio: 16/9;
        object-fit: cover;
      }
      .screenshot-label {
        padding: 8px 12px;
        background: var(--bg-subtle);
        border-top: 1px solid var(--border);
        font-size: 11px;
      }

      /* Page nav */
      .page-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 32px;
        margin-top: 40px;
        border-top: 1px solid var(--border);
      }
      .page-nav-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg-subtle);
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        transition: all 0.15s;
        cursor: pointer;
      }
      .page-nav-btn:hover:not(:disabled) {
        border-color: var(--blue);
        background: var(--blue-light);
        color: var(--blue);
      }
      .page-nav-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .page-nav-next {
        background: var(--blue);
        color: #fff;
        border-color: var(--blue);
      }
      .page-nav-next:hover:not(:disabled) {
        background: var(--blue-hover) !important;
        color: #fff !important;
      }
      .page-nav-counter {
        font-size: 12px;
        color: var(--text-muted);
        font-family: 'IBM Plex Mono', monospace;
      }

      /* ── RIGHT RAIL ──────────────────────────────────── */
      .right-rail {
        width: 220px;
        flex-shrink: 0;
        padding: 32px 20px;
        position: sticky;
        top: 0;
        height: calc(100vh - var(--navbar-h) - 44px); /* breadcrumb height */
        overflow-y: auto;
        border-left: 1px solid var(--border);
        background: var(--bg-subtle);
        transition:
          transform 0.22s ease,
          right 0.22s ease;
        z-index: 60;
      }
      .rr-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 10px;
      }
      .rr-nav {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .rr-link {
        font-size: 13px;
        color: var(--text-secondary);
        padding: 5px 8px;
        border-radius: 4px;
        display: block;
        transition: all 0.15s;
        border-left: 2px solid transparent;
      }
      .rr-link:hover {
        color: var(--blue);
        background: var(--blue-light);
        border-left-color: var(--blue);
      }
      .rr-divider {
        height: 1px;
        background: var(--border);
        margin: 16px 0;
      }
      .rr-meta {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .rr-meta-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }
      .rr-meta-label {
        color: var(--text-muted);
      }
      .rr-meta-row span:last-child {
        color: var(--text-primary);
        font-weight: 500;
      }

      /* ── IMAGE VIEWER ──────────────────────────────────── */
      .viewer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .viewer-modal {
        background: #0f1b2d;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        width: 90vw;
        max-width: 1100px;
        height: 85vh;
      }
      .viewer-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: #0a1220;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
      }
      .viewer-filename {
        font-size: 12px;
        color: var(--sidebar-text);
      }
      .viewer-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .viewer-controls button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #d0dbe8;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .viewer-controls button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.18);
      }
      .viewer-controls button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .viewer-close {
        background: rgba(255, 60, 60, 0.2) !important;
        border-color: rgba(255, 60, 60, 0.3) !important;
      }
      .viewer-body {
        flex: 1;
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
      }
      .viewer-img-wrap {
        transform-origin: center;
        transition: transform 0.2s;
      }
      .viewer-img-wrap img {
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
        display: block;
      }
      .viewer-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 12px 20px;
        background: #0a1220;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
      }
      .viewer-footer button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #d0dbe8;
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      }
      .viewer-footer button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .viewer-footer span {
        font-size: 12px;
        color: var(--sidebar-text);
        font-family: 'IBM Plex Mono', monospace;
      }

      /* ── RESPONSIVE ──────────────────────────────────── */
      @media (max-width: 900px) {
        .right-rail {
          display: none;
        }
        .home-section {
          padding-left: 20px;
          padding-right: 20px;
        }
        .home-hero {
          padding: 36px 20px;
        }
        .section-content {
          padding: 24px 20px 40px;
        }
        .breadcrumb-bar {
          padding: 10px 20px;
        }
        .section-page-header {
          padding: 20px 20px 16px;
        }
        .module-listing-header {
          padding: 24px 20px;
        }
        .section-cards-list {
          padding: 16px 20px 32px;
        }
        .two-col {
          grid-template-columns: 1fr;
        }
      }
      /* Fix: pin right-rail to viewport edge on wide screens so it's not centered */
      @media (min-width: 900px) {
        .right-rail {
          position: fixed;
          right: 18px;
          top: calc(var(--navbar-h) + 12px);
          width: 260px;
          height: calc(100vh - var(--navbar-h) - 36px);
          border-left: 1px solid var(--border);
          background: var(--bg-subtle);
          box-shadow: 0 6px 22px rgba(2, 6, 23, 0.06);
        }
        .right-rail.collapsed {
          transform: translateX(120%);
        }
        /* ensure section body inner has space to accommodate fixed rail */
        .section-body-inner {
          padding-right: 300px;
        }
      }
      @media (max-width: 600px) {
        .hero-title {
          font-size: 22px;
        }
        .sidebar {
          display: none;
        }
        .slc-right {
          display: none;
        }
      }
    `,
  ],
})
export class DocsComponent implements OnInit {
  private http = inject(HttpClient);

  // ── SIGNALS ─────────────────────────────────────────
  data = signal<DocsData | null>(null);
  currentView = signal<ViewType>('home');
  selectedSection = signal<Section | null>(null);
  activeModuleKey = signal<string | null>(null);
  searchQuery = signal('');
  sidebarCollapsed = signal(false);
  expandedModules = signal<Set<string>>(new Set());
  rightRailCollapsed = signal(false);

  // Image viewer
  viewerOpen = signal(false);
  viewerImg = signal('');
  viewerIdx = signal(0);
  zoom = signal(1);

  @ViewChild('mainContent') mainContentRef?: ElementRef;

  // ── COMPUTED ─────────────────────────────────────────
  moduleKeys = computed(() => Object.keys(this.data()?.modules ?? {}));

  globalSearchResults = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q || q.length < 2) return [];
    const results: { section: Section; moduleKey: string; id: number }[] = [];
    for (const key of this.moduleKeys()) {
      const mod = this.data()!.modules[key];
      for (const section of mod.sections) {
        if (
          section.title.toLowerCase().includes(q) ||
          section.description?.toLowerCase().includes(q) ||
          section.objective?.toLowerCase().includes(q)
        ) {
          results.push({ section, moduleKey: key, id: section.id });
        }
      }
    }
    return results.sort((a, b) => a.id - b.id);
  });

  // ── INIT ─────────────────────────────────────────────
  ngOnInit() {
    this.http.get<DocsData>('/assets/data/myidex-hub-sop-complete.json').subscribe({
      next: (d) => this.data.set(d),
      error: (e) => console.error('Failed to load docs JSON', e),
    });
  }

  // ── NAVIGATION ───────────────────────────────────────
  goHome() {
    this.currentView.set('home');
    this.selectedSection.set(null);
    this.activeModuleKey.set(null);
    this.expandedModules.set(new Set());
  }

  goToModule(key: string) {
    this.activeModuleKey.set(key);
    this.currentView.set('module');
    this.selectedSection.set(null);
    this.mainContentRef?.nativeElement?.scrollTo(0, 0);
  }

  selectSection(section: Section, moduleKey: string) {
    this.activeModuleKey.set(moduleKey);
    this.selectedSection.set(section);
    this.currentView.set('section');
    // Auto-expand module in sidebar
    this.expandedModules.update((s) => new Set([...s, moduleKey]));
    setTimeout(() => this.mainContentRef?.nativeElement?.scrollTo(0, 0), 0);
  }

  nextSection() {
    const all = this.getAllSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return;
    const idx = all.findIndex((s) => s.section.id === curr);
    if (idx < all.length - 1) {
      const next = all[idx + 1];
      this.selectSection(next.section, next.moduleKey);
    }
  }

  prevSection() {
    const all = this.getAllSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return;
    const idx = all.findIndex((s) => s.section.id === curr);
    if (idx > 0) {
      const prev = all[idx - 1];
      this.selectSection(prev.section, prev.moduleKey);
    }
  }

  hasNext(): boolean {
    const all = this.getAllSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return false;
    const idx = all.findIndex((s) => s.section.id === curr);
    return idx < all.length - 1;
  }

  hasPrev(): boolean {
    const all = this.getAllSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return false;
    const idx = all.findIndex((s) => s.section.id === curr);
    return idx > 0;
  }

  getAllSections(): { section: Section; moduleKey: string }[] {
    const result: { section: Section; moduleKey: string }[] = [];
    for (const key of this.moduleKeys()) {
      for (const section of this.data()!.modules[key].sections) {
        result.push({ section, moduleKey: key });
      }
    }
    return result.sort((a, b) => a.section.id - b.section.id);
  }

  // ── SIDEBAR ──────────────────────────────────────────
  toggleModule(key: string) {
    this.expandedModules.update((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  isModuleActive(key: string): boolean {
    return this.activeModuleKey() === key;
  }

  // Wrapper used from template to toggle sidebar state (arrow functions are not allowed in templates)
  toggleSidebarCollapsed(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  // Toggle the right-hand "On this page" rail (collapsible)
  toggleRightRail(): void {
    this.rightRailCollapsed.update((v) => !v);
  }

  scrollToAnchor(key: string, ev?: Event): void {
    try {
      if (ev) ev.preventDefault();
      const el = document.getElementById(key);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      // fallback: set location hash
      location.hash = '#' + key;
    }
  }

  getFilteredSections(moduleKey: string): Section[] {
    const mod = this.data()?.modules[moduleKey];
    if (!mod) return [];
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return mod.sections;
    return mod.sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.objective?.toLowerCase().includes(q),
    );
  }

  // ── UTILITIES ────────────────────────────────────────
  getModuleMeta(key: string) {
    return MODULE_META[key] ?? DEFAULT_META;
  }

  getTotalSections(): number {
    return this.moduleKeys().reduce(
      (t, k) => t + (this.data()?.modules[k].sections.length ?? 0),
      0,
    );
  }

  getTerminologyEntries(): { key: string; value: string }[] {
    const terms = this.data()?.commonTerminology ?? {};
    return Object.entries(terms).map(([key, value]) => ({ key, value }));
  }

  getFeatureEntries(): { key: string; label: string }[] {
    const features = this.data()?.systemFeatures ?? {};
    const labels: { key: string; label: string }[] = [];
    for (const [k, v] of Object.entries(features)) {
      if (typeof v === 'object' && v !== null) {
        for (const [subK, subV] of Object.entries(v)) {
          if (subV === true) labels.push({ key: `${k}-${subK}`, label: this.toLabel(subK) });
          else if (Array.isArray(subV))
            labels.push({
              key: `${k}-${subK}`,
              label: `${this.toLabel(subK)}: ${subV.join(', ')}`,
            });
        }
      }
    }
    return labels;
  }

  // Dynamic section keys to render as generic blocks
  // Skip keys we handle explicitly
  private EXPLICIT_KEYS = new Set([
    'id',
    'title',
    'objective',
    'purpose',
    'introduction',
    'description',
    'scope',
    'responsibilities',
    'prerequisites',
    'navigation',
    'procedure',
    'steps',
    'stepsToAdd',
    'stepsToEditOrDelete',
    'stepsToEdit',
    'viewing',
    'accessing',
    'fields',
    'addingValueStream',
    'types',
    'notes',
    'screenshots',
    'pdfUrl',
    'management',
    'addProductFamily',
  ]);

  private DYNAMIC_OBJECT_KEYS = [
    'orderCreationForm',
    'orderListingPage',
    'activityStage',
    'actionButtons',
    'flowchart',
    'workflowFormPage',
    'workflowListingPage',
    'notificationSections',
    'components',
    'serviceRequestsListing',
    'customerServiceRequestForm',
    'internalTeamForm',
    'closureReportForm',
    'listingPage',
    'addUserPage',
    'customerUserSection',
    'userTypes',
    'rolePermissionMapping',
    'leftCard',
    'rightCard',
    'rightSideGraph',
    'functionTiles',
    'keyComponents',
    'detailedView',
    'recentOrderStatus',
  ];

  getDynamicObjectKeys(section: Section): string[] {
    return this.DYNAMIC_OBJECT_KEYS.filter((k) => section[k] && typeof section[k] === 'object');
  }

  getStepKeys(section: Section): string[] {
    return ['stepsToAdd', 'stepsToEditOrDelete', 'stepsToEdit', 'editingOrDeleting'].filter(
      (k) => Array.isArray(section[k]) && section[k].length > 0,
    );
  }

  getAnchors(section: Section): { key: string; label: string }[] {
    const anchors: { key: string; label: string }[] = [];
    const checks: [string, any, string][] = [
      [
        'objective',
        section['objective'] || section['purpose'] || section['introduction'],
        'Objective',
      ],
      ['description', section['description'], 'Description'],
      ['scope', section['scope'], 'Scope'],
      ['prerequisites', section['prerequisites']?.length, 'Prerequisites'],
      ['navigation', section['navigation']?.length, 'Navigation'],
      ['procedure', section['procedure'] || section['steps']?.length, 'Procedure'],
      ['accessing', section['viewing'] || section['accessing'], 'How to View/Access'],
      ['fields', section['fields']?.length, 'Fields'],
      ['addingValueStream', section['addingValueStream'], 'Adding Value Stream'],
      ['types', section['types'] && Object.keys(section['types']).length, 'Types'],
      ['notes', section['notes']?.length, 'Notes'],
      ['screenshots', section['screenshots']?.length, 'Screenshots'],
    ];
    for (const [key, condition, label] of checks) {
      if (condition) anchors.push({ key, label });
    }
    return anchors;
  }

  // Render procedure/steps arrays that can be strings or objects
  renderProcedure(arr: any[]): any[] {
    return arr.map((item) => {
      if (typeof item === 'string') return { type: 'string', text: item };
      return {
        type: 'object',
        title: item.title || item.step || '',
        details: item.details,
        substeps: item.substeps || item.details?.filter?.((d: any) => typeof d === 'string') || [],
        forMultipleInputFields: item.forMultipleInputFields,
        forSingleInputField: item.forSingleInputField,
        fieldConfiguration: item.fieldConfiguration,
      };
    });
  }

  isEmptySteps(steps: any): boolean {
    if (!steps) return true;
    if (typeof steps === 'object' && !Array.isArray(steps)) return false; // object form
    if (Array.isArray(steps) && steps.length === 0) return true;
    return false;
  }

  truncate(text: string | undefined, len: number): string {
    if (!text) return '';
    return text.length > len ? text.slice(0, len) + '…' : text;
  }

  toLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }
  isArray(val: any): val is any[] {
    return Array.isArray(val);
  }
  isString(val: any): val is string {
    return typeof val === 'string';
  }
  asArray(val: any): any[] {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return [val];
    return [];
  }

  // Return the first screenshot filename (safe, type-checked)
  firstScreenshot(section?: Section | null): string | null {
    if (!section) return null;
    const ss = section.screenshots;
    if (!Array.isArray(ss) || ss.length === 0) return null;
    return ss[0] ?? null;
  }

  // ── IMAGE VIEWER ─────────────────────────────────────
  openViewer(img: string, idx: number) {
    this.viewerImg.set(img);
    this.viewerIdx.set(idx);
    this.viewerOpen.set(true);
    this.zoom.set(1);
  }
  closeViewer() {
    this.viewerOpen.set(false);
    this.zoom.set(1);
  }
  zoomIn() {
    this.zoom.update((z) => Math.min(z + 0.25, 4));
  }
  zoomOut() {
    this.zoom.update((z) => Math.max(z - 0.25, 0.5));
  }
  resetZoom() {
    this.zoom.set(1);
  }
  onWheel(e: WheelEvent) {
    e.preventDefault();
    e.deltaY < 0 ? this.zoomIn() : this.zoomOut();
  }
  prevImg() {
    const screenshots = this.selectedSection()?.screenshots ?? [];
    const idx = this.viewerIdx();
    if (idx > 0) {
      this.viewerIdx.set(idx - 1);
      this.viewerImg.set(screenshots[idx - 1]);
      this.zoom.set(1);
    }
  }
  nextImg() {
    const screenshots = this.selectedSection()?.screenshots ?? [];
    const idx = this.viewerIdx();
    if (idx < screenshots.length - 1) {
      this.viewerIdx.set(idx + 1);
      this.viewerImg.set(screenshots[idx + 1]);
      this.zoom.set(1);
    }
  }
  onImgError(e: any) {
    e.target.style.display = 'none';
  }
}
