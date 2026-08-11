# @samples/prh-opendata

Anonymous integration to the Finnish **Patent and Registration Office (PRH)** Open Data APIs:

- **YTJ** (Yritys- ja yhteisötietojärjestelmä) — basic company info
- **XBRL** — digital financial statements
- **KREK** — registered notices (Kaupparekisteri)

This plugin is optimized for **MCP tool use by agents**: each method has a single, clearly-typed input/output, and the main
`searchCompanies` + `getCompanyOverview` tools cover the two most common agent workflows (find a company, get everything about it).

## Tools

| Tool                                 | Purpose                                                              |
| ------------------------------------ | -------------------------------------------------------------------- |
| `Companies.searchCompanies`          | One-field search; auto-detects Y-tunnus vs. partial name.            |
| `Companies.findCompanies`            | Full multi-criteria YTJ search.                                      |
| `Financials.getFinancialPeriods`     | List XBRL filings for a business ID.                                 |
| `Financials.getFinancialStatement`   | Fetch one XBRL filing as XML.                                        |
| `Financials.listFilers`              | Demo helper: list companies that have filed XBRL.                    |
| `Notices.getCompanyNotices`          | Fetch company + registered notices (codes resolved to descriptions). |
| `CompanyOverview.getCompanyOverview` | **Combined** info + financials + notices in one call.                |

PRH's `/description` and `/post_codes` endpoints are **not exposed as MCP tools** — they return large code lists not suited for direct agent
use. The codes the agent actually needs (KREK `entryCodes`, `typeOfRegistration`) are resolved internally via a 90-day KV cache and merged
into the response: each `publicNotice` carries an `entryDescriptions` array of human-readable text alongside its raw codes. YTJ company
entries already include inline `descriptions` for company forms, name types and industries, so no extra lookup is needed there.

The PRH `/all_companies` daily ZIP dump is also **intentionally not exposed** — it is a large synchronous download that doesn't fit MCP tool
semantics. If you need it, run it as a background job.

## Widgets

Two MCP widgets ship with the plugin:

- `searchCompanies` — list view for the simple search results
- `getCompanyOverview` — details view with sections for info, financials, notices

## Run locally

```sh
cd samples/prh-opendata
deno task build:vue   # one-time / after Vue changes
deno task dev         # starts the server on :8000
```

## Tests

Live tests hit `avoindata.prh.fi` and are **opt-in only** — they don't run under the root `deno task check`. Run them manually before larger
changes:

```sh
cd samples/prh-opendata
deno task test
```

`tests/validation_unit.ts` is a pure unit test (no network) but is also gated behind the plugin's `test` task to keep all PRH tests in one
place. File names intentionally don't match Deno's default `*_test.ts` discovery so that `deno test -A` from the workspace root skips them.
