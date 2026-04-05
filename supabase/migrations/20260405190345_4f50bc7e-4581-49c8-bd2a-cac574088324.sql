-- Add stage_type to qc_inspections
ALTER TABLE public.qc_inspections
ADD COLUMN stage_type text NULL;

-- Add NCR re-inspection and routing fields to ncr_register
ALTER TABLE public.ncr_register
ADD COLUMN fix_timeline text NULL,
ADD COLUMN fix_timeline_set_by uuid NULL,
ADD COLUMN fix_timeline_set_at timestamptz NULL,
ADD COLUMN fix_timeline_due_date timestamptz NULL,
ADD COLUMN reinspection_photo_url text NULL,
ADD COLUMN reinspection_notes text NULL,
ADD COLUMN reinspection_completed_by uuid NULL,
ADD COLUMN reinspection_completed_at timestamptz NULL,
ADD COLUMN reinspection_failed boolean DEFAULT false,
ADD COLUMN assigned_to uuid NULL;