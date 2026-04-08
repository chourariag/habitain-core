
## Sales Pipeline Enhancement Plan

### Database Changes (single migration)
1. **sales_targets** table — per-person, per-division (Habitainer/ADS) monthly/quarterly targets
2. **Add columns to sales_deals**: `client_type` (B2C Home/B2B Corporate/Resort/Hospitality/Developer/Other), `division` (habitainer/ads), `converted_from_ads_deal_id`, `re_engaged_at`, `re_engaged_from_deal_id`, `ec_visit_date`, `ec_visit_hosted_by`, `ec_visit_notes`, `ec_visit_outcome`, `persona_tag`, `delivery_city`, `within_350km`, `referral_count`
3. **sales_handover_checklists** table — checklist items for Won deals
4. **quotation_versions** table — version log per deal with value, scope, payment terms
5. **experience_centre_visits** table — visit logs linked to deals
6. Update `lead_source` enum values on deals
7. Add `sales_content_links` to app_settings (YouTube, Instagram links)

### UI Changes
1. **Sales Settings page** — division targets per salesperson (new tab or section)
2. **DealDrawer** — add client_type field (required), division field, EC visit button
3. **SalesMetricsBar** — dual progress bars (H vs ADS), lead channel breakdown, EC visit conversion comparison
4. **PipelineKanban** — stagnation badges on deals exceeding threshold
5. **Won Deal Handover Checklist** — modal/drawer when stage changes to Won
6. **Quotation Version Log** — tab/section in DealDrawer for version history
7. **Client Database tab** — full client view with all requested columns
8. **Prospects Database tab** — leads breakdown view
9. **Lost Deal Re-engagement** — enhanced notification with content links, "Mark Re-Engaged" button
10. **KPI pre-seed** — insert KPI targets via data insert

### Implementation Order
1. Database migration (all tables + columns)
2. Update DealDrawer with new fields (client_type, division)
3. Sales Settings with dual targets
4. Handover Checklist for Won deals
5. Quotation Version Log
6. EC Visit tracking
7. Client & Prospects Database tabs
8. Stagnation alerts + Re-engagement enhancements
9. Enhanced metrics bar
10. KPI pre-seed data
