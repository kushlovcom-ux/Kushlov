import { FILTER_CATEGORY_LABELS } from './catalog.js';
import type { FilterCategory, FilterDefinition, FilterPlatform } from './types.js';

export type FilterCategorySummary = {
  id: FilterCategory;
  label: string;
  count: number;
};

/**
 * Lookup layer between the UI and the renderers. A new filter is a `register`
 * call plus a sprite painter or shader branch — no camera, LiveKit, or
 * tracking code has to change.
 */
export class FilterRegistry {
  private readonly byId = new Map<string, FilterDefinition>();
  private readonly order: string[] = [];

  constructor(definitions: FilterDefinition[] = []) {
    for (const def of definitions) this.register(def);
  }

  register(definition: FilterDefinition): void {
    if (!this.byId.has(definition.id)) this.order.push(definition.id);
    this.byId.set(definition.id, definition);
  }

  get(id: string | null | undefined): FilterDefinition | null {
    if (!id) return null;
    return this.byId.get(id) ?? null;
  }

  has(id: string | null | undefined): boolean {
    return Boolean(id) && this.byId.has(id as string);
  }

  all(): FilterDefinition[] {
    return this.order.map((id) => this.byId.get(id)!).filter(Boolean);
  }

  byCategory(category: FilterCategory): FilterDefinition[] {
    return this.all().filter((def) => def.category === category);
  }

  /** Categories that actually contain something, in catalog order. */
  categories(): FilterCategorySummary[] {
    const counts = new Map<FilterCategory, number>();
    for (const def of this.all()) {
      counts.set(def.category, (counts.get(def.category) ?? 0) + 1);
    }
    const summaries: FilterCategorySummary[] = [];
    for (const [id, count] of counts) {
      summaries.push({ id, label: FILTER_CATEGORY_LABELS[id], count });
    }
    return summaries;
  }

  /** A narrowed registry so a platform never shows a filter it cannot draw. */
  forPlatform(platform: FilterPlatform): FilterRegistry {
    return new FilterRegistry(
      this.all().filter((def) => def.supportedPlatforms.includes(platform)),
    );
  }
}
