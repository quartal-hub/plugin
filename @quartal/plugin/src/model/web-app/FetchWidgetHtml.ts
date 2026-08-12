import type { WidgetEntry } from "./WidgetEntry.ts";

/** Renders a widget's live page HTML for `resources/read`; `null` when the page cannot be fetched. */
export type FetchWidgetHtml = (entry: WidgetEntry, origin: string) => Promise<string | null>;
