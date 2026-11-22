# HStack SEC-5b — CONFIRM (resumed and implemented)

22/11/2026. Supersedes the inspection-only stop report. The follow-up expressly authorised `{"trigger":"scheduled"}` for the five replacement jobs.

## INSPECT: bodies verified unread before any change

The complete sources were read and every `req` reference enumerated at 11:10:24–11:10:40 UTC. No incoming `json()`, `text()`, `formData()`, `arrayBuffer()`, `blob()` or body access existed. Slack helpers parse **outgoing provider responses**, not the incoming request.

| Function | Pre-change line evidence | Current line evidence | Finding |
|---|---|---|---|
| auto-submit-draft-expenses | handler 4, OPTIONS 5; own clock 16–18 | handler 5, OPTIONS 6, auth 7–8; own clock 19–21 | Incoming body unread; only original req use was OPTIONS |
| daily-checkin-nudge | handler 58, OPTIONS 59, error logger 136; own clock 15–32,61,122 | handler 59, OPTIONS 60, auth 61–62, logger 139 | Incoming body unread; original req uses were OPTIONS and error logging |
| approval-rejection-dm | handler 34, OPTIONS 35, error logger 137; own clock 37,124 | handler 35, OPTIONS 36, auth 37–38, logger 140 | Incoming body unread; original req uses were OPTIONS and error logging |
| error-attribution-dm | handler 41, OPTIONS 42; clock-based notified updates 71,117 | handler 42, OPTIONS 43, auth 44–45 | Incoming body unread; only original req use was OPTIONS |

`_shared/error-log.ts:20–25` reads only `params.req.url` to extract a pathname (line 22); no request body is read. Tests replace all incoming body-reading methods and the body getter with throwing traps; all four managed-auth success paths pass.

## Writes/sends and duplicate risk (unchanged)

| Function | Writes or sends | Sequential rerun protection | Residual duplicate/loss risk |
|---|---|---|---|
| auto-submit-draft-expenses | On IST day 5/20, draft expenses → pending_hr, then HR notification for changed entries | Conditional draft update is idempotent for already-transitioned rows | Update and notification are separate; failure after transition can lose notification. New drafts can legitimately create another batch. No notification dedupe log |
| daily-checkin-nudge | Slack DMs for active users without today's sign-in plus channel rollup; technical-error logging on failure | None: rerun repeats DMs and rollup | No claim/dedupe log/notified flag; overlapping runs can duplicate sends |
| approval-rejection-dm | Submitter Slack DM and approval_rejection_dm_log row regardless of delivery outcome | Logged approval IDs are skipped on later ordinary runs | Send precedes log: concurrent reads/crash/failed insert can repeat DM; failed delivery intentionally not retried |
| error-attribution-dm | Slack user DMs; error_log notified flags, timestamps and notify_error; system rows marked without DM | Successfully updated notified flag prevents ordinary resend | Send precedes flag update: overlap/crash/update failure can duplicate; no atomic pre-send claim |

No send text, recipient selection, database predicates, dedupe/log/flag behavior or retry behavior was changed. Only cron authentication was added to these four functions.

## Exact supported mechanism and cutover order

1. `create_http_schedule` created all five replacements with their old names plus `-managed`, unchanged UTC expressions, Edge Function target names, and static body `{"trigger":"scheduled"}`. The tool, not application-authored SQL, supplies the generated LOVABLE_CRON_SECRET bearer and canonical target/body metadata, as with export-nightly row 37.
2. After all five succeeded (38–42), one `run_sql` DO statement called `cron.alter_job(id, active := false)` for **21,31,32,33,34 only**, atomically. It checked the restricted IST windows before disabling. Old names, expressions, commands, bodies and rows were retained, not deleted.
3. Only after disabling the five old rows, imported/called generated `authenticateCronRequest` in each callback immediately after the existing OPTIONS preflight and before any service-key read/client creation. Denials preserve 401 and include existing CORS headers. No manual-user fallback was added to these cron-only callbacks.
4. Removed PENDING_HEADERS and its skip-selection logic; all 39 repository guard assertions now execute.
5. Deployed exactly the four callbacks and existing kpi-recompute, then created ONE daily KPI schedule (43). No other machine schedules created.

Schedule creation/old-row disabling took place after 11:10:40 and before 11:11:36 UTC (16:40:40–16:41:36 IST). Code deployment and KPI schedule creation completed before 11:12:23 UTC (16:42:23 IST). Thus all cutover changes were outside 12:50–13:40 / 16:50–17:40 IST and outside the 5th/20th midnight restriction. The replacements briefly coexisted active while creation finished, as required by create-first order, but old rows were disabled well before the next five-minute tick at 11:15 UTC. There is no atomic multi-create supported API; the disable operation itself was atomic.

## Before/after schedule table

Cron expressions are UTC. Unmarked old credentials are **unknown** from safe metadata and are not asserted from historical backup. Managed credentials are the platform-generated bearer (never exposed or embedded in source).

| ID | Name | Cron before → after | Active before → after | Credential before → after |
|---|---|---|---|---|
| 21 | auto-submit-draft-expenses-5-20 | 5 0 5,20 * * → same | true → false | Unmarked/unknown → unchanged |
| 31 | daily-checkin-nudge-1300-ist | 30 7 * * * → same | true → false | Unmarked/unknown → unchanged |
| 32 | daily-checkin-nudge-1700-ist | 30 11 * * * → same | true → false | Unmarked/unknown → unchanged |
| 33 | approval-rejection-dm-5min | */5 * * * * → same | true → false | Unmarked/unknown → unchanged |
| 34 | error-attribution-dm-5min | */5 * * * * → same | true → false | Unmarked/unknown → unchanged |
| 38 | auto-submit-draft-expenses-5-20-managed | absent → 5 0 5,20 * * | absent → true | None → generated cron bearer |
| 39 | daily-checkin-nudge-1300-ist-managed | absent → 30 7 * * * | absent → true | None → generated cron bearer |
| 40 | daily-checkin-nudge-1700-ist-managed | absent → 30 11 * * * | absent → true | None → generated cron bearer |
| 41 | approval-rejection-dm-5min-managed | absent → */5 * * * * | absent → true | None → generated cron bearer |
| 42 | error-attribution-dm-5min-managed | absent → */5 * * * * | absent → true | None → generated cron bearer |
| 43 | kpi-recompute-daily | absent → 35 18 * * * | absent → true | None → generated cron bearer |

38–43 all have target_kind=edge_function and body `{"trigger":"scheduled"}`. Targets in ID order: auto-submit-draft-expenses, daily-checkin-nudge, daily-checkin-nudge, approval-rejection-dm, error-attribution-dm, kpi-recompute.

Read-back lists twice confirmed only one active replacement for each old schedule slot, no duplicate replacement rows, old rows disabled, and exactly one KPI daily row. The two different nudge slots are intentional, not duplicates. Snapshot tests assert concrete names/expressions/states and exactly one active row per old/new pair. No authenticated sender was manually invoked to test idempotency.

### Explicitly untouched schedules

35 uptime-health-check: `*/10 * * * *`, active true; 36 reminders-hourly: `5 * * * *`, active true; 37 export-nightly-0130-ist: `0 20 * * *`, active true, target export-nightly, body `{"trigger":"scheduled"}`. All returned identical safe metadata before/after.

Cadence preserved: approval and error checks each run 288 times/day with up to five-minute scheduling delay (plus execution). This retains existing recurring Cloud compute costs; no extra permanent polling was introduced. Nudges remain twice daily; KPI adds one daily computation.

## KPI auth/caller correction

Existing kpi-recompute already had generated cron authentication and checked user_roles-based Tier 1/Super manual fallback; neither role grants nor auth fallback changed. No active KPI schedule existed before.

Inspection found the bare page call/body null fell through to 400 because only URL mode/user_id had been recognised. A managed bare-target POST would have the same defect. The handler now defaults an absent URL mode to **daily**; explicit daily/weekly/user_id paths retain their existing meaning. This enables the requested bare managed target without query-string hacks, new functions or notification-mode changes. The managed daily path never invokes the weekly digest.

The KPI page delegates refresh to `refreshKpiForRole` using **actualRole**, not a selected persona. It returns before any session lookup or invocation for non-Tier 1/Super callers, obtains the signed-in session, and explicitly sends its bearer for eligible callers. No-session means no call. Tests cover all four directors, Super, chairman, finance manager, Planning, QS, site engineer, factory supervisor and signed-out/null.

## Live denials and first managed ticks

| Function | Empty Authorization (no preview JWT injected) | Wrong bearer | First managed tick evidence / due |
|---|---|---|---|
| auto-submit-draft-expenses | 401 Unauthorized | 401 Unauthorized | Due 05/12/2026 00:05 UTC (05:35 IST); not forced |
| daily-checkin-nudge | 401 Unauthorized | 401 Unauthorized | ID40 due 22/11/2026 11:30 UTC (17:00 IST); ID39 due 23/11/2026 07:30 UTC (13:00 IST); not forced |
| approval-rejection-dm | 401 Unauthorized | 401 Unauthorized | Natural tick 22/11/2026 11:15:04.847 UTC: HTTP 200. Function log: processed 0, DMs sent 0, failed 0 |
| error-attribution-dm | 401 Unauthorized | 401 Unauthorized | Natural tick 22/11/2026 11:15:03.491 UTC: HTTP 200; no sender was forced |
| kpi-recompute | Existing auth unchanged | Existing auth unchanged | ID43 due 22/11/2026 18:35 UTC = 23/11/2026 00:05 IST; not forced |

Note: auto-submit's original cron is **00:05 UTC**, not 00:05 IST; its timing was preserved exactly as instructed. The prohibited midnight window was respected independently.

HTTP tick statuses were read from function_edge_logs analytics (11:15–11:16:30 UTC), and approval completion from function logs. Direct cron execution-history inspection was refused by the supported read tool; no workaround or raw command/credential read was used. Remaining due ticks are not claimed observed. No test emails, notifications or DMs were sent. Natural scheduled execution remained enabled as requested.

## Test and browser evidence

- Focused: 3 files / **75 passed, 0 skipped** (39 guard + 17 handler/body + 19 role/schedule assertions).
- Full suite: **53 files passed, 703 tests passed, 0 skipped**, 71.96 seconds, started 11:13:44 UTC. Previous four PENDING_HEADERS skips are now real passing assertions. Added 36 tests.
- Mocked missing/wrong/user bearer paths for all four return 401 **before service-key reads, client creation, database writes, logging or sending**. Managed bearer reaches original processing with body unread. Auto-submit tested on mock IST day 5; nudge rollup send is mocked, no network.
- Mocked KPI bare managed target returns 200 with mode daily rather than 400 and sends no digest.
- Signed-in Playwright restored the user's session. `/kpi` redirected to `/dashboard`: live `feature_flags.kpis=false`, unchanged. Thus actual KPI screen selection cannot be verified without a forbidden flag change. Browser execution of the real imported refresh helper showed finance_manager makes zero requests, managing_director makes exactly one bearer-bearing request; the endpoint was intercepted and mocked to prevent live computation. This is helper/session verification, **not** an end-to-end KPI page click.
- Preview build entries at 11:12:01 and 11:13:23 UTC: **build OK**.
- reminder_events: **0 at 11:10:35.803215 UTC → 0 at 11:15:57.342230 UTC**. Only read-only counts; no reminder_events writes.

## Inactive machine / no-active-job inventory for your decision

No jobs below were created or enabled. Intended UTC expressions copied from scheduled-jobs.ts; live absence checked against the final scheduler list. The static snapshot's pre-existing measurement-submission-checks active label remains untouched but is not live evidence: no current live row exists.

Machine mappings: dispatch-14-day-trigger → same; fixed-asset-service-reminders → fixed-asset-service-reminders-daily; labour-claim-sla-escalation → same; measurement-submission-checks → measurement-submission-checks-8pm-ist; salary-review-notifier → salary-review-notifier-daily; site-schedule-trigger → site-schedule-dispatch-reminders-daily; weekly-report-reminders → same; work-order-escalation → work-order-escalation-daily. KPI weekly remains inactive. AI-agent and SQL-only intentions are included below; this list does not imply every job is an Edge Function.

| Intended job | Intended UTC cron | Active live schedule |
|---|---|---|
| ai-agent-cashflow-predictor | 30 14 * * 0 | None |
| ai-agent-client-approval-chaser | 0 4 * * * | None |
| ai-agent-daily-readiness | 0 2 * * 1-5 | None |
| ai-agent-deal-stagnation | 30 3 * * * | None |
| ai-agent-dispatch-risk | 30 2 * * * | None |
| ai-agent-labour-cost | 30 12 * * 5 | None |
| ai-agent-long-leave-warning | 30 13 * * 0 | None |
| ai-agent-lost-deal-pattern | 30 1 1,15 * * | None |
| ai-agent-po-anomaly | 30 4 * * * | None |
| ai-agent-qc-pattern | 30 1 * * 1 | None |
| ai-agent-reorder-alert | 30 1 * * 1 | None |
| ai-agent-statutory-reminder | 30 2 * * * | None |
| ai-agent-subcontractor-monitor | 30 3 * * * | None |
| ai-agent-weekly-coaching | 30 1 * * 1 | None |
| amc-followup-daily | 0 9 * * * | None |
| cv-alert-overdue-commitments-daily | 0 9 * * * | None |
| design-stage-overdue-sweep-daily | 30 2 * * * | None |
| dispatch-14-day-trigger | 15 2 * * * | None |
| fixed-asset-service-reminders-daily | 30 0 * * * | None |
| kickoff-meeting-daily | 0 9 * * * | None |
| kpi-recompute-weekly | 30 2 * * 1 | None |
| labour-claim-sla-escalation | */15 * * * * | None |
| measurement-submission-checks-8pm-ist | 30 14 * * * | None |
| project-archive-upload-reminders | 45 9 * * * | None |
| salary-review-notifier-daily | 0 3 * * * | None |
| site-schedule-dispatch-reminders-daily | 30 3 * * * | None |
| weekly-report-reminders | */15 * * * * | None |
| work-order-escalation-daily | 30 3 * * * | None |

## Scope and release

No changes to roles/accounts, RLS, storage, exports, reports, attendance, Running Bill, reminder_events, feature-flag values, other schedules or other inactive functions. No new Edge Functions, no bulk security fixes. Functions are already deployed and schedules live. Future ticks and real delivery at those future times remain unobserved, as explicitly allowed by the due-time evidence requirement. KPI page-click check is blocked only by its existing disabled flag, which was preserved.

**Publish > Update** to release the KPI page caller and scheduled-job snapshot changes.


# SEC-5b addendum — explicit KPI mode (22/11/2026)

This section supersedes the earlier default-daily and page-background-call descriptions; the historical cutover and eight live denial results above remain unchanged.

## Authorisation and body verification

The addendum explicitly overrides the same-body restriction only for original rows 21,31,32,33,34. Managed replacements 38–42 retain `{"trigger":"scheduled"}`. Bodies remain unread in all four callback sources: auto-submit-draft-expenses index.ts:5–8 (req handler, OPTIONS, generated auth only); daily-checkin-nudge:59–62 and 139 (OPTIONS/auth/error logger); approval-rejection-dm:35–38 and 140 (OPTIONS/auth/error logger); error-attribution-dm:42–45 (OPTIONS/auth only). Shared error-log.ts:20–25 reads request URL only. Full request-body traps still pass in handler tests.

## Exact KPI scheduler outcome

A single KPI job already existed (ID43). To avoid creating a duplicate, the supported **update_http_schedule** tool was used rather than create_http_schedule. The requested first target `/kpi-recompute?mode=daily` was submitted with ID43, its expected name and unchanged schedule. The scheduler refused: `classic target_path must be a lowercase Edge Function name`. This attempt changed nothing.

The authorised fallback was implemented and deployed: kpi-recompute index.ts:262–274 reads validated JSON `mode` only when the URL has no mode. Accepted body modes are daily/weekly; explicit URL modes take precedence; no unconditional daily default remains. The existing URL user_id path and explicit URL daily/weekly branches remain in place. Missing mode on a bare call still gives 400. Existing authentication and calculators/upsert key remain unchanged.

ID43 was then updated, not recreated:

| ID | Name | UTC cron before → after | Target before → after | Body before → after | Active | Credential |
|---|---|---|---|---|---|---|
| 43 | kpi-recompute-daily | 35 18 * * * → same | kpi-recompute → same | {"trigger":"scheduled"} → {"mode":"daily"} | true → true | Generated cron bearer, unchanged |

Read-back confirms exactly one daily KPI row and **no weekly KPI row**. All other rows 21/31–42 have identical metadata to the completed cutover above. No five-job recreation, disabling or re-enabling occurred in this addendum.

The query-target attempt, code deployment and job43 body update completed between 11:18:02 and 11:19:05 UTC (16:48:02–16:49:05 IST), before the 16:50–17:40 prohibited window. Later calls were read-only metadata/count checks or local tests, not schedule/deployment changes. The original cutover had completed earlier at 16:40–16:42 IST: the two nudge replacements were created and old rows disabled in the same uninterrupted change, with no wait for a nudge tick. There was no duplicate nudge tick. The earlier report transparently records the brief create-first overlap while the five tool calls finished.

## Page call and tests

The redundant background invocation was **removed** from KPI.tsx, including its helper import and callerRole plumbing. Selecting a scorecard now only selects the scorecard. The retained helper source is no longer imported or called by that page; its explicit JSON daily body was aligned for compatibility without deleting existing code.

- Focused addendum tests: **46 passed / 0 skipped**, 3 files.
- Full regression suite: **713 passed / 0 skipped**, 54 files; started 11:19:50 UTC, duration 72.71 seconds.
- Five rendered KPI-page tests (all four directors and Super) click the scorecard selection and assert **zero function invocations**.
- KPI body-daily handler test uses a tracked fixture user and metric, runs twice, asserts 2 upserts with exactly **one** snapshot key `user_id,kpi_key,period_type,period_date`, period_type daily, date 2026-11-05, and zero sends.
- Explicit URL daily overrides a weekly body and sends no digest. Missing/null/invalid body modes return 400 with zero score writes/sends. Four notification handler body-trap/auth tests still pass, and all guard assertions run without skips.
- Preview: build OK at 11:18:37 and 11:19:35 UTC.
- reminder_events remains **0** at 11:21:22.846655 UTC, compared with 0 before SEC-5b; no writes were made to it.

No real email, notification or DM was sent during testing. No live authorised KPI run was forced: the requested after-publishing safe call applies to the query-string branch, which was rejected, and publishing has not occurred in this turn. The fallback was verified with mocked real-handler upserts and live schedule read-back, not a live score-writing call. First natural KPI run remains due 22/11/2026 18:35 UTC (23/11/2026 00:05 IST), not yet observed. The KPI screen remains gated by the unchanged OFF flag, so hosted screen end-to-end testing remains unavailable without changing that flag.

**Publish > Update** to release removal of the KPI page background call. The explicit body-mode function is already deployed and the single daily job already uses {"mode":"daily"}. No other jobs, flags, roles, accounts, policies, exports, reports or attendance were changed.
