# COST-1c CONFIRM

- Inspection: 0056 used cumulative Running Bill `value_earned` at p_to for both its earned card and value-minus-cost, while cost components covered only p_from–p_to. The UI footnote and Excel summary described this mismatch.
- Migration **0057_cost_report_period_earned_value** patches only earned-value fields in `get_cost_report`. `value_earned_period` is capped Running Bill earned(p_to) minus earned(p_from−1); prior term is zero when the range starts on/before the first submitted site or project-linked factory report. `value_earned_cumulative` and `excess_value` remain end-date totals. `value_minus_cost` uses period earned minus period costs. Legacy `value_earned` remains a cumulative compatibility alias; UI/Excel use the explicit new keys.
- Existing STABLE SECURITY DEFINER/search_path/caller gate and authenticated execution remain unchanged; PUBLIC/anon execution remains revoked. No cost component, privacy gate, material snapshot, Running Bill, Rates, flag, role or schedule changed.

## Live rolled-back evidence

| Range / check | Result |
|---|---:|
| Running Bill earned at 22/11/2026 | ₹1,51,000 |
| Running Bill earned at 20/11/2026 (before range start) | ₹78,000 |
| Cost period 21/11/2026–22/11/2026 | ₹73,000 |
| Same-period cost | ₹3,192.34 |
| Period earned minus cost | ₹69,807.66 |
| Cumulative earned to 22/11/2026 | ₹1,51,000 |
| Excess at end (and prior date) | ₹19,500 |
| Range from actual first submitted report 12/11/2026 | Period = cumulative = ₹1,51,000 |
| Full-range own labour regression | ₹6,365.46 |

Since excess is already ₹19,500 before the mid-project range, subtracting capped earned totals does not add it again.

## UI / Excel / tests

- Earned card shows period value. Value-earned-minus-cost card uses period difference and the label **Indicative: same period, excludes overheads and unrated material**.
- Small separate line: **Cumulative value earned to DD/MM/YYYY** plus cumulative amount. Old mismatch footnote removed.
- Actual signed-in 360×800 and 768×1024 layouts seen; no horizontal page scroll, no Cost buttons below 44px, full dates and labels readable. At 360px the live values were ₹73,000, ₹69,807.66 and cumulative ₹1,51,000; no page runtime errors.
- Actual workbook downloaded through the UI and read back: period ₹73,000, cumulative ₹1,51,000, difference ₹69,807.66, cost ₹3,192.34, excess ₹19,500; updated same-period label present.
- Cost tests **30 passed**; focused Cost + Running Bill **38 passed**; full suite **663 passed, 4 pre-existing skips, 0 failures**.
- Rolled-back SQL assertions retained in `src/test/cost-report-period.rollback.sql`; these live checks are separate from Vitest counts.
- Latest automatic build OK.

**Publish > Update.**