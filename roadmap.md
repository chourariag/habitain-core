# HStack Build Roadmap

## In Progress
- [ ] Fix site-readiness-completed-view.test.tsx — broken since 2026-08-31 (commit fccbc31): test mocks `supabase.from` only, but SiteReadinessChecklist now calls `supabase.storage.from().createSignedUrl()` via storage-signed-url.ts. Mock needs a `storage` stub.

## Recently Completed
- Fix CreateAccountsTab seed data (Awaiz/Nazim)
- Role-resolve hardcoded names in ProjectSetupUpload.tsx
- HR functionality inspection report
