import type { AgentColor, BootstrapColor, ClaudeColor } from "../model/index.ts";

/** Claude sub-agent color → Bootstrap theme color. */
const CLAUDE_TO_BOOTSTRAP: Record<ClaudeColor, BootstrapColor> = {
  red: "danger",
  blue: "primary",
  green: "success",
  yellow: "warning",
  purple: "secondary",
  orange: "warning",
  pink: "danger",
  cyan: "info",
};

/** Bootstrap theme color → closest Claude sub-agent color (`light`/`dark` have none). */
const BOOTSTRAP_TO_CLAUDE: Partial<Record<BootstrapColor, ClaudeColor>> = {
  primary: "blue",
  secondary: "purple",
  success: "green",
  danger: "red",
  warning: "yellow",
  info: "cyan",
};

/** Concrete CSS colors — the Bootstrap 5 palette, which covers both name sets. */
const CSS_BY_NAME: Record<string, string> = {
  red: "#dc3545",
  blue: "#0d6efd",
  green: "#198754",
  yellow: "#ffc107",
  purple: "#6f42c1",
  orange: "#fd7e14",
  pink: "#d63384",
  cyan: "#0dcaf0",
  primary: "#0d6efd",
  secondary: "#6c757d",
  success: "#198754",
  danger: "#dc3545",
  warning: "#ffc107",
  info: "#0dcaf0",
  light: "#f8f9fa",
  dark: "#212529",
};

const CLAUDE_COLORS = Object.keys(CLAUDE_TO_BOOTSTRAP) as ClaudeColor[];
const BOOTSTRAP_COLORS: BootstrapColor[] = [
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
  "info",
  "light",
  "dark",
];

const CSS_COLOR_RE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([^)]*\)|var\(--[\w-]+\))$/i;

/** True for a Claude sub-agent color name. */
export function isClaudeColor(value: string): value is ClaudeColor {
  return (CLAUDE_COLORS as string[]).includes(value);
}

/** True for a Bootstrap theme color name. */
export function isBootstrapColor(value: string): value is BootstrapColor {
  return (BOOTSTRAP_COLORS as string[]).includes(value);
}

/**
 * Resolves an authored color into every notation a host may need.
 *
 * Claude colors (`purple`) and Bootstrap theme colors (`danger`) are translated into each other
 * and into a concrete CSS color; a raw CSS color (`#4b0082`, `rgb(…)`, `var(--bs-primary)`) is
 * passed through as CSS only. Unknown names are kept as {@link AgentColor.value} so nothing is
 * silently lost.
 * @param value Color as authored.
 */
export function resolveAgentColor(value: string): AgentColor | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();

  if (isClaudeColor(lower)) {
    return { value: raw, claude: lower, bootstrap: CLAUDE_TO_BOOTSTRAP[lower], css: CSS_BY_NAME[lower] };
  }
  if (isBootstrapColor(lower)) {
    const claude = BOOTSTRAP_TO_CLAUDE[lower];
    return { value: raw, ...(claude ? { claude } : {}), bootstrap: lower, css: CSS_BY_NAME[lower] };
  }
  if (CSS_COLOR_RE.test(raw)) {
    return { value: raw, css: raw };
  }
  return { value: raw };
}
