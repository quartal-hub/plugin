import { connectPlugin } from "@quartal/plugin-embed";

/** The plugin to embed from: `?plugin=` or the salaxy-anon sample on its default dev port. */
const pluginUrl = new URLSearchParams(location.search).get("plugin") ?? "http://localhost:4321";
document.querySelector<HTMLAnchorElement>("#plugin-link")!.href = pluginUrl;

const rowsFor = (hours: number) => [{ rowType: "hourlySalary", price: 15.5, count: hours }];

// 1. Script tag: the plugin's widgets.js defines <qrtl-widget> and registers the plugin.
await import(/* @vite-ignore */ `${pluginUrl}/widgets.js`);

const salary = document.querySelector("#salary") as HTMLElement & { args?: Record<string, unknown> };
const hours = document.querySelector<HTMLInputElement>("#hours")!;
const events = document.querySelector("#events")!;
const show = (line: string) => (events.textContent = `${line}\n${events.textContent ?? ""}`.slice(0, 2000));

salary.args = { employmentId: "example-default", rows: rowsFor(Number(hours.value)) };
hours.addEventListener("change", () => {
  salary.args = { employmentId: "example-default", rows: rowsFor(Number(hours.value)) };
});
salary.addEventListener("ready", () => show("ready"));
salary.addEventListener("result", () => show("result"));
salary.addEventListener("error", (e) => show(`error: ${(e as unknown as CustomEvent<{ message: string }>).detail.message}`));
salary.addEventListener("toolcall", (e) => {
  const { name, args } = (e as CustomEvent<{ name: string; args: unknown }>).detail;
  show(`toolcall: ${name} ${JSON.stringify(args)}`);
});

// 2. npm: call the tool over REST, then mount the widget in result mode.
const plugin = connectPlugin({ url: pluginUrl });
const args = { employmentId: "example-default", rows: rowsFor(160) };
const npmResult = document.querySelector("#npm-result")!;
try {
  const result = await plugin.callTool<{ result?: { totals?: { totalGrossSalary?: number } } }>("simpleSalary", args);
  npmResult.textContent = `Gross salary: ${result.result?.totals?.totalGrossSalary ?? "?"} €`;
  plugin.mountWidget(document.querySelector("#npm-widget")!, {
    tool: "simpleSalary",
    args,
    result,
    onToolCall: (call) => {
      npmResult.textContent += `\ntoolcall: ${call.name}`;
    },
  });
} catch (error) {
  npmResult.textContent = `Could not reach ${pluginUrl}: ${error instanceof Error ? error.message : String(error)}`;
}
