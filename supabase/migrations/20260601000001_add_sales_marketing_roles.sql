-- Add missing roles for Sales and Marketing staff
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_executive';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing_executive';
