<script setup lang="ts">

import { CellRenderingLogic } from "@salaxy/core";
import type { ContractParty } from "@salaxy/core";

import { useExtApps } from "@quartal/plugin-vue";

const { result } = useExtApps<{ value?: Array<ContractParty> }>({
  name: "GetEmployeesApp",
  version: "0.1.0",
});

</script>

<template>
  <div class="card border-info">
    <div class="card-body">
      <h2>👥 Dummy employees in data</h2>
      <div v-if="result?.value?.length">
        <ul class="list-group">
          <li class="list-group-item d-flex align-items-center" v-for="(c, i) in result.value" :key="i">
            <span v-html="CellRenderingLogic.getAvatar(c.avatar!)"></span>
            <div>
              <div class="fw-bold">{{ c.avatar?.displayName }}</div>
              <div class="text-muted small">{{ c.avatar?.description }}</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
