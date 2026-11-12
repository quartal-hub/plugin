import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getExperimentalHubContext } from "@quartal/plugin/hub";

/** A company the caller can work in. */
export interface WorkspaceCompany {
  /** Quartal IAM id of the company. */
  companyId: string;
  name: string;
  /** Business ID (Y-tunnus), when known. */
  businessId: string | null;
  /** An Advisory (accounting firm). */
  isAccountingFirm: boolean;
}

/** A file or folder of the selected company. */
export interface WorkspaceFile {
  /** Path including the drive, e.g. `/data/notes/today.md`. */
  path: string;
  name: string;
  isFolder: boolean;
  /** Size in bytes; files only. */
  size?: number;
  /** When it last changed (ISO 8601). */
  updatedAt?: string;
}

/**
 * A working proof of concept of the experimental Quartal Hub context: these tools call the real
 * Quartal IAM API and Quartal Files as the signed-in user. Pick the company to work in, then
 * browse its files, read them and save notes.
 */
export class Workspace {
  /**
   * The companies the caller can work in, and the one selected now.
   * @param input Optional filter.
   * @returns The companies by name, and the selected company (null when none).
   */
  static async listMyCompanies(
    input: {
      /** Partial, case-insensitive match on the company name. */
      name?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ selected: WorkspaceCompany | null; companies: WorkspaceCompany[] }> {
    const hub = getExperimentalHubContext(ctx);
    const [companies, selected] = await Promise.all([hub.companies.list({ name: input?.name }), hub.companies.getSelected()]);
    return {
      selected: selected && toCompany(selected),
      companies: companies.map(toCompany),
    };
  }

  /**
   * Selects the company the other Workspace tools work in. The selection is kept per user, so
   * it holds across tool calls and MCP clients.
   * @param input The company.
   * @returns The selected company.
   */
  static async selectCompany(
    input: {
      /** Quartal IAM id of the company (from `listMyCompanies`). */
      companyId: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ selected: WorkspaceCompany }> {
    const selected = await getExperimentalHubContext(ctx).companies.setSelected(input.companyId);
    return { selected: toCompany(selected!) };
  }

  /**
   * The files in a folder of the selected company.
   * @param input The folder.
   * @returns The selected company and the folder's entries, folders first.
   */
  static async listFiles(
    input: {
      /** The folder, e.g. `/data/notes`; `/` (default) lists the drives. */
      path?: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ company: string; entries: WorkspaceFile[] }> {
    const hub = getExperimentalHubContext(ctx);
    const company = await requireSelected(ctx);
    const entries = await hub.files.list(input?.path || "/");
    return {
      company: company.name,
      entries: entries.map((e) => ({
        path: e.drive ? `/${e.drive}${e.path === "/" ? "" : e.path}` : "/",
        name: e.name || e.drive,
        isFolder: e.isFolder,
        size: e.size,
        updatedAt: e.updatedAt,
      })),
    };
  }

  /**
   * Reads a text file of the selected company.
   * @param input The file.
   * @returns The file's text.
   */
  static async getFile(
    input: {
      /** The path, e.g. `/data/notes/today.md`. */
      path: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ path: string; text: string }> {
    await requireSelected(ctx);
    return { path: input.path, text: await getExperimentalHubContext(ctx).files.getText(input.path) };
  }

  /**
   * Saves a Markdown note in the selected company's `/data/notes` folder, replacing a note of the
   * same name. Written through the `QFsSource` interface of `@quartal/core`.
   * @param input The note.
   * @returns Where the note was saved, and whether its content changed.
   */
  static async saveNote(
    input: {
      /** File name without the extension: letters, digits, `-` and `_`. */
      name: string;
      /** The note in Markdown. */
      text: string;
    },
    ctx: QuartalPluginContext,
  ): Promise<{ path: string; version: string | null; unchanged: boolean }> {
    if (!/^[\w-]{1,80}$/.test(input.name)) {
      throw new Error("A note name has 1–80 letters, digits, '-' or '_'.");
    }
    await requireSelected(ctx);
    const path = `/data/notes/${input.name}.md`;
    const { entry, unchanged } = await getExperimentalHubContext(ctx).fsSource().write(path, input.text);
    return { path, version: entry.version ?? null, unchanged };
  }
}

function toCompany(c: WorkspaceCompany): WorkspaceCompany {
  return { companyId: c.companyId, name: c.name, businessId: c.businessId, isAccountingFirm: c.isAccountingFirm };
}

/** The selected company, or an error that tells the model what to do. */
async function requireSelected(ctx: QuartalPluginContext): Promise<WorkspaceCompany> {
  const selected = await getExperimentalHubContext(ctx).companies.getSelected();
  if (!selected) {
    throw new Error("No company selected: list the companies with listMyCompanies and pick one with selectCompany.");
  }
  return selected;
}
