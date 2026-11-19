import type { QuartalPluginContext } from "@quartal/plugin-core";
import { getExperimentalHubContext } from "@quartal/plugin/hub";

/**
 * The id of the caller's selected Hub company: the company whose inbox the tools work on.
 * @throws An error that tells the model what to do when no company is selected.
 */
export async function requireCompany(ctx: QuartalPluginContext): Promise<{ companyId: string; name: string }> {
  const selected = await getExperimentalHubContext(ctx).companies.getSelected();
  if (!selected) {
    throw new Error("No company selected: pick one with selectCompany (it lists the choices when called without an id).");
  }
  return { companyId: selected.companyId, name: selected.name };
}
