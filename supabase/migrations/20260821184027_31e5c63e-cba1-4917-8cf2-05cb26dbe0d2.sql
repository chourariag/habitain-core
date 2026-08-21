-- Normalization: NFKC -> lower -> collapse internal whitespace -> trim -> strip trailing punctuation
CREATE OR REPLACE FUNCTION public.normalize_ledger_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      btrim(
        regexp_replace(
          lower(normalize(coalesce(_name, ''), NFKC)),
          '\s+', ' ', 'g'
        )
      ),
      '[[:punct:]\s]+$', '', 'g'
    ),
  '');
$$;

-- Clean existing stored names of double spacing / stray whitespace (display name stays human-readable)
UPDATE public.ledger_mappings
SET ledger_name = btrim(regexp_replace(normalize(ledger_name, NFKC), '\s+', ' ', 'g'))
WHERE ledger_name <> btrim(regexp_replace(normalize(ledger_name, NFKC), '\s+', ' ', 'g'));

ALTER TABLE public.ledger_mappings
  ADD COLUMN IF NOT EXISTS normalized_name text
    GENERATED ALWAYS AS (public.normalize_ledger_name(ledger_name)) STORED,
  ADD COLUMN IF NOT EXISTS last_fallback_variant text,
  ADD COLUMN IF NOT EXISTS last_fallback_at timestamptz,
  ADD COLUMN IF NOT EXISTS fallback_match_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_mappings_normalized_name_key
  ON public.ledger_mappings (normalized_name);

COMMENT ON COLUMN public.ledger_mappings.normalized_name IS
  'Fallback lookup key only. Display and exact matching always use ledger_name.';
COMMENT ON COLUMN public.ledger_mappings.last_fallback_variant IS
  'Most recent incoming ledger name that matched this mapping via normalization rather than exact string.';