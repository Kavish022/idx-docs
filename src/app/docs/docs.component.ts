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

// Data interfaces for myidex-hub-sop-complete.json
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
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="min-h-screen bg-white">
      <!-- LOADING STATE -->
      @if (isLoading()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div class="text-center">
            <div
              class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"
            ></div>
            <p class="text-gray-700 font-semibold">Loading documentation...</p>
          </div>
        </div>
      }

      <!-- ERROR STATE -->
      @if (error()) {
        <div class="bg-red-50 border-b border-red-300 px-8 py-6">
          <div class="flex justify-between items-center max-w-7xl mx-auto">
            <div>
              <h3 class="text-red-900 font-bold text-lg">⚠️ Error Loading Documentation</h3>
              <p class="text-red-700 text-sm mt-2">{{ error() }}</p>
            </div>
            <button
              (click)="loadDocumentation()"
              class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      }

      @if (data()) {
        <!-- NAVBAR -->
        <nav
          class="sticky top-0 z-40 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 border-b-2 border-blue-800 px-8 py-4 shadow-lg"
        >
          <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div
              class="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
              (click)="navigateToHome()"
            >
              <div
                class="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-bold text-lg"
              >
                📚
              </div>
              <div>
                <h1 class="text-white font-bold text-xl">{{ data()!.documentInfo.title }}</h1>
                <p class="text-blue-100 text-xs">{{ data()!.documentInfo.tagline }}</p>
              </div>
            </div>
            <div class="flex-1 max-w-lg mx-8">
              <input
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event).target.value)"
                type="text"
                placeholder="🔍 Search sections..."
                class="w-full bg-blue-500 placeholder-blue-200 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <span class="bg-white text-blue-700 text-xs px-3 py-1 rounded-full font-bold"
              >v{{ data()!.documentInfo.version }}</span
            >
          </div>
        </nav>

        <!-- HOME VIEW -->
        @if (currentView() === 'home') {
          <div
            class="bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-[calc(100vh-80px)] py-16"
          >
            <div class="max-w-7xl mx-auto px-8">
              <!-- Hero Section -->
              <div class="text-center mb-16">
                <h2 class="text-5xl font-bold text-gray-900 mb-4">📖 MyIDEX HUB Documentation</h2>
                <p class="text-xl text-gray-600 mb-8">
                  Complete Standard Operating Procedures for 41+ sections
                </p>
                <p class="text-gray-500">
                  Explore our comprehensive guides, tutorials, and best practices
                </p>
              </div>

              <!-- Modules Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (module of getModulesList(); track module.key) {
                  <div
                    (click)="navigateToModule(module.key)"
                    class="bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-2xl hover:border-blue-400 p-8 cursor-pointer transition-all duration-300 group"
                  >
                    <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">
                      {{ getModuleEmoji(module.key) }}
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600">
                      {{ module.value.name }}
                    </h3>
                    <p class="text-gray-600 text-sm mb-4">{{ module.value.description }}</p>
                    <div class="flex items-center justify-between">
                      <span
                        class="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full"
                      >
                        {{ module.value.sections.length }} sections
                      </span>
                      <span class="text-blue-600 group-hover:translate-x-1 transition-transform"
                        >→</span
                      >
                    </div>
                  </div>
                }
              </div>

              <!-- Quick Stats -->
              <div class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-blue-100 rounded-lg p-6 text-center">
                  <div class="text-3xl font-bold text-blue-700">41</div>
                  <p class="text-blue-600 text-sm font-semibold mt-2">Sections</p>
                </div>
                <div class="bg-purple-100 rounded-lg p-6 text-center">
                  <div class="text-3xl font-bold text-purple-700">5</div>
                  <p class="text-purple-600 text-sm font-semibold mt-2">Modules</p>
                </div>
                <div class="bg-green-100 rounded-lg p-6 text-center">
                  <div class="text-3xl font-bold text-green-700">74+</div>
                  <p class="text-green-600 text-sm font-semibold mt-2">Screenshots</p>
                </div>
                <div class="bg-orange-100 rounded-lg p-6 text-center">
                  <div class="text-3xl font-bold text-orange-700">2024</div>
                  <p class="text-orange-600 text-sm font-semibold mt-2">Updated</p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- MODULE VIEW -->
        @if (currentView() === 'module' && currentModule()) {
          <div class="min-h-[calc(100vh-80px)] bg-gray-50 py-12">
            <div class="max-w-7xl mx-auto px-8">
              <!-- Breadcrumb -->
              <button
                (click)="navigateToHome()"
                class="text-blue-600 hover:text-blue-800 font-semibold mb-6"
              >
                ← Back to Home
              </button>

              <div class="mb-12">
                <h2 class="text-4xl font-bold text-gray-900 mb-3">{{ currentModule()!.name }}</h2>
                <p class="text-lg text-gray-600">{{ currentModule()!.description }}</p>
              </div>

              <!-- Sections Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (section of currentModule()!.sections; track section.id) {
                  <div
                    (click)="navigateToSection(section)"
                    class="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg p-6 cursor-pointer transition-all group"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <h3
                        class="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex-1"
                      >
                        {{ section.title }}
                      </h3>
                      <span class="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded"
                        >#{{ section.id }}</span
                      >
                    </div>
                    <p class="text-gray-600 text-sm line-clamp-2 mb-4">
                      {{ section.objective || section.description }}
                    </p>
                    <div class="flex items-center justify-between">
                      @if (section.screenshots && section.screenshots.length > 0) {
                        <span class="text-xs text-gray-500"
                          >📸 {{ section.screenshots.length }} images</span
                        >
                      }
                      <span class="text-blue-600 group-hover:translate-x-1 transition-transform"
                        >→</span
                      >
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- SECTION DETAIL VIEW -->
        @if (currentView() === 'detail' && selectedSection()) {
          <div class="flex h-[calc(100vh-80px)]">
            <!-- LEFT SIDEBAR - Navigation -->
            <aside class="w-72 bg-gray-900 border-r border-gray-700 overflow-y-auto sticky top-16">
              <div class="p-6">
                <button
                  (click)="navigateToHome()"
                  class="text-blue-400 hover:text-blue-300 text-sm font-semibold mb-4 block"
                >
                  ← Home
                </button>
                <button
                  (click)="navigateToModule(currentModuleKey())"
                  class="text-blue-400 hover:text-blue-300 text-sm font-semibold mb-6 block"
                >
                  ← {{ currentModule()!.name }}
                </button>

                <p class="text-xs font-bold text-gray-500 uppercase mb-4">📋 All Sections</p>
                <div class="space-y-1 max-h-96 overflow-y-auto">
                  @for (section of currentModule()!.sections; track section.id) {
                    <button
                      (click)="navigateToSection(section)"
                      [class.bg-blue-600]="selectedSection()!.id === section.id"
                      [class.text-white]="selectedSection()!.id === section.id"
                      [class.text-gray-400]="selectedSection()!.id !== section.id"
                      class="w-full text-left px-3 py-2 text-sm rounded transition-colors hover:bg-gray-700 hover:text-white"
                    >
                      {{ section.title }}
                    </button>
                  }
                </div>
              </div>
            </aside>

            <!-- MAIN CONTENT -->
            <main #contentArea class="flex-1 overflow-y-auto bg-white">
              <div class="max-w-4xl mx-auto px-8 py-12">
                <!-- Header -->
                <div class="mb-12">
                  <div class="flex items-center justify-between mb-4">
                    <h1 class="text-5xl font-bold text-gray-900">{{ selectedSection()!.title }}</h1>
                    <span class="text-sm font-bold bg-blue-100 text-blue-700 px-4 py-2 rounded-full"
                      >Section {{ selectedSection()!.id }}/41</span
                    >
                  </div>
                  <p class="text-gray-500 text-sm">
                    📅 Updated: {{ data()!.documentInfo.lastUpdated }}
                  </p>
                </div>

                <!-- OBJECTIVE -->
                @if (selectedSection()!.objective) {
                  <div class="bg-blue-50 border-l-4 border-blue-500 p-6 rounded mb-8">
                    <h2 class="text-lg font-bold text-blue-900 mb-2">🎯 Objective</h2>
                    <p class="text-blue-800">{{ selectedSection()!.objective }}</p>
                  </div>
                }

                <!-- DESCRIPTION -->
                @if (selectedSection()!.description) {
                  <div class="mb-10">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">📝 Description</h2>
                    <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {{ selectedSection()!.description }}
                    </p>
                  </div>
                }

                <!-- NAVIGATION -->
                @if (selectedSection()!.navigation && selectedSection()!.navigation!.length > 0) {
                  <div class="mb-10">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">🔍 Navigation</h2>
                    <div class="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <ol class="space-y-3">
                        @for (nav of selectedSection()!.navigation; let idx = $index; track nav) {
                          <li class="flex gap-3">
                            <span
                              class="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm"
                              >{{ idx + 1 }}</span
                            >
                            <span class="text-gray-700 pt-0.5">{{ nav }}</span>
                          </li>
                        }
                      </ol>
                    </div>
                  </div>
                }

                <!-- VIEWING/ACCESSING -->
                @if (selectedSection()!.viewing || selectedSection()!.accessing) {
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    @if (selectedSection()!.viewing) {
                      <div class="bg-purple-50 p-6 rounded-lg border border-purple-200">
                        <h3 class="font-bold text-purple-900 mb-3">👁️ Viewing</h3>
                        <p class="text-purple-800 text-sm">{{ selectedSection()!.viewing }}</p>
                      </div>
                    }
                    @if (selectedSection()!.accessing) {
                      <div class="bg-green-50 p-6 rounded-lg border border-green-200">
                        <h3 class="font-bold text-green-900 mb-3">🔓 Accessing</h3>
                        @if (typeof selectedSection()!.accessing === 'string') {
                          <p class="text-green-800 text-sm">{{ selectedSection()!.accessing }}</p>
                        } @else {
                          <ul class="space-y-2">
                            @for (item of selectedSection()!.accessing || []; track $index) {
                              <li class="text-green-800 text-sm flex gap-2">
                                <span>•</span>
                                <span>{{ item }}</span>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    }
                  </div>
                }

                <!-- ADDING/PROCEDURES -->
                @if ((selectedSection()!.adding?.steps?.length ?? 0) > 0) {
                  <div class="mb-10">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">➕ How to Add</h2>
                    <div class="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                      <ol class="space-y-4">
                        @for (
                          step of selectedSection()!.adding?.steps || [];
                          let idx = $index;
                          track step
                        ) {
                          <li class="flex gap-4">
                            <span
                              class="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm"
                              >{{ idx + 1 }}</span
                            >
                            <span class="text-indigo-900 pt-1">{{ step }}</span>
                          </li>
                        }
                      </ol>
                    </div>
                  </div>
                }

                <!-- PAYMENT TERMS SPECIAL LAYOUT -->
                @if (selectedSection()!.id === 5 && selectedSection()!.types) {
                  <div class="mb-10">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6">💳 Payment Term Types</h2>
                    <div class="space-y-8">
                      @for (
                        typeKey of getTypeKeys(selectedSection()!.types || {});
                        let idx = $index;
                        track typeKey
                      ) {
                        <div class="border-2 border-blue-300 rounded-lg p-8 bg-blue-50">
                          <div class="flex items-center gap-4 mb-6 pb-4 border-b-2 border-blue-300">
                            <div
                              class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg"
                            >
                              {{ idx + 1 }}
                            </div>
                            <h3 class="text-2xl font-bold text-gray-900">
                              {{ selectedSection()!.types![typeKey].name }}
                            </h3>
                          </div>

                          @if (selectedSection()!.types![typeKey].description) {
                            <div class="mb-6">
                              <h4 class="font-bold text-gray-900 mb-2">📋 Description</h4>
                              <p class="text-gray-700">
                                {{ selectedSection()!.types![typeKey].description }}
                              </p>
                            </div>
                          }

                          @if (selectedSection()!.types![typeKey].navigation) {
                            <div class="mb-6">
                              <h4 class="font-bold text-gray-900 mb-3">🔍 Navigation</h4>
                              <ul class="space-y-2 ml-4">
                                @for (
                                  nav of selectedSection()!.types![typeKey].navigation;
                                  track nav
                                ) {
                                  <li class="flex gap-2 text-gray-700">
                                    <span>•</span>
                                    <span>{{ nav }}</span>
                                  </li>
                                }
                              </ul>
                            </div>
                          }

                          @if (selectedSection()!.types![typeKey].adding?.steps) {
                            <div>
                              <h4 class="font-bold text-gray-900 mb-3">➕ Steps to Add</h4>
                              <ol class="space-y-3 ml-4">
                                @for (
                                  step of selectedSection()!.types![typeKey].adding.steps;
                                  let sidx = $index;
                                  track step
                                ) {
                                  <li class="flex gap-3">
                                    <span
                                      class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold"
                                      >{{ sidx + 1 }}</span
                                    >
                                    <span class="text-gray-700 pt-0.5">{{ step }}</span>
                                  </li>
                                }
                              </ol>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- VALUE STREAMS SPECIAL LAYOUT -->
                @if (selectedSection()!.addingValueStream) {
                  <div class="mb-10">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6">
                      {{ selectedSection()!.addingValueStream?.title }}
                    </h2>
                    <div class="bg-purple-50 rounded-lg p-8 border border-purple-300">
                      <ol class="space-y-4">
                        @for (
                          step of selectedSection()!.addingValueStream?.steps || [];
                          let idx = $index;
                          track step
                        ) {
                          <li class="flex gap-4">
                            <span
                              class="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold"
                              >{{ idx + 1 }}</span
                            >
                            <span class="text-purple-900 pt-1">{{ step }}</span>
                          </li>
                        }
                      </ol>
                    </div>
                  </div>
                }

                <!-- SCREENSHOTS GALLERY -->
                @if (selectedSection()!.screenshots?.length) {
                  <div class="mb-10">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6">📸 Screenshots</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      @for (screenshot of selectedSection()!.screenshots; track screenshot) {
                        <div
                          class="border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl cursor-pointer transition-all group"
                          (click)="openImageModal(screenshot)"
                        >
                          <div
                            class="aspect-video bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors overflow-hidden"
                          >
                            <img
                              [src]="'/assets/images/screenshots/' + screenshot"
                              [alt]="screenshot"
                              class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                              (error)="onImageError($event, screenshot)"
                            />
                          </div>
                          <div class="p-3 bg-gray-50 border-t">
                            <p class="text-xs text-gray-600 font-mono truncate">{{ screenshot }}</p>
                            <p class="text-xs text-gray-500 mt-1">🔍 Click to view fullscreen</p>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- NAVIGATION BUTTONS -->
                <div class="mt-16 pt-8 border-t-2 border-gray-200 flex justify-between gap-4">
                  <button
                    (click)="previousSection()"
                    [disabled]="selectedSection()!.id <= 1"
                    class="px-6 py-3 bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    ← Previous Section
                  </button>
                  <button
                    (click)="nextSection()"
                    [disabled]="selectedSection()!.id >= 41"
                    class="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    Next Section →
                  </button>
                </div>
              </div>
            </main>
          </div>
        }

        <!-- IMAGE MODAL -->
        @if (imageViewerService.selectedImage()) {
          <div
            class="fixed inset-0 bg-black bg-opacity-95 flex flex-col z-50"
            (click)="imageViewerService.closeImage()"
            (keydown)="onImageKeydown($event)"
            tabindex="0"
          >
            <div
              class="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center"
            >
              <div class="flex items-center gap-4">
                <h2 class="text-white font-bold">🖼️ Full Screen View</h2>
                <p class="text-gray-400 text-sm font-mono">
                  {{ imageViewerService.selectedImage() }}
                </p>
              </div>
              <button
                (click)="imageViewerService.closeImage()"
                class="text-gray-400 hover:text-white text-3xl"
              >
                ✕
              </button>
            </div>

            <div
              class="flex-1 flex items-center justify-center bg-black overflow-hidden"
              (click)="$event.stopPropagation()"
              (mousedown)="onImageMouseDown($event)"
              (mousemove)="onImageMouseMove($event)"
              (mouseup)="imageViewerService.endDrag()"
              (mouseleave)="imageViewerService.endDrag()"
            >
              <img
                [src]="'/assets/images/screenshots/' + imageViewerService.selectedImage()!"
                [alt]="imageViewerService.selectedImage()!"
                class="max-w-5xl max-h-[calc(100vh-200px)] object-contain"
                (load)="onImageLoad()"
              />
            </div>

            <div
              class="bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700 px-6 py-4 flex justify-center gap-3"
            >
              <button
                (click)="previousImage()"
                class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold"
              >
                ← Prev Image
              </button>
              <button
                (click)="imageViewerService.closeImage()"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                Close
              </button>
              <button
                (click)="nextImage()"
                class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold"
              >
                Next Image →
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class DocsComponent implements OnInit {
  private http = inject(HttpClient);
  readonly imageViewerService = inject(ImageViewerService);
  @ViewChild('contentArea') contentAreaRef!: ElementRef;

  data = signal<DocumentData | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');
  currentView = signal<'home' | 'module' | 'detail'>('home');
  currentModuleKey = signal<string>('');
  selectedSection = signal<Section | null>(null);
  currentImageIndex = signal(0);

  readonly currentModule = computed(() => {
    const key = this.currentModuleKey();
    const data = this.data();
    return data?.modules[key];
  });

  getTypeKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  ngOnInit(): void {
    this.loadDocumentation();
  }

  loadDocumentation(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<DocumentData>('assets/data/myidex-hub-sop-complete.json').subscribe({
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

  navigateToHome(): void {
    this.currentView.set('home');
    this.searchQuery.set('');
  }

  navigateToModule(key: string): void {
    this.currentModuleKey.set(key);
    this.currentView.set('module');
  }

  navigateToSection(section: Section): void {
    this.selectedSection.set(section);
    this.currentView.set('detail');
    this.currentImageIndex.set(0);
    setTimeout(() => this.contentAreaRef?.nativeElement?.scrollTo(0, 0), 0);
  }

  getModulesList() {
    return this.data() ? Object.entries(this.data()!.modules).map(([key, value]) => ({ key, value })) : [];
  }

  getModuleEmoji(key: string): string {
    const emojis: Record<string, string> = {
      master: '⚙️',
      users: '👥',
      orders: '📦',
      dashboard: '📊',
      service: '🔧',
    };
    return emojis[key] || '📁';
  }

  nextSection(): void {
    const current = this.selectedSection()!.id;
    if (current < 41) {
      const allSections = this.getAllSections();
      const next = allSections.find((s) => s.id === current + 1);
      if (next) this.navigateToSection(next);
    }
  }

  previousSection(): void {
    const current = this.selectedSection()!.id;
    if (current > 1) {
      const allSections = this.getAllSections();
      const prev = allSections.find((s) => s.id === current - 1);
      if (prev) this.navigateToSection(prev);
    }
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
