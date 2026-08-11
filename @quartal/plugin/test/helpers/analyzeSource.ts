import { Project, ts } from "ts-morph";
import { TsMorphAnalyzer } from "../../src/code/TsMorphAnalyzer.ts";
import type { CodeFile } from "../../src/index.ts";

/**
 * Analyze in-memory TypeScript source and return the {@link CodeFile}[] model. The tool surface is
 * the export graph of `/tools/mod.ts`: if the caller doesn't supply one, a barrel is synthesized that
 * `export *`s every provided `/tools/**` file — matching how real plugins declare their tools. Files
 * outside `/tools/` (e.g. `/vendor/*`) feed the imported-types closure when referenced.
 * @param files Map of virtual absolute path (e.g. `/tools/Foo.ts`) to source code.
 */
export function analyzeSource(files: Record<string, string>): CodeFile[] {
  const ENTRY = "/tools/mod.ts";
  const withEntry = { ...files };
  if (!withEntry[ENTRY]) {
    withEntry[ENTRY] = Object.keys(files)
      .filter((p) => /\/tools\//.test(p) && p !== ENTRY)
      .map((p) => `export * from "${p.replace(/^\/tools\//, "./")}";`)
      .join("\n");
  }

  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowImportingTsExtensions: true,
      allowJs: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
    },
  });
  let entry;
  for (const [path, code] of Object.entries(withEntry)) {
    const sf = project.createSourceFile(path, code);
    if (path === ENTRY) entry = sf;
  }
  return new TsMorphAnalyzer().analyzeProject(project, { entry });
}
