/** Sub-agent colors defined by the Claude agent format. */
export type ClaudeColor = "red" | "blue" | "green" | "yellow" | "purple" | "orange" | "pink" | "cyan";

/** Bootstrap theme colors, used by Quartal's Bootstrap-skinned user interfaces. */
export type BootstrapColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "light"
  | "dark";

/**
 * An agent's accent color, resolved into every notation a host may need.
 *
 * Authors may write a Claude color (`purple`), a Bootstrap theme color (`danger`) or a raw CSS
 * color (`#4b0082`, `rgb(75 0 130)`); the resolver fills in the equivalents it can derive so a
 * Claude host, a Bootstrap-skinned UI and a plain renderer all get something usable.
 */
export interface AgentColor {
  /** Color exactly as authored. */
  value: string;
  /** Equivalent Claude sub-agent color, when the value maps onto one. */
  claude?: ClaudeColor;
  /** Equivalent Bootstrap theme color, when the value maps onto one. */
  bootstrap?: BootstrapColor;
  /** Concrete CSS color for hosts that render an explicit color. */
  css?: string;
}
