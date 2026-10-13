CREATE TABLE IF NOT EXISTS portal_settings (id integer PRIMARY KEY CHECK(id=1), instance_id uuid NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS agencies (
 id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL, email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 token_hash text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, lease_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media (
 id uuid PRIMARY KEY, agency_id uuid NOT NULL REFERENCES agencies(id), idempotency_key uuid NOT NULL,
 original_hash text NOT NULL, sha256 text NOT NULL, bytes bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(agency_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS listings (
 id uuid PRIMARY KEY, agency_id uuid NOT NULL REFERENCES agencies(id), source_id uuid NOT NULL,
 revision bigint NOT NULL CHECK(revision>0), status text NOT NULL CHECK(status IN ('published','withdrawn')),
 payload jsonb NOT NULL, parcel jsonb, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(agency_id,source_id)
);
CREATE INDEX IF NOT EXISTS listings_agency_idx ON listings(agency_id,status);
CREATE INDEX IF NOT EXISTS listings_search_idx ON listings USING gin(payload);
CREATE TABLE IF NOT EXISTS inquiries (
 id uuid PRIMARY KEY, agency_id uuid NOT NULL REFERENCES agencies(id), listing_id uuid NOT NULL REFERENCES listings(id),
 source_id uuid NOT NULL, contact jsonb NOT NULL, message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz, crm_inquiry_id uuid
);
CREATE INDEX IF NOT EXISTS inquiries_agency_idx ON inquiries(agency_id,id);
CREATE TABLE IF NOT EXISTS request_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
