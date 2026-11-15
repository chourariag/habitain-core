# HStack Build Roadmap

## In Progress
- [ ] PARITY-1: audit legacy gaps; unify Tier 1 frontend and Wave 1 access; verify rolled-back previews, zero events and unchanged jobs
- [x] P7c: migration 0026 enables MD dated previews; three rolled-back previews verified, MD UI verified at 360px, 16 tests passed; events 0, flag OFF, seven jobs unchanged
- [x] P7b: three-day cap, window-close resolution, effective date and safe as-of preview; requested dated outputs verified in P7c
- [x] P7: migration 0024, shadow rules, flag OFF, hourly job, read-only MD settings and open-reminder lists; signed-in dry run [], 360px no overflow, 11 tests passed; live-delivery checks intentionally not run
- [x] P4e: applied Site Report notification exclusion; verified live function and two legacy-preservation regression tests
- [x] P4d: isolated Daily Report quantities, surfaced rule errors, verified quantity 4 saves and reads back; reported task HTTP 400 as not reproduced
- [x] Lean shell, feature flags, rules, and paused scheduled jobs
- [ ] Project setup Excel import, validation, audit logging, and read-only status views
- [x] Labour master Excel upload and project-scoped contract-labour attendance

## Recently Completed
- Fixed site-readiness-completed-view.test.tsx (storage mock + signed-URL-on-click assertion) — full suite green: 89 passed, 5 skipped

## Recently Completed
- Fix CreateAccountsTab seed data (Awaiz/Nazim)
- Role-resolve hardcoded names in ProjectSetupUpload.tsx
- HR functionality inspection report
