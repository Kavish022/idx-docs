import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
const MODULE_META: Record<string, { color: string; accent: string }> = {
  master: { color: '#0f62fe', accent: '#eaf1ff' },
  users: { color: '#6929c4', accent: '#f3eeff' },
  orders: { color: '#005d5d', accent: '#e3f6f6' },
  dashboard: { color: '#9f1853', accent: '#fff0f4' },
  service: { color: '#b28600', accent: '#fef9e7' },
};
const DEFAULT_META = { icon: '[Doc]', color: '#0972d3', accent: '#eaf1ff' };

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: `./docs.component.html`,
  styleUrl: `./docs.component.scss`,
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

  @ViewChild('mainContent', { static: false }) mainContentRef?: ElementRef;

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
  // to destroy the trash data immediately after callbacks
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.http
      .get<DocsData>('/assets/data/myidex-hub-sop-complete.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    const firstSection = this.data()?.modules[key]?.sections[0];
    if (firstSection) {
      this.selectSection(firstSection, key);
    }
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
    const all = this.allSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return;
    const idx = all.findIndex((s) => s.section.id === curr);
    if (idx < all.length - 1) {
      const next = all[idx + 1];
      this.selectSection(next.section, next.moduleKey);
    }
  }

  prevSection() {
    const all = this.allSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return;
    const idx = all.findIndex((s) => s.section.id === curr);
    if (idx > 0) {
      const prev = all[idx - 1];
      this.selectSection(prev.section, prev.moduleKey);
    }
  }

  hasNext(): boolean {
    const all = this.allSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return false;
    const idx = all.findIndex((s) => s.section.id === curr);
    return idx < all.length - 1;
  }

  hasPrev(): boolean {
    const all = this.allSections();
    const curr = this.selectedSection()?.id;
    if (curr === undefined) return false;
    const idx = all.findIndex((s) => s.section.id === curr);
    return idx > 0;
  }

  // getAllSections(): { section: Section; moduleKey: string }[] {
  //   const result: { section: Section; moduleKey: string }[] = [];
  //   for (const key of this.moduleKeys()) {
  //     for (const section of this.data()!.modules[key].sections) {
  //       result.push({ section, moduleKey: key });
  //     }
  //   }
  //   return result.sort((a, b) => a.section.id - b.section.id);
  // }

  allSections = computed(() => {
    if (!this.data()) return [];
    const result: { section: Section; moduleKey: string }[] = [];
    for (const key of this.moduleKeys()) {
      for (const section of this.data()!.modules[key].sections) {
        result.push({ section, moduleKey: key });
      }
    }
    return result.sort((a, b) => a.section.id - b.section.id);
  });

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
    if (ev) ev.preventDefault();
    // Set location hash - browser will automatically apply :target selector
    location.hash = '#' + key;
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

  // getTotalSections(): number {
  //   return this.moduleKeys().reduce(
  //     (t, k) => t + (this.data()?.modules[k].sections.length ?? 0),
  //     0,
  //   );
  // }
  //  ----- TO take all sections -------

  totalSections = computed(() =>
    this.moduleKeys().reduce((t, k) => t + (this.data()?.modules[k].sections.length ?? 0), 0),
  );
  // ------
  // Memoized getters to avoid re-computation on every change detection cycle
  terminologyEntries = computed(() => {
    const terms = this.data()?.commonTerminology ?? {};
    return Object.entries(terms).map(([key, value]) => ({ key, value }));
  });

  featureEntries = computed(() => {
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
  });

  // Deprecated: kept for backward compatibility
  getTerminologyEntries(): { key: string; value: string }[] {
    return this.terminologyEntries();
  }

  getFeatureEntries(): { key: string; label: string }[] {
    return this.featureEntries();
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

  // private DYNAMIC_OBJECT_KEYS = [
  //   'orderCreationForm',
  //   'orderListingPage',
  //   'activityStage',
  //   'actionButtons',
  //   'flowchart',
  //   'workflowFormPage',
  //   'workflowListingPage',
  //   'notificationSections',
  //   'components',
  //   'serviceRequestsListing',
  //   'customerServiceRequestForm',
  //   'internalTeamForm',
  //   'closureReportForm',
  //   'listingPage',
  //   'addUserPage',
  //   'customerUserSection',
  //   'userTypes',
  //   'rolePermissionMapping',
  //   'leftCard',
  //   'rightCard',
  //   'rightSideGraph',
  //   'functionTiles',
  //   'keyComponents',
  //   'detailedView',
  //   'recentOrderStatus',
  // ];

  // getDynamicObjectKeys(section: Section): string[] {
  //   return this.DYNAMIC_OBJECT_KEYS.filter((k) => section[k] && typeof section[k] === 'object');
  // }
  getDynamicObjectKeys(section: Section): string[] {
    return Object.keys(section).filter(
      (k) =>
        !this.EXPLICIT_KEYS.has(k) && typeof section[k] === 'object' && !Array.isArray(section[k]),
    );
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

  isProcedureValid(procedure: any): boolean {
    return Array.isArray(procedure) && procedure.length > 0;
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

  // Typed event handler for search input (avoids $any() casts)
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }
}
