# HStack Build Roadmap

## In Progress
- [ ] P4f: submitted/date-scoped quantities, fixed photo previews, corrected empty text, expiring export tokens; verify tests, expired token and 360px views
- [x] P8: private 17-file versioned CSV export, nightly 01:30 IST job, audited hashed tokens, Settings lists; real MD export/readback, all CSV headers, scheduler auth and token revoke verified; 197 tests passed/5 skipped, automatic build OK; unrelated security access review deferred by user
- [x] PARITY-2B: 115 existing src files/11 deployed Edge functions; migration 0030 backs up three scoped functions, wage counts 49/49/49; 192 tests passed/5 skipped, automatic build OK; populated MD mobile views fit 360px, Alerts content blocked by OFF flag
- [x] PARITY-2A: migration 0029 rewrote 319 A with 319 backups; 213 B/7 C/0 D, live definition comparison and authenticated MD/sales/architecture counts verified; events 0 and jobs unchanged; three unrelated security findings pending access review
- [x] PARITY-1 scoped delivery: audit 342 objects, migration 0027/shared UI parity, 112 tests, MD/mobile preview, events 0 and seven jobs unchanged
- [ ] PARITY-1 complete legacy parity and atomic approvals: blocked pending review/authorization of audited legacy objects
- [x] P7d: migration 0028 caps project level 3 at 48 hours; SQL/UI validation, 10 tests, signed-in MD preview and both rolled-back dated previews verified; events 0, flag OFF, seven jobs unchanged
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
