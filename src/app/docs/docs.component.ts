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
import { ImageViewerService } from '../services/image-viewer.service';

interface Section {
  id: number;
  title: string;
  objective?: string;
  description?: string;
  navigation?: string[];
  screenshots?: string[];
  viewing?: string;
  accessing?: string | string[];
  adding?: { steps: string[] };
  types?: Record<string, any>;
  addingValueStream?: { title: string; steps: string[] };
  [key: string]: any;
}

interface Module {
  name: string;
  description: string;
  sections: Section[];
}

interface DocumentData {
  documentInfo: {
    title: string;
    version: string;
    company: string;
    tagline: string;
    lastUpdated: string;
  };
  modules: Record<string, Module>;
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen bg-gray-50">
      <!-- SIDEBAR NAVIGATION - Collapsible -->
      @if (data() && currentView() !== 'home') {
        <aside
          class="bg-zinc-900 text-gray-100 flex flex-col border-r border-zinc-800 overflow-hidden transition-all duration-200 ease-in-out"
          [style.width]="sidebarCollapsed() ? '60px' : '280px'"
        >
          <!-- Sidebar Toggle & Header -->
          <div class="p-3 border-b border-zinc-700 flex items-center justify-between flex-shrink-0">
            <button
              (click)="toggleSidebar()"
              class="p-2 hover:bg-zinc-800 rounded text-gray-300 transition-colors"
              [title]="sidebarCollapsed() ? 'Expand' : 'Collapse'"
            >
              <span class="text-lg leading-none">{{ sidebarCollapsed() ? '▶' : '◀' }}</span>
            </button>
            @if (!sidebarCollapsed()) {
              <span class="text-xs font-bold text-gray-500 tracking-wider">NAV</span>
            }
          </div>

          <!-- Navigation Content -->
          <nav class="flex-1 overflow-y-auto p-2 space-y-0.5">
            @for (module of getNavigationItems(); track module.key) {
              <div>
                <!-- Module Header -->
                <button
                  (click)="expandModule(module.key)"
                  class="w-full text-left px-3 py-2 text-sm font-medium text-gray-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-between whitespace-nowrap"
                  [title]="sidebarCollapsed() ? module.label : ''"
                >
                  <span class="truncate" [style.display]="sidebarCollapsed() ? 'none' : 'inline'">{{
                    module.label
                  }}</span>
                  @if (!sidebarCollapsed()) {
                    <span class="text-xs flex-shrink-0 ml-2">{{
                      expandedModules().has(module.key) ? '▼' : '▶'
                    }}</span>
                  }
                </button>

                <!-- Sections Submenu -->
                @if (expandedModules().has(module.key) && !sidebarCollapsed()) {
                  <div class="bg-zinc-800 rounded my-1">
                    @for (section of module.sections; track section.id) {
                      <button
                        (click)="navigateToSection(section)"
                        class="w-full text-left px-4 py-1.5 text-xs text-gray-400 hover:bg-zinc-700 first:rounded-t last:rounded-b transition-colors truncate"
                        [class.bg-blue-600]="selectedSection()?.id === section.id"
                        [class.text-white]="selectedSection()?.id === section.id"
                        [title]="section.title"
                      >
                        {{ section.title }}
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </nav>

          <!-- Sidebar Footer -->
          @if (!sidebarCollapsed()) {
            <div
              class="p-3 border-t border-zinc-800 text-xs text-gray-500 space-y-0.5 flex-shrink-0"
            >
              <div class="font-mono">v{{ data()!.documentInfo.version }}</div>
              <div class="text-gray-600">
                {{ data()!.documentInfo.lastUpdated | date: 'MMM d, yyyy' }}
              </div>
            </div>
          }
        </aside>
      }

      <!-- MAIN CONTENT -->
      <main class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- LOADING STATE -->
        @if (isLoading()) {
          <div class="flex items-center justify-center h-full">
            <div class="space-y-4 text-center">
              <div class="inline-flex items-center justify-center">
                <div
                  class="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
                ></div>
              </div>
              <p class="text-gray-600 font-medium">Loading documentation...</p>
            </div>
          </div>
        }

        <!-- ERROR STATE -->
        @if (error() && !isLoading()) {
          <div class="flex items-center justify-center h-full px-6">
            <div class="max-w-md w-full">
              <div class="border border-red-300 rounded-lg bg-red-50 p-6">
                <h2 class="text-lg font-semibold text-red-900">Error</h2>
                <p class="mt-2 text-sm text-red-700">{{ error() }}</p>
                <button
                  (click)="loadDocumentation()"
                  class="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        }

        @if (!isLoading() && !error() && data()) {
          <!-- TOP HEADER BAR -->
          <header
            class="border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20 bg-white"
          >
            <div class="flex items-center gap-3">
              <button
                (click)="navigateToHome()"
                class="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                <span class="text-lg">▲</span>
                {{ data()!.documentInfo.title }}
              </button>
            </div>
            <div class="flex items-center gap-3">
              <input
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event).target.value)"
                type="text"
                placeholder="Search documentation..."
                class="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
              />
              <span class="text-xs font-mono text-gray-500 px-3 py-1.5 bg-gray-100 rounded">
                v{{ data()!.documentInfo.version }}
              </span>
            </div>
          </header>

          <!-- CONTENT AREA -->
          <div class="flex-1 overflow-y-auto">
            <!-- HOME VIEW -->
            @if (currentView() === 'home') {
              <div class="px-8 py-12 max-w-6xl mx-auto">
                <div class="mb-12">
                  <h1 class="text-4xl font-bold text-gray-900 mb-2">
                    {{ data()!.documentInfo.title }}
                  </h1>
                  <p class="text-lg text-gray-600">{{ data()!.documentInfo.tagline }}</p>
                </div>

                <!-- Quick Stats Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                  <div class="border border-gray-300 rounded p-4">
                    <div class="text-2xl font-bold text-gray-900">{{ getTotalSections() }}</div>
                    <p class="text-xs text-gray-600 mt-1 uppercase tracking-wide">Sections</p>
                  </div>
                  <div class="border border-gray-300 rounded p-4">
                    <div class="text-2xl font-bold text-gray-900">
                      {{ getModulesList().length }}
                    </div>
                    <p class="text-xs text-gray-600 mt-1 uppercase tracking-wide">Modules</p>
                  </div>
                  <div class="border border-gray-300 rounded p-4">
                    <div class="text-2xl font-bold text-gray-900">{{ getTotalScreenshots() }}+</div>
                    <p class="text-xs text-gray-600 mt-1 uppercase tracking-wide">Screenshots</p>
                  </div>
                  <div class="border border-gray-300 rounded p-4">
                    <div class="text-2xl font-bold text-gray-900">
                      {{ data()!.documentInfo.lastUpdated | date: 'yyyy' }}
                    </div>
                    <p class="text-xs text-gray-600 mt-1 uppercase tracking-wide">Updated</p>
                  </div>
                </div>

                <!-- Modules Grid -->
                <h2 class="text-xl font-semibold text-gray-900 mb-6">Modules</h2>
                <div class="grid md:grid-cols-2 gap-4">
                  @for (module of getModulesList(); track module.key) {
                    <button
                      (click)="navigateToModule(module.key)"
                      class="text-left border border-gray-300 rounded p-6 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <h3 class="font-semibold text-gray-900">{{ module.value.name }}</h3>
                      <p class="text-sm text-gray-600 mt-2">{{ module.value.description }}</p>
                      <div class="mt-4 text-xs text-gray-500">
                        {{ module.value.sections.length }} sections
                      </div>
                    </button>
                  }
                </div>
              </div>
            }

            <!-- DOCUMENTATION VIEW -->
            @if (currentView() === 'section' && selectedSection()) {
              <div class="px-8 py-8 max-w-4xl mx-auto">
                <!-- Breadcrumbs -->
                <nav class="flex items-center gap-1 text-sm text-gray-600 mb-8">
                  <button (click)="navigateToHome()" class="text-blue-600 hover:underline">
                    Home
                  </button>
                  <span class="text-gray-400">/</span>
                  <button
                    (click)="navigateToModule(currentModuleKey())"
                    class="text-blue-600 hover:underline"
                  >
                    {{ currentModule()?.name }}
                  </button>
                  <span class="text-gray-400">/</span>
                  <span class="text-gray-900 font-medium">{{ selectedSection()?.title }}</span>
                </nav>

                <!-- Section Header -->
                <header class="mb-8">
                  <div class="flex items-start justify-between gap-4 mb-4">
                    <h1 class="text-3xl font-bold text-gray-900">{{ selectedSection()?.title }}</h1>
                    <span class="text-xs font-mono text-gray-500 px-3 py-1 bg-gray-100 rounded">
                      Section {{ selectedSection()?.id }}
                    </span>
                  </div>

                  @if (selectedSection()?.objective) {
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                      <h3 class="text-sm font-semibold text-blue-900 mb-1">Objective</h3>
                      <p class="text-sm text-blue-800">{{ selectedSection()?.objective }}</p>
                    </div>
                  }

                  @if (selectedSection()?.description) {
                    <p class="text-gray-700 leading-relaxed whitespace-pre-line">
                      {{ selectedSection()?.description }}
                    </p>
                  }
                </header>

                <!-- Navigation Steps -->
                @if (selectedSection()?.navigation && selectedSection()!.navigation!.length > 0) {
                  <section class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Navigation Steps</h2>
                    <ol class="space-y-2 bg-gray-50 p-4 rounded border border-gray-200">
                      @for (step of selectedSection()?.navigation; let i = $index; track i) {
                        <li class="flex gap-3">
                          <span
                            class="flex-shrink-0 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700"
                          >
                            {{ i + 1 }}
                          </span>
                          <span class="text-gray-700">{{ step }}</span>
                        </li>
                      }
                    </ol>
                  </section>
                }

                <!-- Viewing & Accessing -->
                <div class="grid md:grid-cols-2 gap-6 mb-8">
                  @if (selectedSection()?.viewing) {
                    <section class="border border-gray-200 rounded p-4">
                      <h3 class="font-semibold text-gray-900 mb-2">How to View</h3>
                      @if (typeof selectedSection()!.viewing === 'string') {
                        <p class="text-sm text-gray-700">{{ selectedSection()?.viewing }}</p>
                      } @else {
                        <ul class="space-y-1 text-sm">
                          @for (item of selectedSection()?.viewing || []; track $index) {
                            <li class="flex gap-2 text-gray-700">
                              <span class="text-gray-400 flex-shrink-0">•</span>
                              <span>{{ item }}</span>
                            </li>
                          }
                        </ul>
                      }
                    </section>
                  }

                  @if (selectedSection()?.accessing) {
                    <section class="border border-gray-200 rounded p-4">
                      <h3 class="font-semibold text-gray-900 mb-2">How to Access</h3>
                      @if (typeof selectedSection()!.accessing === 'string') {
                        <p class="text-sm text-gray-700">{{ selectedSection()?.accessing }}</p>
                      } @else {
                        <ul class="space-y-1 text-sm">
                          @for (item of selectedSection()?.accessing || []; track $index) {
                            <li class="flex gap-2 text-gray-700">
                              <span class="text-gray-400 flex-shrink-0">•</span>
                              <span>{{ item }}</span>
                            </li>
                          }
                        </ul>
                      }
                    </section>
                  }
                </div>

                <!-- Adding/Procedures -->
                @if ((selectedSection()?.adding?.steps?.length ?? 0) > 0) {
                  <section class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">How to Add</h2>
                    <ol class="space-y-3 bg-blue-50 p-6 rounded border border-blue-200">
                      @for (step of selectedSection()?.adding?.steps; let i = $index; track i) {
                        <li class="flex gap-4">
                          <span
                            class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold"
                          >
                            {{ i + 1 }}
                          </span>
                          <span class="text-gray-800 pt-0.5">{{ step }}</span>
                        </li>
                      }
                    </ol>
                  </section>
                }

                <!-- Nested Types/Categories -->
                @if (selectedSection()?.types) {
                  <section class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Types & Categories</h2>
                    <div class="space-y-3">
                      @for (
                        entry of getObjectEntries(selectedSection()!.types || {});
                        track entry[0]
                      ) {
                        <details class="border border-gray-300 rounded group">
                          <summary
                            class="px-4 py-3 cursor-pointer font-medium text-gray-900 hover:bg-gray-50 transition-colors list-none flex justify-between items-center"
                          >
                            <span>{{ entry[0] }}</span>
                            <span class="text-gray-400 group-open:rotate-180 transition-transform"
                              >▼</span
                            >
                          </summary>
                          <div class="px-4 py-3 bg-gray-50 border-t border-gray-200">
                            @if (isArray(entry[1])) {
                              <ul class="space-y-1">
                                @for (item of entry[1]; track $index) {
                                  <li class="text-sm text-gray-700 flex gap-2">
                                    <span class="text-gray-400">•</span>
                                    <span>{{ item }}</span>
                                  </li>
                                }
                              </ul>
                            } @else if (typeof entry[1] === 'object') {
                              <div class="text-sm text-gray-700 space-y-1">
                                @for (prop of getObjectEntries(entry[1]); track prop[0]) {
                                  <div>
                                    <span class="font-medium text-gray-900">{{ prop[0] }}:</span>
                                    <span class="text-gray-700 ml-2">{{ prop[1] }}</span>
                                  </div>
                                }
                              </div>
                            } @else {
                              <p class="text-sm text-gray-700">{{ entry[1] }}</p>
                            }
                          </div>
                        </details>
                      }
                    </div>
                  </section>
                }

                <!-- Value Streams -->
                @if (selectedSection()?.addingValueStream) {
                  <section class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">
                      {{ selectedSection()?.addingValueStream?.title }}
                    </h2>
                    <ol class="space-y-3 bg-green-50 p-6 rounded border border-green-200">
                      @for (
                        step of selectedSection()?.addingValueStream?.steps;
                        let i = $index;
                        track i
                      ) {
                        <li class="flex gap-4">
                          <span
                            class="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold"
                          >
                            {{ i + 1 }}
                          </span>
                          <span class="text-gray-800 pt-0.5">{{ step }}</span>
                        </li>
                      }
                    </ol>
                  </section>
                }

                <!-- Screenshots Gallery -->
                @if (selectedSection()?.screenshots && selectedSection()!.screenshots!.length > 0) {
                  <section class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Screenshots</h2>
                    <div class="grid gap-4">
                      @for (screenshot of selectedSection()?.screenshots; let i = $index; track i) {
                        <div
                          class="border border-gray-300 rounded overflow-hidden bg-gray-50 group cursor-pointer hover:border-blue-400 transition-colors"
                          (click)="openImageModal(screenshot)"
                        >
                          <div class="relative aspect-video overflow-hidden bg-gray-100">
                            <img
                              [src]="'/assets/images/screenshots/' + screenshot"
                              [alt]="'Screenshot ' + (i + 1)"
                              class="w-full h-full object-contain group-hover:opacity-90 transition-opacity"
                              (error)="onImageError($event, screenshot)"
                            />
                            <div
                              class="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-10 transition-opacity flex items-center justify-center"
                            >
                              <span class="text-white font-medium text-sm">Click to zoom</span>
                            </div>
                          </div>
                          <div class="px-3 py-2 border-t border-gray-300">
                            <p class="text-xs text-gray-600 font-mono truncate">{{ screenshot }}</p>
                          </div>
                        </div>
                      }
                    </div>
                  </section>
                }

                <!-- Navigation Controls -->
                <div
                  class="flex justify-between items-center mt-12 pt-8 border-t border-gray-200 gap-4"
                >
                  <button
                    (click)="previousSection()"
                    [disabled]="!canNavigatePrevious()"
                    class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <span class="text-sm text-gray-600 font-mono">
                    {{ selectedSection()?.id }} / {{ getTotalSections() }}
                  </span>
                  <button
                    (click)="nextSection()"
                    [disabled]="!canNavigateNext()"
                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </main>
    </div>

    <!-- IMAGE VIEWER MODAL -->
    @if (imageViewerService.selectedImage()) {
      <div
        class="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col"
        (click)="imageViewerService.closeImage()"
        (keydown)="onImageKeydown($event)"
        tabindex="0"
      >
        <!-- Header Bar -->
        <div
          class="bg-gray-900 border-b border-gray-700 px-6 py-3 flex justify-between items-center flex-shrink-0"
        >
          <h2 class="text-white font-medium text-sm">Image Viewer</h2>
          <button
            (click)="imageViewerService.closeImage()"
            class="text-gray-400 hover:text-white text-2xl font-light"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <!-- Image Container -->
        <div
          class="flex-1 flex items-center justify-center bg-black overflow-auto"
          (click)="$event.stopPropagation()"
          (mousedown)="onImageMouseDown($event)"
          (mousemove)="onImageMouseMove($event)"
          (mouseup)="imageViewerService.endDrag()"
          (mouseleave)="imageViewerService.endDrag()"
        >
          <img
            [src]="'/assets/images/screenshots/' + imageViewerService.selectedImage()!"
            [alt]="imageViewerService.selectedImage()!"
            class="max-w-5xl max-h-[calc(100vh-120px)] object-contain"
            (load)="onImageLoad()"
          />
        </div>

        <!-- Footer-->
        <div
          class="bg-gray-900 border-t border-gray-700 px-6 py-4 flex justify-center gap-3 flex-shrink-0"
        >
          <button
            (click)="previousImage()"
            [disabled]="currentImageIndex() === 0"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded text-sm font-medium transition-colors"
          >
            ← Previous
          </button>
          <button
            (click)="imageViewerService.closeImage()"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
          >
            Close
          </button>
          <button
            (click)="nextImage()"
            [disabled]="currentImageIndex() + 1 >= (selectedSection()?.screenshots?.length ?? 0)"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded text-sm font-medium transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }

      details > summary::-webkit-details-marker {
        display: none;
      }
    `,
  ],
})
export class DocsComponent implements OnInit {
  private http = inject(HttpClient);
  readonly imageViewerService = inject(ImageViewerService);
  @ViewChild('contentArea') contentAreaRef?: ElementRef;

  // Signals
  data = signal<DocumentData | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  currentView = signal<'home' | 'section'>('home');
  selectedSection = signal<Section | null>(null);
  currentModuleKey = signal<string>('');
  searchQuery = signal('');
  currentImageIndex = signal(0);
  sidebarCollapsed = signal(false);
  expandedModules = signal<Set<string>>(new Set());

  // Computed
  currentModule = computed(() => {
    const key = this.currentModuleKey();
    const modules = this.data()?.modules;
    return key && modules ? modules[key] : null;
  });

  ngOnInit(): void {
    this.loadDocumentation();
  }

  loadDocumentation(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<DocumentData>('/assets/myidex-hub-sop-data.json').subscribe({
      next: (result) => {
        this.data.set(result);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(`Failed to load documentation: ${err.message}`);
        this.isLoading.set(false);
      },
    });
  }

  getModulesList() {
    return this.data()
      ? Object.entries(this.data()!.modules).map(([key, value]) => ({ key, value }))
      : [];
  }

  getNavigationItems() {
    const modules = this.getModulesList();
    return modules.map((m) => ({
      key: m.key,
      label: m.value.name,
      sections: m.value.sections,
    }));
  }

  getTotalSections(): number {
    if (!this.data()) return 0;
    return Object.values(this.data()!.modules).reduce(
      (sum, module) => sum + module.sections.length,
      0,
    );
  }

  getTotalScreenshots(): number {
    if (!this.data()) return 0;
    let count = 0;
    Object.values(this.data()!.modules).forEach((module) => {
      module.sections.forEach((section) => {
        count += section.screenshots?.length || 0;
      });
    });
    return count;
  }

  getObjectEntries(obj: Record<string, any> | undefined): [string, any][] {
    return Object.entries(obj || {});
  }

  isArray(val: any): boolean {
    return Array.isArray(val);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  expandModule(key: string): void {
    this.expandedModules.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }

  navigateToHome(): void {
    this.currentView.set('home');
    this.selectedSection.set(null);
    this.currentModuleKey.set('');
  }

  navigateToModule(key: string): void {
    this.currentModuleKey.set(key);
    this.currentView.set('section');
    this.expandModule(key);
    const module = this.data()?.modules[key];
    if (module && module.sections.length > 0) {
      this.navigateToSection(module.sections[0]);
    }
  }

  navigateToSection(section: Section): void {
    this.selectedSection.set(section);
    this.currentView.set('section');
    this.currentImageIndex.set(0);
  }

  nextSection(): void {
    const current = this.selectedSection()?.id;
    if (current) {
      const allSections = this.getAllSections();
      const next = allSections.find((s) => s.id === current + 1);
      if (next) this.navigateToSection(next);
    }
  }

  previousSection(): void {
    const current = this.selectedSection()?.id;
    if (current && current > 1) {
      const allSections = this.getAllSections();
      const prev = allSections.find((s) => s.id === current - 1);
      if (prev) this.navigateToSection(prev);
    }
  }

  canNavigateNext(): boolean {
    const current = this.selectedSection()?.id;
    return current !== undefined && current < this.getTotalSections();
  }

  canNavigatePrevious(): boolean {
    const current = this.selectedSection()?.id;
    return current !== undefined && current > 1;
  }

  getAllSections(): Section[] {
    const sections: Section[] = [];
    if (this.data()) {
      Object.values(this.data()!.modules).forEach((module) => {
        sections.push(...module.sections);
      });
    }
    return sections.sort((a, b) => a.id - b.id);
  }

  openImageModal(screenshot: string): void {
    this.imageViewerService.openImage(screenshot);
    const screenshots = this.selectedSection()?.screenshots || [];
    this.currentImageIndex.set(screenshots.indexOf(screenshot));
  }

  nextImage(): void {
    const screenshots = this.selectedSection()?.screenshots || [];
    const idx = this.currentImageIndex();
    if (idx < screenshots.length - 1) {
      this.currentImageIndex.set(idx + 1);
      this.imageViewerService.openImage(screenshots[idx + 1]);
    }
  }

  previousImage(): void {
    const screenshots = this.selectedSection()?.screenshots || [];
    const idx = this.currentImageIndex();
    if (idx > 0) {
      this.currentImageIndex.set(idx - 1);
      this.imageViewerService.openImage(screenshots[idx - 1]);
    }
  }

  onImageMouseDown(event: MouseEvent): void {
    this.imageViewerService.startDrag(event.clientX, event.clientY);
  }

  onImageMouseMove(event: MouseEvent): void {
    if (this.imageViewerService.isImageDragging()) {
      this.imageViewerService.updateDrag(event.clientX, event.clientY);
    }
  }

  onImageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.imageViewerService.closeImage();
    } else if (event.key === 'ArrowLeft') {
      this.previousImage();
    } else if (event.key === 'ArrowRight') {
      this.nextImage();
    }
  }

  onImageLoad(): void {
    // Image loaded
  }

  onImageError(event: any, screenshot: string): void {
    console.warn(`Failed to load image: ${screenshot}`);
  }
}
