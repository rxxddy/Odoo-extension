/**
 * Content-script namespace.
 *
 * Content scripts listed in the manifest share one isolated world but have no
 * module system, so every file registers itself on this object. Load order is
 * fixed by the manifest (and reused by the service worker for custom hosts).
 */
globalThis.OstContent = globalThis.OstContent || {};
