/** The error every tool of this sample throws: the sample carries the signatures only. */
export function notImplemented(tool: string): Error {
  return new Error(`not implemented: ${tool} (this sample carries the tool signatures only)`);
}
