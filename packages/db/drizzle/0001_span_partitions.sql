-- Spans are range-partitioned by month (see 0000_init). Partitions are created on demand by the
-- worker before it writes a batch, and dropped by the retention job.
CREATE OR REPLACE FUNCTION ensure_span_partition(month_start date) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  range_start date := date_trunc('month', month_start)::date;
  range_end date := (date_trunc('month', month_start) + interval '1 month')::date;
  partition_name text := 'spans_' || to_char(range_start, 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF spans FOR VALUES FROM (%L) TO (%L)',
    partition_name, range_start, range_end
  );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION drop_span_partitions_before(cutoff date) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  partition record;
  dropped integer := 0;
BEGIN
  FOR partition IN
    SELECT child.relname AS name
    FROM pg_inherits
    JOIN pg_class parent ON parent.oid = pg_inherits.inhparent
    JOIN pg_class child ON child.oid = pg_inherits.inhrelid
    WHERE parent.relname = 'spans'
      AND child.relname ~ '^spans_\d{4}_\d{2}$'
      AND to_date(substring(child.relname from 7), 'YYYY_MM') + interval '1 month' <= cutoff
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', partition.name);
    dropped := dropped + 1;
  END LOOP;
  RETURN dropped;
END;
$$;
