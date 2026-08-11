<script setup lang="ts">
import { computed } from "vue";
import { useExtApps } from "../lib/useExtApps";
import type { CompanyOverview } from "../lib/types";

const { result, error } = useExtApps<CompanyOverview>({
  name: "CompanyOverviewApp",
  version: "0.1.0",
});

const info = computed(() => result.value?.info ?? null);

const mainAddress = computed(() => {
  const addresses = info.value?.addresses ?? [];
  const a = addresses.find((x) => x.type === 1) ?? addresses[0];
  if (!a) return undefined;
  const street = a.street?.trim();
  const postCode = a.postCode?.trim();
  const city = a.postOffices?.[0]?.city?.trim();
  return [street, [postCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
});

const fiBusinessLine = computed(() => {
  const desc = info.value?.mainBusinessLine?.descriptions ?? [];
  return desc.find((d) => d.languageCode === "1")?.description ?? null;
});

const currentForm = computed(() => {
  const forms = info.value?.companyForms ?? [];
  return forms.find((f) => f.version === 1) ?? forms[0];
});

const formatDate = (s?: string | null) => (s ? s : "—");
</script>

<template>
  <div class="card">
    <div class="card-body">
      <h2 class="d-flex align-items-center gap-2">
        <img src="https://cdn.quartal.com/img/integrations/icon/prh.png" alt="PRH" width="28" height="28" />
        Yrityksen tiedot
      </h2>

      <div v-if="error" class="alert alert-warning" role="alert">
        Failed to render: {{ error }}
      </div>

      <div v-else-if="!result" class="text-muted fst-italic">
        Yrityksen tiedot näytetään, kun haku on valmis.
      </div>

      <div v-else>
        <header class="mb-3">
          <h3 class="mb-1">{{ result.displayName ?? result.businessId }}</h3>
          <div class="text-muted">
            <code>{{ result.businessId }}</code>
            <span v-if="currentForm" class="badge bg-secondary ms-2">{{ currentForm.type }}</span>
          </div>
        </header>

        <!-- BASIC INFO (YTJ) -->
        <section class="mb-4">
          <h4>Perustiedot (YTJ)</h4>
          <div v-if="!result.sources.ytj.ok" class="alert alert-warning">
            YTJ ei vastannut: {{ result.sources.ytj.error }}
          </div>
          <div v-else-if="!info" class="alert alert-info">
            YTJ ei tunne tätä yritystä.
          </div>
          <dl v-else class="row mb-0">
            <dt class="col-sm-4">Rekisteröity</dt>
            <dd class="col-sm-8">{{ formatDate(info.registrationDate) }}</dd>

            <template v-if="info.endDate">
              <dt class="col-sm-4">Lakannut</dt>
              <dd class="col-sm-8">{{ formatDate(info.endDate) }}</dd>
            </template>

            <template v-if="mainAddress">
              <dt class="col-sm-4">Osoite</dt>
              <dd class="col-sm-8">{{ mainAddress }}</dd>
            </template>

            <template v-if="fiBusinessLine">
              <dt class="col-sm-4">Toimiala</dt>
              <dd class="col-sm-8">{{ fiBusinessLine }} ({{ info.mainBusinessLine?.type }})</dd>
            </template>

            <template v-if="info.website?.url">
              <dt class="col-sm-4">Verkkosivut</dt>
              <dd class="col-sm-8">
                <a :href="info.website.url" target="_blank" rel="noopener">{{ info.website.url }}</a>
              </dd>
            </template>
          </dl>
        </section>

        <!-- XBRL -->
        <section class="mb-4">
          <h4>Tilinpäätökset (XBRL)</h4>
          <div v-if="!result.sources.xbrl.ok" class="alert alert-warning">
            XBRL ei vastannut: {{ result.sources.xbrl.error }}
          </div>
          <div v-else-if="result.financials.length === 0" class="text-muted">
            Ei digitaalisia tilinpäätöksiä.
          </div>
          <ul v-else class="list-group">
            <li v-for="f in result.financials" :key="f.financialDate" class="list-group-item d-flex justify-content-between">
              <span>Tilikausi päättyi {{ formatDate(f.financialDate) }}</span>
              <span class="text-muted small">Rekisteröity {{ formatDate(f.registrationDate) }}</span>
            </li>
          </ul>
        </section>

        <!-- KREK -->
        <section>
          <h4>Rekisteröidyt ilmoitukset</h4>
          <div v-if="!result.sources.krek.ok" class="alert alert-warning">
            Kaupparekisteri ei vastannut: {{ result.sources.krek.error }}
          </div>
          <div v-else-if="result.notices.length === 0" class="text-muted">
            Ei rekisteröityjä ilmoituksia.
          </div>
          <ul v-else class="list-group">
            <li v-for="n in result.notices" :key="n.recordNumber" class="list-group-item">
              <div class="d-flex justify-content-between">
                <span class="fw-semibold">{{ n.typeOfRegistrationDescription ?? n.typeOfRegistration ?? formatDate(n.registrationDate) }}</span>
                <code class="text-muted small">{{ n.recordNumber }}</code>
              </div>
              <div class="text-muted small">
                {{ formatDate(n.registrationDate) }}
              </div>
              <div v-if="n.entryCodes?.length" class="mt-1">
                <span
                  v-for="(code, i) in n.entryCodes"
                  :key="i"
                  class="badge bg-light text-dark me-1"
                  :title="code"
                >{{ n.entryDescriptions?.[i] ?? code }}</span>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
