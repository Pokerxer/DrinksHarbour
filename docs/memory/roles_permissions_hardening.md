# Roles permissions hardening — 2026-09-07

The admin `/roles-permissions` route delegates to
`client/apps/admin/src/app/shared/roles-permissions/`.

Latest hardening keeps the People table aligned with server policy:

- `RolesPermissionsView` filters assignable custom roles to active roles for the
  current audience before passing them to `UsersTable`.
- `UsersTable` receives `audience` and locks custom-role assignment by surface:
  platform roles only refine platform `admin`; tenant roles only refine
  `tenant_admin` and `tenant_staff`.
- `super_admin` and `tenant_owner` status actions are disabled from this screen.
- The custom-role select has an explicit `No custom role` option for clearing.

Do not broaden client assignment options unless the server contract changes in
`server/services/user.service.js`, `server/controllers/employee.controller.js`,
and `server/services/role.service.js`.
