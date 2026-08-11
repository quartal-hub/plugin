import type { CodeOrSystemType } from "@quartal/plugin-core";

/** Human-readable label for a parsed or referenced type. */
export function typeLabel(type: CodeOrSystemType): string {
  if (typeof type === "string") return type.trim();
  if (typeof type === "object" && type !== null && "name" in type) return type.name;
  if (typeof type === "object" && type !== null && "items" in type) {
    return `${typeLabel(type.items)}[]`;
  }
  return "unknown";
}
