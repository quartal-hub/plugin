/**
 * Copies text to the clipboard, falling back to the legacy `execCommand("copy")` path when the
 * async Clipboard API is unavailable or denied (embedded browsers, older permission policies).
 * @returns Whether the text ended up on the clipboard.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}
