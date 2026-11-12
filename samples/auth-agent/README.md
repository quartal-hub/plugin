# Authentication tester

This is the authenticated tester service for Quartal Plugin. It signs users in through Quartal Hub
(`auth: "quartal-hub"`).

## Tools

| Tool | What it does |
|---|---|
| `getSessionInfo` | The verified context of the call (without the token) |
| `getTokenInfo` | The decoded header and payload of the bearer token |

### Workspace: the Quartal Hub context

The `Workspace` tools use the experimental Quartal Hub context (`getExperimentalHubContext` from
`@quartal/plugin/hub`) to call the real Quartal IAM API and Quartal Files as the signed-in user.

| Tool | What it does |
|---|---|
| `listMyCompanies` | The caller's companies and the selected one |
| `selectCompany` | Selects the company the other tools work in (kept per user) |
| `listFiles` | A folder of the selected company's files; `/` lists the drives |
| `getFile` | A text file's content |
| `saveNote` | Saves a Markdown note to `/data/notes/`, through the `QFsSource` interface of `@quartal/core` |

## Run locally

```sh
cd samples/auth-agent
pnpm dev
```
