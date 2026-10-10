CREATE TABLE IF NOT EXISTS "user" (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 "emailVerified" boolean NOT NULL DEFAULT false, image text,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session (
 id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
 "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_idx ON session("userId");
CREATE TABLE IF NOT EXISTS account (
 id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL,
 "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz,
 "refreshTokenExpiresAt" timestamptz, scope text, password text,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
 UNIQUE("providerId","accountId")
);
CREATE INDEX IF NOT EXISTS account_user_idx ON account("userId");
CREATE TABLE IF NOT EXISTS verification (
 id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
 "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('admin','agent')), active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS settings (id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL);
INSERT INTO settings VALUES(1,'{"agencyName":"CRM-LAB","city":"","phone":"","email":""}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS records (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('contact','property','offer','opportunity','activity')),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), version integer NOT NULL DEFAULT 1,
 revision integer NOT NULL DEFAULT 0, archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS records_kind_idx ON records(kind,updated_at DESC);
CREATE INDEX IF NOT EXISTS records_data_idx ON records USING gin(data);
CREATE TABLE IF NOT EXISTS photos (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES records(id), name text NOT NULL,
 approved boolean NOT NULL DEFAULT false, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_property_idx ON photos(property_id);
CREATE TABLE IF NOT EXISTS outbox (
 id uuid PRIMARY KEY, offer_id uuid NOT NULL REFERENCES records(id), revision integer NOT NULL,
 payload jsonb NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','blocked','superseded')),
 attempts integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now(), error text,
 created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, UNIQUE(offer_id,revision)
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(state,next_at);
CREATE TABLE IF NOT EXISTS inbox (
 id uuid PRIMARY KEY, portal_id uuid NOT NULL, inquiry_id uuid NOT NULL, payload jsonb NOT NULL,
 contact_id uuid REFERENCES records(id), opportunity_id uuid REFERENCES records(id),
 acknowledged boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(portal_id,inquiry_id)
);
CREATE TABLE IF NOT EXISTS audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id text, action text NOT NULL,
 entity_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sync_state (id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL DEFAULT '{}');
INSERT INTO sync_state VALUES(1,'{}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS request_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
