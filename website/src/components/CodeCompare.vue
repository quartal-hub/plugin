<script setup lang="ts">
import { ref } from "vue";

const ZOD_SAMPLE = `import { z } from "zod";
import { type InferSchema } from "xmcp";

export const schema = {
  name: z.string().describe("User's full name"),
  email: z.string().email().describe("Valid email address"),
  age: z.number().optional().describe("User's age, optional"),
  role: z.enum(["admin", "user"]).describe("User role"),
};

export default async function createUser(
  args: InferSchema<typeof schema>,
) {
  // implementation here
}

// ...plus tool metadata registration, omitted.`;

const QUARTAL_SAMPLE = `/** Input for creating a user. */
export interface CreateUserInput {
  /** User's full name. */
  name: string;
  /**
   * Valid email address.
   * @format email
   */
  email: string;
  /** User's age, optional. */
  age?: number;
  /** User role. */
  role: "admin" | "user";
}

/** A class that manages users. */
export class Users {
  /** Creates a new user. */
  createUser(input: CreateUserInput): string {
    // implementation here
    return "User created: " + input.name;
  }
}`;

const tabs = [
  { key: "quartal", label: "Quartal Plugins — plain TypeScript", code: QUARTAL_SAMPLE },
  { key: "zod", label: "Typical MCP framework — hand-written schemas", code: ZOD_SAMPLE },
];
const active = ref("quartal");
</script>

<template>
  <div class="q-code-compare card shadow-sm overflow-hidden">
    <div class="card-header p-0 bg-dark">
      <ul class="nav nav-tabs border-0 px-2 pt-2">
        <li v-for="tab in tabs" :key="tab.key" class="nav-item">
          <button
            type="button"
            class="nav-link border-0 rounded-top"
            :class="active === tab.key ? 'active fw-semibold' : 'text-light'"
            @click="active = tab.key"
          >
            {{ tab.label }}
          </button>
        </li>
      </ul>
    </div>
    <pre class="m-0 p-3 bg-body-tertiary"><code>{{ tabs.find((t) => t.key === active)?.code }}</code></pre>
  </div>
</template>

<style scoped>
.q-code-compare pre {
  min-height: 26rem;
  font-size: 0.85rem;
  overflow-x: auto;
}
</style>
