<script setup lang="ts">
import { computed, ref } from "vue";
import { useExtApps } from "@quartal/plugin-vue";
import type { CompanySummary, SearchCompaniesResult } from "../lib/types";

const { result, error, sendMessage } = useExtApps<SearchCompaniesResult>({
  name: "SearchCompaniesApp",
  version: "0.1.0",
});

const modeLabel = computed(() => {
  if (!result.value) return "";
  switch (result.value.mode) {
    case "businessId":
      return "Y-tunnushaku";
    case "name":
      return "Nimihaku";
    default:
      return "Tyhjä hakusana";
  }
});

const active = computed<CompanySummary[]>(() => (result.value?.companies ?? []).filter((c) => c.active));
const inactive = computed<CompanySummary[]>(() => (result.value?.companies ?? []).filter((c) => !c.active));

const showInactive = ref(false);

function requestDetails(c: CompanySummary) {
  const label = c.name ? `${c.name} (${c.businessId})` : c.businessId;
  sendMessage(`Näytä yrityksen ${label} tarkat tiedot (getCompanyOverview).`);
}
</script>

<template>
  <div class="card">
    <div class="card-body">
      <h2 class="d-flex align-items-center gap-2">
        <img src="https://cdn.quartal.com/img/integrations/icon/prh.png" alt="PRH" width="28" height="28" />
        PRH Yrityshaku
      </h2>

      <div v-if="error" class="alert alert-warning" role="alert">
        Failed to render: {{ error }}
      </div>

      <div v-else-if="!result" class="text-muted fst-italic">
        Hakutulokset näytetään, kun haku on valmis.
      </div>

      <div v-else>
        <p class="text-muted small mb-3">
          {{ modeLabel }} — {{ result.totalResults }} osumaa
          <span v-if="result.companies.length < result.totalResults"> (näytetään {{ result.companies.length }})</span>
        </p>

        <div v-if="result.companies.length === 0" class="alert alert-info" role="alert">
          Yhtään yritystä ei löytynyt.
        </div>

        <ul v-if="active.length" class="list-group">
          <li v-for="c in active" :key="c.businessId" class="list-group-item d-flex flex-column gap-1">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <span class="fw-bold">{{ c.name }}</span>
                <span v-if="c.companyForm" class="badge bg-secondary ms-2" :title="c.companyFormCode">{{ c.companyForm }}</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <code class="text-muted small">{{ c.businessId }}</code>
                <button type="button" class="btn btn-sm btn-outline-primary" @click="requestDetails(c)">
                  Näytä tarkat tiedot
                </button>
              </div>
            </div>
            <div v-if="c.address" class="text-muted small">{{ c.address }}</div>
            <div v-if="c.mainBusinessLine" class="text-muted small">
              {{ c.mainBusinessLine }}<span v-if="c.mainBusinessLineCode" class="ms-1">({{ c.mainBusinessLineCode }})</span>
            </div>
            <div v-if="c.website" class="small">
              <a :href="c.website" target="_blank" rel="noopener">{{ c.website }}</a>
            </div>
          </li>
        </ul>

        <!-- Inactive companies — hidden by default; user can reveal. -->
        <div v-if="inactive.length" class="mt-3">
          <button
            v-if="!showInactive"
            type="button"
            class="btn btn-link p-0 small"
            @click="showInactive = true"
          >
            Näytä {{ inactive.length }} lakannutta yritystä…
          </button>
          <div v-else>
            <div class="text-muted small mb-2 d-flex justify-content-between align-items-baseline">
              <span>Lakanneet yritykset ({{ inactive.length }})</span>
              <button type="button" class="btn btn-link p-0 small" @click="showInactive = false">Piilota</button>
            </div>
            <ul class="list-group">
              <li
                v-for="c in inactive"
                :key="c.businessId"
                class="list-group-item d-flex flex-column gap-1 opacity-75"
              >
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <span class="fw-bold">{{ c.name }}</span>
                    <span v-if="c.companyForm" class="badge bg-secondary ms-2" :title="c.companyFormCode">{{ c.companyForm }}</span>
                    <span class="badge bg-danger ms-2">Lakannut{{ c.endDate ? ` ${c.endDate}` : "" }}</span>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <code class="text-muted small">{{ c.businessId }}</code>
                    <button type="button" class="btn btn-sm btn-outline-secondary" @click="requestDetails(c)">
                      Näytä tarkat tiedot
                    </button>
                  </div>
                </div>
                <div v-if="c.address" class="text-muted small">{{ c.address }}</div>
                <div v-if="c.mainBusinessLine" class="text-muted small">
                  {{ c.mainBusinessLine }}<span v-if="c.mainBusinessLineCode" class="ms-1">({{ c.mainBusinessLineCode }})</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
