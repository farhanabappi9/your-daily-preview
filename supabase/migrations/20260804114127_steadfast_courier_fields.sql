ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_provider text,
  ADD COLUMN IF NOT EXISTS courier_consignment_id text,
  ADD COLUMN IF NOT EXISTS courier_tracking_code text,
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_error text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_courier_consignment_id_key
  ON public.orders (courier_consignment_id)
  WHERE courier_consignment_id IS NOT NULL;