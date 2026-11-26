// Phase 2: set to true to restore the pre-production checklist, setup approval and GFC stage gates
export const PREPROD_GATES_ENFORCED = false;

// Kept for rollback only: legacy schedule uploads are hidden while the checked schedule builder is used.
export const SCHEDULE_LEGACY_UPLOAD_VISIBLE = false;

// BOQ-1: fresh entry is the single BOQ source. The workbook server guard mirrors this default.
export const BOQ_LEGACY_UPLOAD_VISIBLE = false;