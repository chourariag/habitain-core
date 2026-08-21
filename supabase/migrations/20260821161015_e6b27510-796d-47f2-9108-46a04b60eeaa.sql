ALTER TABLE public.sales_pipeline_leads ALTER COLUMN segment DROP NOT NULL;
ALTER TABLE public.sales_pipeline_leads DROP CONSTRAINT IF EXISTS sales_pipeline_leads_source_check;
ALTER TABLE public.sales_pipeline_leads ADD CONSTRAINT sales_pipeline_leads_source_check CHECK (source IS NULL OR source = ANY (ARRAY[
  'Lead Gen','Repeat','Referral','Add''l SOW',
  'Direct Call','Website Form','Ads','WhatsApp','Webinar','Walk-in','Coorg Shandy','Interakt','Email','Reference','Other'
]));