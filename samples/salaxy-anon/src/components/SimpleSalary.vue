<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Numeric } from "@salaxy/core";
import type { Calculation } from "@salaxy/core";
import { createReport } from "@salaxy/reports";
import { useExtApps } from "@quartal/plugin-vue";

const { result: calc, error } = useExtApps<Calculation>({
  name: "SimpleSalaryApp",
  version: "0.3.0",
});

const gross = computed<number | null>(() => calc.value?.result?.totals?.totalGrossSalary ?? null);
const reportHtml = ref<string | null>(null);
const renderError = ref<string | null>(null);
const errorText = computed<string | null>(() => error.value ?? renderError.value);

watch(calc, async (current) => {
  reportHtml.value = null;
  renderError.value = null;
  if (!current) return;
  if (!current.result) {
    renderError.value = "Calculation result is missing.";
    return;
  }
  try {
    reportHtml.value =await createReport({
      calc: current,
      type: "salarySlip",
      language: "fi",
      view: "partial",
    });
  } catch (e) {
    renderError.value = e instanceof Error ? e.message : String(e);
  }
});

</script>

<template>
  <div class="card">
    <div class="card-body">
      <h2>Palkkalaskelma 3: {{ Numeric.formatNumber(gross) }}</h2>
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
