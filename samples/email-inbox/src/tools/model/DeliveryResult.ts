/** The outcome of delivering one email to one route. */
export interface DeliveryResult {
  routeId: string;
  pluginUrl: string;
  tool: string;
  ok: boolean;
  /** The receiver's answer (shortened), or the error. */
  message: string;
}
