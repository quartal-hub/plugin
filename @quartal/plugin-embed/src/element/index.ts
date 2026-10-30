/**
 * `@quartal/plugin-embed/element` — defines the `<qrtl-widget>` custom element on import.
 * @module
 */
import { defineWidgetElement } from "./QrtlWidgetElement.ts";

defineWidgetElement();

export { defineWidgetElement, QrtlWidgetElement, type ToolCallEventDetail, WIDGET_ELEMENT_TAG } from "./QrtlWidgetElement.ts";
export { pluginConnection, pluginRegistry, registerPlugin, resolvePlugin } from "./pluginRegistry.ts";
