# BOQ-2b CONFIRM

## Inspection
- `BoqEntry.tsx` sent finalise/revise/save/archive/paste writes through its `boq1_mutate` wrapper and fetched with a direct `boq1_get` call. `BoqLinks.tsx` fetched with a direct `boq2_get` call. Neither had a React Query key before this fix.
- `mapBoqPaste` in `src/lib/boq-entry.ts` mapped pasted strings but did not canonicalise scope/work location. Add row used `data.scopes` from `boq1_get` for scope and a local work-location list. The parser now receives that same `data.scopes` list; both parser and Add row use the shared `BOQ_WORK_LOCATIONS` constant.
- `BoqLinks.tsx` built `Revision needed.` from `data.lock_reason`. `boq2_get` supplies `Links are already locked.` for every locked set and exposes `revision_needed` separately. Only the front-end condition/message changed.

## Files and refresh keys
- `src/lib/boq-query-keys.ts`: project-scoped keys `["boq1_get", projectId]` and `["boq2_get", projectId]`.
- `src/components/projects/BoqEntry.tsx`: React Query fetch; successful save (including archive-item and paste), revise and finalise invalidate `boq2_get` for that project. Paste uses the Add row scope list and shared work-location constant.
- `src/components/projects/BoqLinks.tsx`: React Query fetch; every successful `boq2_mutate` invalidates `boq1_get` for that project. Locked broken/incomplete sets show: `Revision needed: N line(s) have broken or incomplete links. Open each line below, fix it, then Submit revision.` `Links are already locked.` is shown only for a locked complete set.
- `src/lib/boq-entry.ts`: trim/case-insensitive canonical matching and valid-value row errors; `src/lib/boq-links.ts`: locked-notice helper.
- Tests: `src/test/boq1-entry.test.ts`, `src/test/boq2-links.test.ts`, and new `src/test/boq2b-refresh.test.tsx`.

## Tests
- Paste work locations `Factory`, `FACTORY`, and ` factory ` all accepted and stored as `factory`; scope matching is also trim/case-insensitive and returns the canonical Add row value.
- Unknown scope `Foo` reports: `Scope 'Foo' is not valid. Use: Both, Factory, Habitainer, On-Site Civil.` Unknown work location lists `Use: site, factory.`
- Locked broken-set wording and affected-line count tested; complete locked and draft notice conditions tested.
- Component test finalises a fresh draft and observes `This project has no BOQ yet.` replaced by the lines table through a second `boq2_get`, then confirms a links lock refreshes `boq1_get`.
- Full suite: **1,007 tests in 76 files passed** (`--maxWorkers=2`). The first default-parallel run had two unrelated 5-second timeouts; both passed alone and in the green full run.
- TypeScript check passed. Latest preview build: OK.

## Migration and screenshots
- **No migration added. No database function, table, RLS policy, grant, schedule/report reader, BOQ rule, role, account, flag or cron changed.**
- `docs/boq2b-evidence/links-after-finalise-1440.png` and `links-after-finalise-390.png` show the links panel immediately after finalise, with no reload; the phone image is the same page resized after finalise.
- Screenshots use Gaurav's signed-in project shell but **mocked BOQ responses and a mocked finalise**; no real BOQ was finalised or changed. The browser recorded two `boq2_get` reads, one mocked finalise, a preserved no-reload marker, no page errors and no page-level horizontal overflow at 390 px.
- A real browser finalise against live data was deliberately not run; the component flow and browser flow use mocks.
