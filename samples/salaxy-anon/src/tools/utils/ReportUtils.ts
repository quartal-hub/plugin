import { Numeric, Objects, Translations } from "@salaxy/core";
import type { Calculation, Language, ReportType } from "@salaxy/core";
import { CalculationMapper, ESalaryMapper, Templates } from "@salaxy/reports";
import type { CalculationReport, ReportData, ReportOptions } from "@salaxy/reports";

/** Report view variant (partial tables, first page, or full report). */
export type ReportView = "partial" | "page1" | "full";

/**
 * Report types that use Handlebars templates via {@link ReportUtils.generateFragment}.
 * Mirrors the template mapping in `CalcReports.vue` (excluding table-only reports).
 */
export type TemplateReportType =
  | "salarySlip"
  | "employerReport"
  | "paymentReport"
  | "paymentSummaryReport"
  | "totalsReport"
  | "eSalarySpecification";

const REPORT_TEMPLATES: Record<TemplateReportType, Record<ReportView, string>> = {
  salarySlip: {
    full: "salarySlipV2",
    page1: "salarySlipV2Page1",
    partial: "workerCalculationTablesV2",
  },
  employerReport: {
    full: "employerReportV2",
    page1: "employerReportV2Page1",
    partial: "employerCalculationTablesV2",
  },
  paymentReport: {
    full: "paymentReportV2",
    page1: "paymentReportV2",
    partial: "paymentTablesV2",
  },
  paymentSummaryReport: {
    full: "paymentSummaryReportV2",
    page1: "paymentSummaryReportV2",
    partial: "paymentTablesV2",
  },
  totalsReport: {
    full: "totalsReport",
    page1: "totalsReport",
    partial: "totalsTables",
  },
  eSalarySpecification: {
    full: "eSalary",
    page1: "eSalary",
    partial: "eSalary",
  },
};

const ESALARY_XSL_URL = "https://cdn.salaxy.com/reports/PayslipCommon20.xsl";

/** Parameters for generating template-based report HTML. */
export interface TemplateReportHtmlParams {
  /** Single calculation or summary over multiple calculations. */
  calc: Calculation | Calculation[];
  /** Report type (UI type from CalcReports, or Salaxy {@link ReportType} value). */
  reportType: TemplateReportType | ReportType;
  /** Handlebars template name; resolved from {@link reportType} + {@link view} when omitted. */
  templateName?: string;
  /** Used with {@link reportType} to resolve {@link templateName} when omitted. Defaults to `"partial"`. */
  view?: ReportView;
  /** Rendering language. */
  lang: Language;
  /** Margins, header/footer templates, logo, etc. Caller supplies; no server fetch. */
  reportOptions?: ReportOptions;
  /** When true, wraps fragment like `CalcReport.vue` (`report-table-html` / `report-binder`). */
  applySiteStyles?: boolean;
}

/** Parameters for eSalary specification HTML (browser/XSLT environments). */
export interface ESalaryReportHtmlParams {
  calc: Calculation;
  lang?: Language;
  /** Pre-fetched XSL text; fetched from CDN when omitted. */
  xslText?: string;
}

/**
 * Plain TypeScript utility for generating Salaxy calculation report HTML.
 * Ported from `CalcReport.vue` / `CalcReports.vue`; usable in Browser, Node, and Deno.
 */
export class ReportUtils {
  /**
   * Resolves Handlebars template name from report type and view (see `CalcReports.vue` `reports` map).
   */
  public static resolveTemplateName(
    reportType: TemplateReportType,
    view: ReportView = "partial",
  ): string {
    return REPORT_TEMPLATES[reportType][view];
  }

  /**
   * Generates report HTML as a fragment (inner report markup only).
   */
  public static async generateFragment(params: TemplateReportHtmlParams): Promise<string> {
    const {
      calc,
      reportType,
      view = "partial",
      lang,
      reportOptions = {},
    } = params;

    const templateName = params.templateName ??
      ReportUtils.resolveTemplateName(reportType as TemplateReportType, view);

    const mapperReportType = ReportUtils.toMapperReportType(reportType);
    const renderingLang = lang ?? "fi";
    await Translations.loadLanguage(renderingLang);

    const loadedReportOptions = Objects.copy(reportOptions);
    const reportData: ReportData<CalculationReport> = {
      headerFooter: {},
      layout: {},
      report: {},
    };

    if (Array.isArray(calc)) {
      reportData.report = CalculationMapper.getCalculationSummaryReport(calc, renderingLang) ?? {};
      reportData.headerFooter = CalculationMapper.getCalculationSummaryReportHeaderFooter(
        calc,
        loadedReportOptions,
        renderingLang,
      );
    } else {
      reportData.report = CalculationMapper.getCalculationReport(calc, mapperReportType, renderingLang) ??
        {};
      reportData.headerFooter = CalculationMapper.getHeaderFooter(
        mapperReportType,
        calc,
        loadedReportOptions,
        renderingLang,
      );
    }

    const reportOptionsWithDefaults = ReportUtils.getDefaultReportOptions(
      Objects.copy(loadedReportOptions),
    );
    reportData.layout = CalculationMapper.getReportLayout();
    reportData.layout.hasCustomCss = false;
    reportData.layout.customCss = "";
    reportData.layout.margin = {
      top: reportOptionsWithDefaults.margin?.top,
      right: reportOptionsWithDefaults.margin?.right,
      bottom: reportOptionsWithDefaults.margin?.bottom,
      left: reportOptionsWithDefaults.margin?.left,
    };

    const templates = new Templates();
    reportData.headerHtml = reportOptionsWithDefaults?.headerTemplate
      ? templates.getHtmlDynamic(
        reportOptionsWithDefaults.headerTemplate,
        reportData.headerFooter,
        renderingLang,
      )
      : "";
    reportData.footerHtml = reportOptionsWithDefaults?.footerTemplate
      ? templates.getHtmlDynamic(
        reportOptionsWithDefaults.footerTemplate,
        reportData.headerFooter,
        renderingLang,
      )
      : "";

    const html = templates.getHtml(templateName, reportData, renderingLang);

    if (params.applySiteStyles) {
      return ReportUtils.wrapWithSiteStyles(html);
    }
    return html;
  }

  /**
   * Generates a full HTML document containing the report fragment.
   */
  public static async generateDocument(
    params: TemplateReportHtmlParams & { title?: string },
  ): Promise<string> {
    const fragment = await ReportUtils.generateFragment({
      ...params,
      applySiteStyles: params.applySiteStyles ?? false,
    });
    const lang = params.lang ?? "fi";
    const title = params.title ?? "Report";
    const bodyContent = params.applySiteStyles ? ReportUtils.wrapWithSiteStyles(fragment) : fragment;

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ReportUtils.escapeHtml(title)}</title>
</head>
<body>
${bodyContent}
</body>
</html>`;
  }

  /**
   * Generates eSalary specification HTML via XSLT (optional; requires `DOMParser` and `XSLTProcessor`).
   */
  public static async generateESalaryFragment(params: ESalaryReportHtmlParams): Promise<string> {
    if (!ReportUtils.hasXsltSupport()) {
      throw new Error(
        "eSalary specification HTML requires DOMParser and XSLTProcessor (typically a browser). " +
          "Skip eSalary or run in an environment that provides these APIs.",
      );
    }

    const renderingLang = params.lang ?? "fi";
    await Translations.loadLanguage(renderingLang);

    const xslText = params.xslText ?? await ReportUtils.fetchESalaryXsl();
    const templates = new Templates();
    const xml = templates.getHtml("eSalary", ESalaryMapper.getESalary(params.calc), renderingLang);

    const { DOMParser: DomParser, XSLTProcessor: XsltProcessor } = ReportUtils.getXsltGlobals()!;
    const xsltProcessor = new XsltProcessor();
    const xslDoc = new DomParser().parseFromString(xslText, "text/xml");
    const xmlDoc = new DomParser().parseFromString(xml, "text/xml");
    xsltProcessor.importStylesheet(xslDoc);
    const resultDocument = xsltProcessor.transformToDocument(xmlDoc);
    return resultDocument.documentElement.innerHTML;
  }

  /**
   * Full HTML document for eSalary specification.
   */
  public static async generateESalaryDocument(
    params: ESalaryReportHtmlParams & { title?: string },
  ): Promise<string> {
    const fragment = await ReportUtils.generateESalaryFragment(params);
    const lang = params.lang ?? "fi";
    const title = params.title ?? "eSalary";
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ReportUtils.escapeHtml(title)}</title>
</head>
<body>
${fragment}
</body>
</html>`;
  }

  /** @deprecated Use {@link generateFragment} */
  public static async generateTemplateReportHtml(params: TemplateReportHtmlParams): Promise<string> {
    return await ReportUtils.generateFragment(params);
  }

  private static toMapperReportType(
    reportType: TemplateReportType | ReportType,
  ): ReportType {
    if (reportType === "paymentSummaryReport") {
      return "payerSummaryReport";
    }
    return reportType as ReportType;
  }

  private static getDefaultReportOptions(optionsInput?: ReportOptions): ReportOptions {
    const options = optionsInput || {};
    options.margin = options.margin || {};
    options.margin.top = Numeric.parseNumber(options.margin.top as number) || 30;
    options.margin.right = Numeric.parseNumber(options.margin.right as number) || 10;
    options.margin.bottom = Numeric.parseNumber(options.margin.bottom as number) || 40;
    options.margin.left = Numeric.parseNumber(options.margin.left as number) || 10;
    return options;
  }

  private static wrapWithSiteStyles(html: string): string {
    return `<div class="salaxy-component salaxy-calc-report"><div class="report-table-html"><div class="report-binder table-responsive">${html}</div></div></div>`;
  }

  private static escapeHtml(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  private static hasXsltSupport(): boolean {
    return ReportUtils.getXsltGlobals() !== null;
  }

  private static getXsltGlobals(): {
    DOMParser: new () => {
      parseFromString(source: string, mimeType: string): { documentElement: { innerHTML: string } };
    };
    XSLTProcessor: new () => {
      importStylesheet(style: unknown): void;
      transformToDocument(source: unknown): { documentElement: { innerHTML: string } };
    };
  } | null {
    const g = globalThis as Record<string, unknown>;
    const DOMParserCtor = g["DOMParser"];
    const XSLTProcessorCtor = g["XSLTProcessor"];
    if (typeof DOMParserCtor === "function" && typeof XSLTProcessorCtor === "function") {
      return {
        DOMParser: DOMParserCtor as new () => {
          parseFromString(source: string, mimeType: string): { documentElement: { innerHTML: string } };
        },
        XSLTProcessor: XSLTProcessorCtor as new () => {
          importStylesheet(style: unknown): void;
          transformToDocument(source: unknown): { documentElement: { innerHTML: string } };
        },
      };
    }
    return null;
  }

  private static async fetchESalaryXsl(): Promise<string> {
    const response = await fetch(ESALARY_XSL_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch eSalary XSL from ${ESALARY_XSL_URL}: ${response.status}`);
    }
    return await response.text();
  }
}
