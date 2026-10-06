<script setup lang="ts">
import { ref, computed } from "vue";
import { useExtApps } from "@quartal/plugin-vue";
import type { CompanySelection } from "../tools/model/index.ts";
import CurrentUser from "./CurrentUser.vue";

const { result, error, callTool } = useExtApps<CompanySelection>({
  name: "SalaxyCompaniesApp",
  version: "0.1.0",
});

/** The selection after the user picked a company here; supersedes the tool result. */
const picked = ref<CompanySelection | null>(null);
const selection = computed(() => picked.value ?? result.value);
const refreshKey = ref(0);
const busyId = ref<string | null>(null);
const selectError = ref<string | null>(null);

async function select(companyId: string): Promise<void> {
  busyId.value = companyId;
  selectError.value = null;
  try {
    picked.value = await callTool<CompanySelection>("selectCompany", { companyId });
    refreshKey.value++;
  } catch (e) {
    selectError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="card">
    <div class="card-body">
      <CurrentUser :refresh-key="refreshKey" />
      <h2 class="h5">Select company</h2>
      <p class="text-muted small">All Salaxy operations run within the selected company.</p>

      <div v-if="selection">
        <div v-if="selection.companies.length === 0" class="alert alert-info mb-0">
          You have no company with a Salaxy account to work in.
        </div>
        <div class="list-group">
          <button
            v-for="company in selection.companies"
            :key="company.companyId"
            type="button"
            class="list-group-item list-group-item-action d-flex align-items-center"
            :class="{ active: company.companyId === selection.selectedCompanyId }"
            :disabled="busyId !== null"
            @click="select(company.companyId)"
          >
            <img v-if="company.avatar.url" :src="company.avatar.url" :alt="company.name" class="rounded-circle me-3" width="40" height="40" />
            <span
              v-else
              class="rounded-circle me-3 d-inline-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
              :style="{ backgroundColor: company.avatar.color || 'gray', width: '40px', height: '40px' }"
            >{{ company.avatar.initials || company.name[0] }}</span>
            <span class="flex-grow-1">
              <span class="d-block fw-semibold">{{ company.name }}</span>
              <small class="d-block">
                {{ company.businessId || company.salaxyAccountId }}
                <template v-if="company.via === 'team'"> · customer of {{ company.firmName }}</template>
              </small>
            </span>
            <span v-if="busyId === company.companyId" class="spinner-border spinner-border-sm" role="status" />
            <span v-else-if="company.companyId === selection.selectedCompanyId" class="badge bg-light text-dark">Selected</span>
          </button>
        </div>
      </div>
      <div v-else class="text-muted">The companies are shown here once the getCompanies tool completes.</div>

      <div v-if="selectError" class="alert alert-warning mt-3" role="alert">Failed to select company: {{ selectError }}</div>
      <div v-if="error" class="alert alert-warning mt-3" role="alert">Failed to load companies: {{ error }}</div>
    </div>
  </div>
</template>
