import {
  Component,
  inject,
  signal,
  computed,
  AfterViewInit,
  OnInit,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  SecurityContext,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DocsDataService, DocsCategory, DocsModule, PageNode } from '../services/docs-data.service';
import { ImageViewerService } from '../services/image-viewer.service';

// View types
type DocView = 'home' | 'modules' | 'documentation';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white">
      <!-- LOADING & ERROR STATE -->
      @if (docsDataService.isLoading()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div class="text-center">
            <div
              class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"
            ></div>
            <p class="text-gray-700">Loading documentation...</p>
          </div>
        </div>
      }

      @if (docsDataService.error()) {
        <div class="bg-red-50 border-b border-red-200 px-6 py-4">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-red-900 font-semibold">Error Loading Documentation</h3>
              <p class="text-red-700 text-sm mt-1">{{ docsDataService.error() }}</p>
            </div>
            <button
              (click)="retryLoadData()"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      }

      @if (docsDataService.data()) {
        <!-- TOP NAVBAR -->
        <nav
          class="sticky top-0 z-40 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between"
        >
          <div
            class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            (click)="navigateToHome()"
          >
            <div
              class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg"
            >
              📚
            </div>
            <div>
              <h1 class="text-white font-bold text-lg">
                {{ docsDataService.data()!.documentInfo.title }}
              </h1>
              <p class="text-gray-400 text-xs">
                {{ docsDataService.data()!.documentInfo.tagline }}
              </p>
            </div>
          </div>

          <div class="flex-1 max-w-xs mx-8">
            <input
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event).target.value)"
              type="text"
              placeholder="Search..."
              class="w-full bg-gray-800 border border-gray-600 text-gray-200 placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div class="text-right">
            <span class="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded"
              >v{{ docsDataService.data()!.documentInfo.version }}</span
            >
          </div>
        </nav>

        <!-- VIEW 1: HOME PAGE (Hero + Category Grid) -->
        @if (currentView() === 'home') {
          <div class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-[calc(100vh-80px)]">
            <!-- Hero Section -->
            <div
              class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-16 text-center"
            >
              <h2 class="text-4xl font-bold mb-4">
                {{ docsDataService.data()!.documentInfo.title }}
              </h2>
              <p class="text-xl text-blue-100 mb-8">
                {{ docsDataService.data()!.documentInfo.tagline }}
              </p>
              <div class="max-w-md mx-auto relative">
                <input
                  type="text"
                  placeholder="Search documentation..."
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event).target.value)"
                  class="w-full px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <!-- Category Grid -->
            <div class="max-w-7xl mx-auto px-6 py-16">
              <h3 class="text-2xl font-bold text-gray-900 mb-8">Explore by Category</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (category of filteredCategories(); track category.id) {
                  <button
                    (click)="navigateToModules(category.id)"
                    class="group bg-white rounded-lg shadow-md hover:shadow-xl p-6 border border-gray-200 transition-all hover:-translate-y-1 text-left"
                  >
                    <div class="text-4xl mb-3">📂</div>
                    <h4 class="text-lg font-bold text-gray-900 mb-2">{{ category.title }}</h4>
                    <p class="text-gray-600 text-sm mb-4">{{ category.description }}</p>
                    <div class="text-xs text-blue-600 font-semibold group-hover:text-blue-700">
                      {{ category.modules.length }} modules →
                    </div>
                  </button>
                }
              </div>

              @if (filteredCategories().length === 0 && searchQuery()) {
                <div class="text-center py-12">
                  <p class="text-gray-500 text-lg">
                    No categories found matching "{{ searchQuery() }}"
                  </p>
                </div>
              }
            </div>
          </div>
        }

        <!-- VIEW 2: MODULES PAGE -->
        @if (currentView() === 'modules' && selectedCategory()) {
          <div>
            <!-- Breadcrumb -->
            <div class="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <nav class="flex items-center gap-2 text-sm">
                <button
                  (click)="navigateToHome()"
                  class="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Home
                </button>
                <span class="text-gray-400">/</span>
                <span class="text-gray-900 font-medium">{{ selectedCategory()!.title }}</span>
              </nav>
            </div>

            <div class="max-w-7xl mx-auto px-6 py-12">
              <h2 class="text-3xl font-bold text-gray-900 mb-2">{{ selectedCategory()!.title }}</h2>
              <p class="text-gray-600 mb-8">{{ selectedCategory()!.description }}</p>

              <!-- Modules Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                @for (module of filteredModules(); track module.id) {
                  <div
                    class="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
                  >
                    <h3 class="text-lg font-bold text-gray-900 mb-2">{{ module.title }}</h3>
                    <p class="text-gray-600 text-sm mb-4">{{ module.description }}</p>
                    <div class="flex items-center justify-between">
                      <button
                        (click)="
                          navigateToDocumentation(
                            selectedCategory()!.id,
                            module.id,
                            module.pages[0]?.id || ''
                          )
                        "
                        [disabled]="!module.pages || module.pages.length === 0"
                        class="text-blue-600 hover:text-blue-800 font-semibold text-sm underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        View Documentation →
                      </button>
                      @if (module.pdfUrl) {
                        <button
                          (click)="downloadPDF(module.pdfUrl!)"
                          class="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-medium transition-colors"
                          title="Download PDF"
                        >
                          📄 PDF
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>

              @if (filteredModules().length === 0) {
                <div class="text-center py-12">
                  <p class="text-gray-500 text-lg">No modules found</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- VIEW 3: DOCUMENTATION PAGE (3-Column AWS-style) -->
        @if (
          currentView() === 'documentation' &&
          selectedCategory() &&
          selectedModule() &&
          currentPage()
        ) {
          <div class="flex h-[calc(100vh-80px)]">
            <!-- LEFT SIDEBAR: Nested Navigation Tree -->
            <aside
              class="w-64 bg-gray-900 border-r border-gray-700 overflow-y-auto sticky top-16 [height:calc(100vh-64px)]"
            >
              <div class="py-4">
                <!-- Breadcrumb in sidebar -->
                <div class="px-4 mb-6 pb-4 border-b border-gray-700">
                  <button
                    (click)="navigateToHome()"
                    class="text-xs text-blue-400 hover:text-blue-300 mb-2 block"
                  >
                    ← Home
                  </button>
                  <button
                    (click)="navigateToModules(selectedCategory()!.id)"
                    class="text-xs text-blue-400 hover:text-blue-300 mb-1 block"
                  >
                    ← {{ selectedCategory()!.title }}
                  </button>
                </div>

                <!-- Module Title -->
                <div class="px-4 mb-4 pb-4 border-b border-gray-700">
                  <p class="text-xs font-semibold text-gray-400 uppercase mb-1">Module</p>
                  <p class="text-sm font-semibold text-white">{{ selectedModule()!.title }}</p>
                </div>

                <!-- Pages Navigation Tree -->
                <div class="space-y-1 px-2">
                  @for (page of selectedModule()!.pages; track page.id) {
                    <ng-container
                      [ngTemplateOutlet]="pageNodeTemplate"
                      [ngTemplateOutletContext]="{ $implicit: page, level: 0 }"
                    ></ng-container>
                  }
                </div>

                <!-- Template for recursive page nodes -->
                <ng-template #pageNodeTemplate let-page let-level="level">
                  <div [style.margin-left.rem]="level * 0.5">
                    <!-- Page Button -->
                    <button
                      (click)="navigateToPage(page.id)"
                      [class.bg-blue-600]="isCurrentPage(page.id)"
                      [class.text-white]="isCurrentPage(page.id)"
                      [class.text-gray-400]="!isCurrentPage(page.id)"
                      class="w-full text-left px-3 py-2 text-sm rounded transition-colors hover:bg-gray-700 hover:text-white"
                    >
                      {{ page.title }}
                    </button>

                    <!-- Nested Children -->
                    @if (page.children && page.children.length > 0) {
                      <div class="ml-2 border-l border-gray-700 mt-1">
                        @for (child of page.children; track child.id) {
                          <ng-container
                            [ngTemplateOutlet]="pageNodeTemplate"
                            [ngTemplateOutletContext]="{ $implicit: child, level: level + 1 }"
                          ></ng-container>
                        }
                      </div>
                    }
                  </div>
                </ng-template>
              </div>
            </aside>

            <!-- MAIN CONTENT AREA -->
            <main #contentArea class="flex-1 overflow-y-auto bg-white">
              <div class="max-w-4xl mx-auto px-8 py-12">
                <!-- Breadcrumb -->
                <div class="text-xs text-gray-500 mb-6">
                  <button (click)="navigateToHome()" class="text-blue-600 hover:text-blue-800">
                    Home
                  </button>
                  <span class="mx-2">/</span>
                  <button
                    (click)="navigateToModules(selectedCategory()!.id)"
                    class="text-blue-600 hover:text-blue-800"
                  >
                    {{ selectedCategory()!.title }}
                  </button>
                  <span class="mx-2">/</span>
                  <span class="text-gray-700">{{ selectedModule()!.title }}</span>
                  <span class="mx-2">/</span>
                  <span class="text-gray-700">{{ currentPage()!.title }}</span>
                </div>

                <!-- Top Section with PDF Download -->
                <div class="flex justify-between items-start mb-8">
                  <div>
                    <h1 class="text-4xl font-bold text-gray-900 mb-2">
                      {{ currentPage()!.title }}
                    </h1>
                    <p class="text-gray-600">
                      Last updated: {{ docsDataService.data()!.documentInfo.lastUpdated }}
                    </p>
                  </div>
                  @if (selectedModule()!.pdfUrl) {
                    <button
                      (click)="downloadPDF(selectedModule()!.pdfUrl!)"
                      class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                    >
                      📥 Download PDF
                    </button>
                  }
                </div>

                <!-- Content -->
                <div class="prose prose-sm max-w-none">
                  <div
                    [innerHTML]="sanitizeHtml(renderMarkdownToHtml(currentPage()!.content))"
                  ></div>
                </div>

                <!-- Navigation Buttons -->
                <div class="mt-12 pt-8 border-t border-gray-200 flex justify-between">
                  <button
                    (click)="navigateToPreviousPage()"
                    [disabled]="!hasPreviousPage()"
                    class="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    (click)="navigateToNextPage()"
                    [disabled]="!hasNextPage()"
                    class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </main>

            <!-- RIGHT SIDEBAR: On-This-Page (Table of Contents) -->
            <aside
              class="w-56 bg-gray-50 border-l border-gray-200 overflow-y-auto sticky top-16 [height:calc(100vh-64px)] hidden xl:block"
            >
              <div class="px-6 py-4">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                  On This Page
                </h3>
                <nav class="space-y-2 text-xs">
                  @for (heading of extractHeadings(currentPage()!.content); track heading.id) {
                    <div
                      (click)="scrollToHeading(heading.id)"
                      [style.padding-left]="heading.level * 0.75 + 'rem'"
                      class="block w-full text-left py-1 text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {{ heading.text }}
                    </div>
                  }
                </nav>
              </div>
            </aside>
          </div>
        }

        <!-- IMAGE VIEWER MODAL -->
        @if (imageViewerService.selectedImage()) {
          <div
            class="fixed inset-0 bg-black bg-opacity-95 flex flex-col z-50"
            (click)="imageViewerService.closeImage()"
            (keydown)="onViewerKeydown($event)"
            tabindex="0"
          >
            <!-- Toolbar Top -->
            <div
              class="bg-gray-900 border-b border-gray-700 px-6 py-3 flex justify-between items-center"
            >
              <div class="flex items-center gap-4 flex-1">
                <h2 class="text-white font-semibold">Image Viewer</h2>
                <p class="text-gray-400 text-sm">{{ imageViewerService.selectedImage() }}</p>
              </div>
              <button
                (click)="imageViewerService.closeImage()"
                class="text-gray-400 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <!-- Main Viewer -->
            <div
              class="flex-1 flex items-center justify-center bg-black overflow-hidden relative"
              (click)="$event.stopPropagation()"
              (wheel)="onViewerMouseWheel($event)"
              (mousedown)="onImageMouseDown($event)"
              (mousemove)="onImageMouseMove($event)"
              (mouseup)="imageViewerService.endDrag()"
              (mouseleave)="imageViewerService.endDrag()"
            >
              <div
                class="relative"
                [style.cursor]="
                  imageViewerService.isImageDragging()
                    ? 'grabbing'
                    : imageViewerService.imageZoom() > 1
                      ? 'grab'
                      : 'default'
                "
              >
                <div
                  [style.transform]="
                    'translate(' +
                    imageViewerService.imagePanX() +
                    'px, ' +
                    imageViewerService.imagePanY() +
                    'px) scale(' +
                    (imageViewerService.imageZoom() === -1 ? 1 : imageViewerService.imageZoom()) +
                    ')'
                  "
                  style="transition: transform 0.1s ease-out; transform-origin: center;"
                >
                  <img
                    [src]="'/assets/images/screenshots/' + imageViewerService.selectedImage()!"
                    [alt]="imageViewerService.selectedImage()!"
                    class="max-w-3xl max-h-[calc(100vh-200px)] object-contain select-none"
                    (load)="onImageLoad()"
                  />
                </div>
              </div>
            </div>

            <!-- Toolbar Bottom -->
            <div
              class="bg-gray-900 border-t border-gray-700 px-6 py-4 flex justify-between items-center"
            >
              <div class="flex gap-2">
                <button
                  (click)="getPreviousImage()"
                  [disabled]="getImageIndex(imageViewerService.selectedImage()!) <= 0"
                  class="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 text-white rounded transition-colors text-sm"
                >
                  ← Prev
                </button>
                <button
                  (click)="getNextImage()"
                  [disabled]="
                    getImageIndex(imageViewerService.selectedImage()!) >=
                    (getCurrentPageScreenshots().length || 1) - 1
                  "
                  class="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 text-white rounded transition-colors text-sm"
                >
                  Next →
                </button>
              </div>

              <div class="flex items-center gap-3 bg-gray-800 rounded px-3 py-2">
                <button
                  (click)="imageViewerService.fitToScreen()"
                  [class.bg-blue-600]="imageViewerService.imageZoom() === -1"
                  class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
                >
                  Fit
                </button>
                <button
                  (click)="imageViewerService.setZoomLevel(1)"
                  [class.bg-blue-600]="imageViewerService.imageZoom() === 1"
                  class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
                >
                  100%
                </button>
                <div class="w-px h-4 bg-gray-600"></div>
                <button
                  (click)="imageViewerService.zoomOut()"
                  [disabled]="!canZoomOut()"
                  class="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:text-gray-600 text-white rounded text-xs transition-colors"
                >
                  −
                </button>
                <span class="text-white text-xs min-w-12 text-center font-semibold">
                  {{ getZoomPercentage() }}
                </span>
                <button
                  (click)="imageViewerService.zoomIn()"
                  [disabled]="!canZoomIn()"
                  class="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-900 disabled:text-gray-600 text-white rounded text-xs transition-colors"
                >
                  +
                </button>
              </div>

              <div class="text-gray-400 text-xs">💡 Scroll to zoom • Drag to pan</div>
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

      .prose {
        --tw-prose-body: rgb(55, 65, 81);
        --tw-prose-headings: rgb(17, 24, 39);
        --tw-prose-links: rgb(37, 99, 235);
      }

      .prose :not(pre) > code {
        background-color: rgb(245, 245, 245);
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        font-weight: 600;
        color: rgb(17, 24, 39);
      }

      .prose h1,
      .prose h2,
      .prose h3,
      .prose h4,
      .prose h5,
      .prose h6 {
        scroll-margin-top: 100px;
        font-weight: 700;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        color: rgb(17, 24, 39);
      }

      .prose h1 {
        font-size: 1.875rem;
      }

      .prose h2 {
        font-size: 1.5rem;
        border-bottom: 2px solid rgb(229, 231, 235);
        padding-bottom: 0.5rem;
      }

      .prose h3 {
        font-size: 1.25rem;
      }

      .prose a {
        color: rgb(37, 99, 235);
        text-decoration: underline;
      }

      .prose a:hover {
        color: rgb(29, 78, 216);
      }

      .prose p {
        margin: 1rem 0;
        line-height: 1.75;
        color: rgb(55, 65, 81);
      }

      .prose ul,
      .prose ol {
        margin: 1rem 0;
        padding-left: 1.5rem;
      }

      .prose li {
        margin-bottom: 0.5rem;
        color: rgb(55, 65, 81);
      }

      .prose table {
        border-collapse: collapse;
        width: 100%;
        margin: 1rem 0;
      }

      .prose th,
      .prose td {
        border: 1px solid rgb(229, 231, 235);
        padding: 0.75rem;
        text-align: left;
      }

      .prose th {
        background-color: rgb(245, 245, 245);
        font-weight: 600;
      }

      .prose blockquote {
        border-left: 4px solid rgb(37, 99, 235);
        padding-left: 1rem;
        margin: 1rem 0;
        color: rgb(107, 114, 128);
        font-style: italic;
      }

      .prose pre {
        background-color: rgb(245, 245, 245);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
      }
    `,
  ],
})
export class DocsComponent implements OnInit, AfterViewInit {
  @ViewChild('contentArea') contentAreaRef?: ElementRef<HTMLDivElement>;

  docsDataService = inject(DocsDataService);
  sanitizer = inject(DomSanitizer);
  imageViewerService = inject(ImageViewerService);
  renderer = inject(Renderer2);

  // STATE
  currentView = signal<DocView>('home');
  searchQuery = signal<string>('');
  selectedCategoryId = signal<string | null>(null);
  selectedModuleId = signal<string | null>(null);
  selectedPageId = signal<string | null>(null);

  // COMPUTED
  selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    return id ? this.docsDataService.getCategoryById(id) : null;
  });

  selectedModule = computed(() => {
    const categoryId = this.selectedCategoryId();
    const moduleId = this.selectedModuleId();
    return categoryId && moduleId ? this.docsDataService.getModuleById(categoryId, moduleId) : null;
  });

  currentPage = computed(() => {
    const categoryId = this.selectedCategoryId();
    const moduleId = this.selectedModuleId();
    const pageId = this.selectedPageId();
    return categoryId && moduleId && pageId
      ? this.docsDataService.getPageById(categoryId, moduleId, pageId)
      : null;
  });

  filteredCategories = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.docsDataService.getCategories();
    return this.docsDataService.searchCategories(query);
  });

  filteredModules = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const categoryId = this.selectedCategoryId();
    if (!categoryId) return [];

    const category = this.docsDataService.getCategoryById(categoryId);
    if (!category) return [];

    if (!query) return category.modules;

    return category.modules.filter(
      (m) => m.title.toLowerCase().includes(query) || m.description.toLowerCase().includes(query),
    );
  });

  constructor() {}

  ngOnInit(): void {
    this.docsDataService.loadData();
  }

  ngAfterViewInit(): void {
    // Additional setup if needed
  }

  // NAVIGATION
  navigateToHome(): void {
    this.currentView.set('home');
    this.searchQuery.set('');
    this.selectedCategoryId.set(null);
    this.selectedModuleId.set(null);
    this.selectedPageId.set(null);
  }

  navigateToModules(categoryId: string): void {
    this.currentView.set('modules');
    this.selectedCategoryId.set(categoryId);
    this.selectedModuleId.set(null);
    this.selectedPageId.set(null);
    this.searchQuery.set('');
  }

  navigateToDocumentation(categoryId: string, moduleId: string, pageId: string): void {
    this.currentView.set('documentation');
    this.selectedCategoryId.set(categoryId);
    this.selectedModuleId.set(moduleId);
    this.selectedPageId.set(pageId);
    this.scrollToTop();
  }

  navigateToPage(pageId: string): void {
    this.selectedPageId.set(pageId);
    this.scrollToTop();
  }

  navigateToPreviousPage(): void {
    const prevPage = this.getPreviousPageNode();
    if (prevPage) {
      const categoryId = this.selectedCategoryId();
      const moduleId = this.selectedModuleId();
      if (categoryId && moduleId) {
        this.navigateToDocumentation(categoryId, moduleId, prevPage.id);
      }
    }
  }

  navigateToNextPage(): void {
    const nextPage = this.getNextPageNode();
    if (nextPage) {
      const categoryId = this.selectedCategoryId();
      const moduleId = this.selectedModuleId();
      if (categoryId && moduleId) {
        this.navigateToDocumentation(categoryId, moduleId, nextPage.id);
      }
    }
  }

  // PAGE NAVIGATION HELPERS
  private getAllPagesFlat(): PageNode[] {
    const module = this.selectedModule();
    if (!module) return [];

    const result: PageNode[] = [];
    const traverse = (pages: PageNode[]) => {
      pages.forEach((page) => {
        result.push(page);
        if (page.children) traverse(page.children);
      });
    };
    traverse(module.pages);
    return result;
  }

  private getCurrentPageIndex(): number {
    const currentPageId = this.selectedPageId();
    if (!currentPageId) return -1;
    const allPages = this.getAllPagesFlat();
    return allPages.findIndex((p) => p.id === currentPageId);
  }

  hasPreviousPage(): boolean {
    return this.getCurrentPageIndex() > 0;
  }

  hasNextPage(): boolean {
    const allPages = this.getAllPagesFlat();
    return this.getCurrentPageIndex() < allPages.length - 1;
  }

  private getPreviousPageNode(): PageNode | null {
    const allPages = this.getAllPagesFlat();
    const index = this.getCurrentPageIndex();
    return index > 0 ? allPages[index - 1] : null;
  }

  private getNextPageNode(): PageNode | null {
    const allPages = this.getAllPagesFlat();
    const index = this.getCurrentPageIndex();
    return index >= 0 && index < allPages.length - 1 ? allPages[index + 1] : null;
  }

  isCurrentPage(pageId: string): boolean {
    return this.selectedPageId() === pageId;
  }

  // RENDERING HELPERS
  renderMarkdownToHtml(markdown: string): string {
    let html = markdown;

    // Headers (must be in order from most specific to least)
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Lists - unordered
    const ulMatches = html.match(/(?:^|\n)((?:- .*(?:\n|$))+)/gm);
    if (ulMatches) {
      ulMatches.forEach((match) => {
        const items = match
          .trim()
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => `<li>${line.replace(/^- /, '').trim()}</li>`)
          .join('\n');
        html = html.replace(match, `<ul>\n${items}\n</ul>`);
      });
    }

    // Paragraphs
    html = html
      .split('\n\n')
      .map((para) => {
        para = para.trim();
        if (!para) return '';
        if (para.match(/^<[hul]/) || para.match(/<\/[hul]>$/)) return para;
        return `<p>${para}</p>`;
      })
      .join('\n');

    return html;
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) || '';
  }

  extractHeadings(content: string): Array<{ id: string; text: string; level: number }> {
    const headings: Array<{ id: string; text: string; level: number }> = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (line.startsWith('###')) {
        const text = line.replace(/^### /, '').trim();
        headings.push({ id: `h-${index}`, text, level: 3 });
      } else if (line.startsWith('##')) {
        const text = line.replace(/^## /, '').trim();
        headings.push({ id: `h-${index}`, text, level: 2 });
      } else if (line.startsWith('#') && !line.startsWith('##')) {
        const text = line.replace(/^# /, '').trim();
        headings.push({ id: `h-${index}`, text, level: 1 });
      }
    });

    return headings;
  }

  scrollToHeading(id: string): void {
    setTimeout(() => {
      if (this.contentAreaRef) {
        this.contentAreaRef.nativeElement.scrollTop = 0;
      }
    }, 0);
  }

  private scrollToTop(): void {
    if (this.contentAreaRef) {
      this.contentAreaRef.nativeElement.scrollTop = 0;
    }
  }

  // UTILITY
  downloadPDF(pdfUrl: string): void {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  }

  retryLoadData(): void {
    this.docsDataService.loadData();
  }

  // IMAGE VIEWER METHODS
  openImageModal(screenshot: string): void {
    this.imageViewerService.openImage(screenshot);
  }

  getCurrentPageScreenshots(): string[] {
    return this.currentPage()?.content ? [] : [];
  }

  getPreviousImage(): void {
    const screenshots = this.getCurrentPageScreenshots();
    const current = this.imageViewerService.selectedImage();
    if (current) {
      const idx = screenshots.indexOf(current);
      if (idx > 0) {
        this.imageViewerService.openImage(screenshots[idx - 1]);
      }
    }
  }

  getNextImage(): void {
    const screenshots = this.getCurrentPageScreenshots();
    const current = this.imageViewerService.selectedImage();
    if (current) {
      const idx = screenshots.indexOf(current);
      if (idx < screenshots.length - 1) {
        this.imageViewerService.openImage(screenshots[idx + 1]);
      }
    }
  }

  getImageIndex(screenshot: string | null): number {
    if (!screenshot) return -1;
    const screenshots = this.getCurrentPageScreenshots();
    return screenshots.indexOf(screenshot);
  }

  onImageMouseDown(event: MouseEvent): void {
    if (this.imageViewerService.imageZoom() > 1 && event.button === 0) {
      this.imageViewerService.startDrag(event.clientX, event.clientY);
      event.preventDefault();
    }
  }

  onImageMouseMove(event: MouseEvent): void {
    this.imageViewerService.updateDrag(event.clientX, event.clientY);
  }

  onViewerMouseWheel(event: WheelEvent): void {
    if (this.imageViewerService.selectedImage()) {
      event.preventDefault();
      this.imageViewerService.zoomByWheel(event.deltaY);
    }
  }

  onViewerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.imageViewerService.closeImage();
        break;
      case '+':
      case '=':
        event.preventDefault();
        this.imageViewerService.zoomIn();
        break;
      case '-':
        event.preventDefault();
        this.imageViewerService.zoomOut();
        break;
      case '0':
        event.preventDefault();
        this.imageViewerService.setZoomLevel(1);
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        this.imageViewerService.fitToScreen();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.getPreviousImage();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.getNextImage();
        break;
    }
  }

  onImageLoad(): void {
    this.imageViewerService.resetZoomAndPan();
  }

  canZoomIn(): boolean {
    const zoom = this.imageViewerService.imageZoom();
    return zoom === -1 || zoom < this.imageViewerService.MAX_ZOOM;
  }

  canZoomOut(): boolean {
    const zoom = this.imageViewerService.imageZoom();
    return zoom !== -1 && zoom > this.imageViewerService.MIN_ZOOM;
  }

  getZoomPercentage(): string {
    const zoom = this.imageViewerService.imageZoom();
    if (zoom === -1) return 'Fit';
    return Math.round(zoom * 100) + '%';
  }
}
