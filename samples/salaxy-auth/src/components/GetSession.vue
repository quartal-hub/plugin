<script setup lang="ts">
import { computed } from "vue";
import { Dates } from "@salaxy/core";
import type { UserSession } from "@salaxy/core";
import { useExtApps } from "@quartal/plugin-vue";
import CurrentUser from "./CurrentUser.vue";

const { result: session, error } = useExtApps<UserSession>({
  name: "SalaxySessionApp",
  version: "0.1.0",
});

const account = computed(() => session.value?.currentAccount ?? null);
const credential = computed(() => session.value?.currentCredential ?? null);
const avatar = computed(() => session.value?.avatar ?? account.value?.avatar ?? null);
const pensionContracts = computed(() => session.value?.settings?.pensionContracts ?? []);
const insuranceContracts = computed(() => session.value?.settings?.insuranceContracts ?? []);

const formatDate = (value?: string): string => (value ? Dates.format(value) : "–");
</script>

<template>
  <div class="card">
    <div class="card-body">
      <CurrentUser />
      <div v-if="session">
        <div class="d-flex align-items-center mb-3">
          <img
            v-if="avatar?.url"
            :src="avatar.url"
            :alt="avatar.displayName ?? 'Avatar'"
            class="rounded-circle me-3"
            width="56"
            height="56"
          />
          <span
            v-else
            class="rounded-circle me-3 d-inline-flex align-items-center justify-content-center text-white fw-bold"
            :style="{ backgroundColor: avatar?.color || 'gray', width: '56px', height: '56px' }"
          >{{ avatar?.initials || "?" }}</span>
          <div>
            <h2 class="h5 mb-0">{{ avatar?.displayName || "Salaxy session" }}</h2>
            <span class="badge" :class="session.isAuthorized ? 'bg-success' : 'bg-warning text-dark'">
              {{ session.isAuthorized ? "Authorized" : "Not authorized" }}
            </span>
          </div>
        </div>

        <dl class="row mb-0">
          <dt class="col-sm-4">Account</dt>
          <dd class="col-sm-8">{{ account?.avatar?.displayName || "–" }} <small class="text-muted">{{ account?.id }}</small></dd>

          <dt class="col-sm-4">Verified</dt>
          <dd class="col-sm-8">{{ account?.isVerified ? "Yes" : "No" }}</dd>

          <dt class="col-sm-4">User</dt>
          <dd class="col-sm-8">
            {{ credential?.avatar?.displayName || credential?.email || "–" }}
            <small v-if="credential?.email" class="text-muted">{{ credential.email }}</small>
          </dd>

          <dt class="col-sm-4">Signed up</dt>
          <dd class="col-sm-8">{{ formatDate(account?.createdAt) }}</dd>

          <dt class="col-sm-4">Pension contracts</dt>
          <dd class="col-sm-8">{{ pensionContracts.length }}</dd>

          <dt class="col-sm-4">Insurance contracts</dt>
          <dd class="col-sm-8">{{ insuranceContracts.length }}</dd>
        </dl>
      </div>
      <div v-else class="text-muted">Session is shown here once the getSession tool completes.</div>
      <div v-if="error" class="alert alert-warning mt-3" role="alert">
        Failed to load session: {{ error }}
      </div>
    </div>
  </div>
</template>
