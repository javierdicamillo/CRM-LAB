CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY,
  lead_id uuid REFERENCES records(id) ON DELETE SET NULL,
  property_id uuid REFERENCES records(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
  body text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','failed','received')),
  attempts integer NOT NULL DEFAULT 0,
  next_at timestamptz NOT NULL DEFAULT now(),
  error text,
  external_id text,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_pending_idx ON whatsapp_messages(state,next_at);
CREATE INDEX IF NOT EXISTS whatsapp_messages_lead_idx ON whatsapp_messages(lead_id,created_at DESC);
