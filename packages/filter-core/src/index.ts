export * from './types.js';
export * from './beauty.js';
export * from './catalog.js';
export * from './registry.js';
export * from './livekit.js';

import { KUSHLOV_FILTERS } from './catalog.js';
import { FilterRegistry } from './registry.js';

/** The shipped catalog. Platform engines narrow this with `forPlatform`. */
export const filterRegistry = new FilterRegistry(KUSHLOV_FILTERS);
