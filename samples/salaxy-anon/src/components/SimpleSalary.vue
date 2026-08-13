<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Objects, Translations } from "@salaxy/core";
import type { Language } from "@salaxy/core";
import { CalculationMapper, Templates } from "@salaxy/reports";
import { useExtApps } from "../lib/useExtApps";

type Layout = "tables" | "full";

/**
 * Layout for the rendered Salaxy report fragment:
 * - "tables" (default) — `workerCalculationTablesV2` template, matches
 *   `Calculator.getReportFragment` with view: "partial". Tables only, no header.
 * - "full"             — `salarySlipV2` template, matches `Calculator.getReportDocument`
 *   visual layout. Includes employee/period header above the tables.
 */
const LAYOUT = "tables" as Layout;

const fmt = new Intl.NumberFormat("fi-FI", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

interface Calculation {
  result?: { totals?: { totalGrossSalary?: number } };
  [k: string]: unknown;
}

const { result: calc, error } = useExtApps<Calculation>({
  name: "SimpleSalaryApp",
  version: "0.3.0",
});

const grossText = computed(() => {
  const gross = calc.value?.result?.totals?.totalGrossSalary;
  return typeof gross === "number" ? fmt.format(gross) : null;
});

const reportHtml = ref<string | null>(null);
const renderError = ref<string | null>(null);

watch(calc, async (current) => {
  if (!current) return;
  reportHtml.value = null;
  renderError.value = null;
  try {
    const lang: Language = "fi";
    await Translations.loadLanguage(lang);
    const report = CalculationMapper.getCalculationReport(current, "salarySlip", lang) ?? {};
    const headerFooter = CalculationMapper.getHeaderFooter("salarySlip", current, {}, lang);
    const layout = CalculationMapper.getReportLayout();
    layout.hasCustomCss = false;
    layout.customCss = "";
    const reportData = { report, headerFooter, layout: Objects.copy(layout) };
    const templates = new Templates();
    const templateName = LAYOUT === "full" ? "salarySlipV2" : "workerCalculationTablesV2";
    reportHtml.value = templates.getHtml(templateName, reportData, lang);
  } catch (e) {
    renderError.value = e instanceof Error ? e.message : String(e);
  }
});

const errorText = computed(() => error.value ?? renderError.value);
</script>

<template>
  <div class="card">
    <div class="card-body">
      <h2>
        Palkkalaskelma:
        <span v-if="grossText">{{ grossText }}</span>
        <span v-else class="placeholder">-</span>
      </h2>
      <div v-if="reportHtml" class="report-host">
        <div class="report-table-html">
          <div class="report-binder table-responsive" v-html="reportHtml"></div>
        </div>
      </div>
      <div v-else class="report-host placeholder">Raportti näytetään, kun laskelma valmis.</div>
      <div v-if="errorText" class="alert alert-warning mt-3" role="alert">
        Failed to render: {{ errorText }}
      </div>
    </div>
  </div>
</template>
