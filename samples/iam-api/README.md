# @samples/iam-api

The tool classes of the Quartal IAM API (`quartal-accounting/iam`, `apps/iam-api`), ported with their
signatures and documentation only: every method throws `not implemented`. The sample shows how a real,
non-trivial API looks under the REST and MCP naming conventions: standard verbs where a method is a plain
CRUD operation, `@rest` paths for nested resources, `id` as a class's own key, and MCP tool names kept
distinct across classes without the framework's `Class_` prefix.

Every method's `@summary` is its path in the original API (`/api/Companies/mine`), so the Swagger UI and
the docs site show the old and the new route side by side. The types the tools used to import from the
API's `lib/` folder live in `src/tools/model/`, one per file.

## Run locally

```sh
cd samples/iam-api
pnpm dev
```

Then open `/` for the docs site, `/open-api.json` for the REST routes and `/mcp/tools.json` for the MCP tools.

## Routes and tool names

| Class.method | REST | MCP tool | implied hints |
|---|---|---|---|
| `Companies.list` | GET /api/companies | `listCompanies` | readOnly |
| `Companies.get` | GET /api/companies/{id} | `getCompanie` | readOnly |
| `Companies.listCustomers` | GET /api/companies/{id}/customers | `listCustomers` | readOnly |
| `Companies.createFromSalaxy` | POST /api/companies/from-salaxy | `createFromSalaxy` | destructive=false |
| `Companies.removeAccess` | DELETE /api/companies/{id}/access | `removeAccess` | destructive, idempotent |
| `Companies.delete` | DELETE /api/companies/{id} | `deleteCompanie` | destructive, idempotent |
| `Directory.listChanges` | GET /api/directory/changes | `listChanges` | readOnly |
| `Directory.getPersonAccess` | GET /api/directory/person-access | `getPersonAccess` | readOnly |
| `Firms.getMe` | GET /api/firms/me | `getMe` | readOnly |
| `Firms.listMembers` | GET /api/firms/{id}/members | `listMembers` | readOnly |
| `Firms.findUser` | GET /api/firms/{id}/users | `findUser` | readOnly |
| `Firms.createMember` | POST /api/firms/{id}/members | `createMember` | destructive=false |
| `Firms.updateMemberRole` | PUT /api/firms/members/{membershipId}/role | `updateMemberRole` | idempotent |
| `Firms.removeMember` | DELETE /api/firms/members/{membershipId} | `removeMember` | destructive, idempotent |
| `Firms.findCustomers` | GET /api/firms/{id}/customers | `findCustomers` | readOnly |
| `Kyc.getStatus` | GET /api/kyc/status | `getStatus` | readOnly |
| `Kyc.start` | POST /api/kyc/start | `start` |  |
| `Operator.findCompanies` | GET /api/operator/companies | `findCompanies` | readOnly |
| `Operator.getCompanyDetails` | GET /api/operator/companies/{companyId} | `getCompanyDetails` | readOnly |
| `Operator.updateCompany` | PUT /api/operator/companies/{companyId} | `updateCompany` | idempotent |
| `Operator.removeCompany` | DELETE /api/operator/companies/{companyId} | `removeCompany` | destructive, idempotent |
| `Operator.searchCustomers` | GET /api/operator/companies/{companyId}/customers | `searchCustomers` | readOnly |
| `Operator.createCustomer` | POST /api/operator/companies/{companyId}/customers | `createCustomer` | destructive=false |
| `Operator.removeCustomer` | DELETE /api/operator/companies/{companyId}/customers/{clientCompanyId} | `removeCustomer` | destructive, idempotent |
| `Operator.findUsers` | GET /api/operator/companies/{companyId}/users | `findUsers` | readOnly |
| `Operator.createCompanyMember` | POST /api/operator/companies/{companyId}/members | `createCompanyMember` | destructive=false |
| `Operator.updateCompanyMemberRole` | PUT /api/operator/members/{membershipId}/role | `updateCompanyMemberRole` | idempotent |
| `Operator.removeCompanyMember` | DELETE /api/operator/members/{membershipId} | `removeCompanyMember` | destructive, idempotent |
| `Operator.createCompanyTeam` | POST /api/operator/companies/{ownerCompanyId}/teams | `createCompanyTeam` | destructive=false |
| `Operator.renameTeam` | PUT /api/operator/teams/{teamId} | `renameTeam` | idempotent |
| `Operator.archiveTeam` | POST /api/operator/teams/{teamId}/archive | `archiveTeam` |  |
| `Operator.createTeamMember` | POST /api/operator/teams/{teamId}/members | `createTeamMember` | destructive=false |
| `Operator.removeTeamMember` | DELETE /api/operator/team-members/{membershipId} | `removeTeamMember` | destructive, idempotent |
| `Operator.createTeamMandate` | POST /api/operator/teams/{teamId}/mandates | `createTeamMandate` | destructive=false |
| `Operator.removeTeamMandate` | DELETE /api/operator/mandates/{mandateId} | `removeTeamMandate` | destructive, idempotent |
| `Operator.createCompanyFromSalaxy` | POST /api/operator/companies/from-salaxy | `createCompanyFromSalaxy` | destructive=false |
| `Operator.addAdmin` | POST /api/operator/add-admin | `addAdmin` |  |
| `Salaxy.createToken` | POST /api/salaxy/token | `createToken` | destructive=false |
| `Salaxy.listCustomerAccounts` | GET /api/salaxy/customer-accounts | `listCustomerAccounts` | readOnly |
| `Salaxy.listCustomerAccountsForUser` | GET /api/salaxy/users/{userId}/customer-accounts | `listCustomerAccountsForUser` | readOnly |
| `Secrets.list` | GET /api/secrets | `listSecrets` | readOnly |
| `Secrets.get` | GET /api/secrets/{id} | `getSecret` | readOnly |
| `Secrets.put` | PUT /api/secrets/{id} | `putSecret` | idempotent |
| `Secrets.delete` | DELETE /api/secrets/{id} | `deleteSecret` | destructive, idempotent |
| `Teams.list` | GET /api/teams | `listTeams` | readOnly |
| `Teams.create` | POST /api/teams | `createTeam` | destructive=false |
| `Teams.update` | PUT /api/teams/{id} | `updateTeam` | idempotent |
| `Teams.archive` | POST /api/teams/{id}/archive | `archive` |  |
| `Teams.addPerson` | POST /api/teams/{id}/members | `addPerson` | destructive=false |
| `Teams.createMandate` | POST /api/teams/{id}/mandates | `createMandate` | destructive=false |
| `Teams.removePerson` | DELETE /api/teams/members/{membershipId} | `removePerson` | destructive, idempotent |
| `Teams.removeMandate` | DELETE /api/teams/mandates/{mandateId} | `removeMandate` | destructive, idempotent |

## Routes and tool names from the original signatures

What the naming conventions made of the classes before the renaming, with the original method names
(`Secrets.get` then took `name`, which resolved to the same `GET /api/secrets` as `Secrets.list` and
failed the build; the table was produced by resolving each method on its own).

| Class.method | REST (as-is) | MCP tool | implied hints |
|---|---|---|---|
| `Companies.mine` | POST /api/companies/mine | `mine` |  |
| `Companies.get` | GET /api/companies | `getCompanie` | readOnly |
| `Companies.customers` | POST /api/companies/customers | `Companies_customers` |  |
| `Companies.addFromSalaxy` | POST /api/companies/add-from-salaxy | `addFromSalaxy` |  |
| `Companies.removeAccess` | DELETE /api/companies/access | `removeAccess` | destructive, idempotent |
| `Companies.deleteCompany` | DELETE /api/companies/company | `Companies_deleteCompany` | destructive, idempotent |
| `Directory.changes` | POST /api/directory/changes | `changes` |  |
| `Directory.personAccess` | POST /api/directory/person-access | `personAccess` |  |
| `Firm.me` | POST /api/firm/me | `me` |  |
| `Firm.members` | POST /api/firm/members | `members` |  |
| `Firm.searchUsers` | POST /api/firm/search-users | `Firm_searchUsers` |  |
| `Firm.addMember` | POST /api/firm/add-member | `Firm_addMember` |  |
| `Firm.setRole` | POST /api/firm/set-role | `Firm_setRole` |  |
| `Firm.endMember` | POST /api/firm/end-member | `Firm_endMember` |  |
| `Firm.searchCompanies` | POST /api/firm/search-companies | `searchCompanies` |  |
| `Kyc.getStatus` | GET /api/kyc/status | `getStatus` | readOnly |
| `Kyc.start` | POST /api/kyc/start | `start` |  |
| `Operator.companies` | POST /api/operator/companies | `companies` |  |
| `Operator.company` | POST /api/operator/company | `company` |  |
| `Operator.updateCompany` | PUT /api/operator/company | `updateCompany` | idempotent |
| `Operator.deleteCompany` | DELETE /api/operator/company | `Operator_deleteCompany` | destructive, idempotent |
| `Operator.customers` | POST /api/operator/customers | `Operator_customers` |  |
| `Operator.addCustomer` | POST /api/operator/add-customer | `addCustomer` |  |
| `Operator.removeCustomer` | DELETE /api/operator/customer | `removeCustomer` | destructive, idempotent |
| `Operator.searchUsers` | POST /api/operator/search-users | `Operator_searchUsers` |  |
| `Operator.addMember` | POST /api/operator/add-member | `Operator_addMember` |  |
| `Operator.setRole` | POST /api/operator/set-role | `Operator_setRole` |  |
| `Operator.endMember` | POST /api/operator/end-member | `Operator_endMember` |  |
| `Operator.createTeam` | POST /api/operator/team | `Operator_createTeam` | destructive=false |
| `Operator.renameTeam` | POST /api/operator/rename-team | `renameTeam` |  |
| `Operator.archiveTeam` | POST /api/operator/archive-team | `archiveTeam` |  |
| `Operator.addTeamMember` | POST /api/operator/add-team-member | `addTeamMember` |  |
| `Operator.endTeamMember` | POST /api/operator/end-team-member | `endTeamMember` |  |
| `Operator.addMandate` | POST /api/operator/add-mandate | `addMandate` |  |
| `Operator.endMandate` | POST /api/operator/end-mandate | `endMandate` |  |
| `Operator.addCompany` | POST /api/operator/add-company | `Operator_addCompany` |  |
| `Operator.addAdmin` | POST /api/operator/add-admin | `addAdmin` |  |
| `salaxy.createToken` | POST /api/salaxy/token | `createToken` | destructive=false |
| `salaxy.customers` | POST /api/salaxy/customers | `salaxy_customers` |  |
| `salaxy.customersForUser` | POST /api/salaxy/customers-for-user | `customersForUser` |  |
| `Secrets.list` | GET /api/secrets | `listSecrets` | readOnly |
| `Secrets.get` | GET /api/secrets **collides with Secrets.list** | `getSecret` | readOnly |
| `Secrets.set` | POST /api/secrets/set | `set` |  |
| `Secrets.remove` | DELETE /api/secrets | `removeSecret` | destructive, idempotent |
| `Teams.list` | GET /api/teams | `listTeams` | readOnly |
| `Teams.create` | POST /api/teams | `Teams_createTeam` | destructive=false |
| `Teams.update` | PUT /api/teams | `updateTeam` | idempotent |
| `Teams.archive` | POST /api/teams/archive | `archive` |  |
| `Teams.addMember` | POST /api/teams/add-member | `Teams_addMember` |  |
| `Teams.addCompany` | POST /api/teams/add-company | `Teams_addCompany` |  |
| `Teams.endMember` | POST /api/teams/end-member | `Teams_endMember` |  |
| `Teams.endCompany` | POST /api/teams/end-company | `endCompany` |  |
