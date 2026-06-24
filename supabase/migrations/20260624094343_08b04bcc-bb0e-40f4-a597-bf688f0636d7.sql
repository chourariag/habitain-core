-- Restore missing column-level SELECT grant on profiles.home_base.
-- A recent security migration revoked SELECT and re-granted only a subset of
-- columns, accidentally omitting home_base. PROFILE_SAFE_COLUMNS includes
-- home_base, so the entire Profile page query was failing with
-- "permission denied for table profiles" (HTTP 403) and the role badge /
-- Personal Details Role field rendered as empty / "Unknown".
GRANT SELECT (home_base) ON public.profiles TO authenticated;