import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// Nested page structure
export interface PageNode {
  id: string;
  title: string;
  path: string;
  content: string;
  children?: PageNode[];
}

// Module contains pages
export interface DocsModule {
  id: string;
  title: string;
  description: string;
  pdfUrl: string | null;
  pages: PageNode[];
}

// Category contains modules
export interface DocsCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  modules: DocsModule[];
}

// Main data structure
export interface DocsData {
  documentInfo: {
    title: string;
    version: string;
    company: string;
    tagline: string;
    lastUpdated: string;
  };
  categories: DocsCategory[];
}

@Injectable({
  providedIn: 'root',
})
export class DocsDataService {
  private http = inject(HttpClient);

  // State
  data = signal<DocsData | null>(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  loadData(): void {
    if (this.data()) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.http
      .get<DocsData>('assets/data/docs.json')
      .pipe(
        tap((data) => {
          this.data.set(data);
          this.isLoading.set(false);
        }),
        catchError((err) => {
          const errorMsg = `Failed to load documentation data: ${err.message}`;
          this.error.set(errorMsg);
          this.isLoading.set(false);
          console.error(errorMsg, err);
          return throwError(() => new Error(errorMsg));
        }),
      )
      .subscribe();
  }

  getCategories(): DocsCategory[] {
    return this.data()?.categories || [];
  }

  getCategoryById(categoryId: string): DocsCategory | undefined {
    return this.getCategories().find((c) => c.id === categoryId);
  }

  getModuleById(categoryId: string, moduleId: string): DocsModule | undefined {
    const category = this.getCategoryById(categoryId);
    return category?.modules.find((m) => m.id === moduleId);
  }

  getPageById(categoryId: string, moduleId: string, pageId: string): PageNode | undefined {
    const module = this.getModuleById(categoryId, moduleId);
    return this.findPageInTree(module?.pages || [], pageId);
  }

  private findPageInTree(pages: PageNode[], pageId: string): PageNode | undefined {
    for (const page of pages) {
      if (page.id === pageId) return page;
      const found = this.findPageInTree(page.children || [], pageId);
      if (found) return found;
    }
    return undefined;
  }

  searchCategories(query: string): DocsCategory[] {
    if (!query) return [];
    const lower = query.toLowerCase();
    return this.getCategories().filter(
      (c) => c.title.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower),
    );
  }

  searchModules(query: string): Array<{ categoryId: string; module: DocsModule }> {
    if (!query) return [];
    const lower = query.toLowerCase();
    const results: Array<{ categoryId: string; module: DocsModule }> = [];
    this.getCategories().forEach((category) => {
      category.modules.forEach((module) => {
        if (
          module.title.toLowerCase().includes(lower) ||
          module.description.toLowerCase().includes(lower)
        ) {
          results.push({ categoryId: category.id, module });
        }
      });
    });
    return results;
  }

  searchPages(query: string): Array<{ categoryId: string; moduleId: string; page: PageNode }> {
    if (!query) return [];
    const lower = query.toLowerCase();
    const results: Array<{ categoryId: string; moduleId: string; page: PageNode }> = [];
    this.getCategories().forEach((category) => {
      category.modules.forEach((module) => {
        this.searchPagesInTree(module.pages, lower).forEach((page) => {
          results.push({ categoryId: category.id, moduleId: module.id, page });
        });
      });
    });
    return results;
  }

  private searchPagesInTree(pages: PageNode[], query: string): PageNode[] {
    const results: PageNode[] = [];
    pages.forEach((page) => {
      if (page.title.toLowerCase().includes(query) || page.content.toLowerCase().includes(query)) {
        results.push(page);
      }
      results.push(...this.searchPagesInTree(page.children || [], query));
    });
    return results;
  }

  getAllPages(): Array<{
    categoryId: string;
    categoryTitle: string;
    moduleId: string;
    moduleTitle: string;
    page: PageNode;
  }> {
    const results: Array<{
      categoryId: string;
      categoryTitle: string;
      moduleId: string;
      moduleTitle: string;
      page: PageNode;
    }> = [];
    this.getCategories().forEach((category) => {
      category.modules.forEach((module) => {
        this.getAllPagesInTree(module.pages).forEach((page) => {
          results.push({
            categoryId: category.id,
            categoryTitle: category.title,
            moduleId: module.id,
            moduleTitle: module.title,
            page,
          });
        });
      });
    });
    return results;
  }

  private getAllPagesInTree(pages: PageNode[]): PageNode[] {
    const results: PageNode[] = [];
    pages.forEach((page) => {
      results.push(page);
      results.push(...this.getAllPagesInTree(page.children || []));
    });
    return results;
  }
}
