-- Sitzplan: jedna JSONB kolona (radi na svim Postgres instancama)
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "sitzplanPdfsData" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Ako postoje stare kolone nizova, prekopiraj u JSON i ukloni ih
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Restaurant' AND column_name = 'sitzplanPdfUrls'
  ) THEN
    EXECUTE $sql$
      UPDATE "Restaurant" r
      SET "sitzplanPdfsData" = (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'url', u.url,
              'fileName', COALESCE(
                CASE
                  WHEN r."sitzplanPdfNames" IS NOT NULL
                    AND array_length(r."sitzplanPdfNames", 1) IS NOT NULL
                    AND u.idx <= array_length(r."sitzplanPdfNames", 1)
                  THEN r."sitzplanPdfNames"[u.idx]
                  ELSE ''
                END,
                ''
              )
            ) ORDER BY u.idx
          ),
          '[]'::jsonb
        )
        FROM unnest(r."sitzplanPdfUrls") WITH ORDINALITY AS u(url, idx)
      )
      WHERE cardinality(r."sitzplanPdfUrls") > 0
    $sql$;

    ALTER TABLE "Restaurant" DROP COLUMN IF EXISTS "sitzplanPdfUrls";
    ALTER TABLE "Restaurant" DROP COLUMN IF EXISTS "sitzplanPdfNames";
  END IF;
END $$;
