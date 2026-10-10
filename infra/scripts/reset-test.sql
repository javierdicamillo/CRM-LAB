-- Solo datos sinteticos creados por integration.mjs. Nunca usar en crm_lab.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'crm_lab_test' THEN RAISE EXCEPTION 'Base no permitida'; END IF;
 IF EXISTS(SELECT 1 FROM "user" WHERE email NOT LIKE '%@example.invalid') THEN RAISE EXCEPTION 'Hay usuarios que no son de prueba'; END IF;
END $$;
DELETE FROM photos;
DELETE FROM outbox;
DELETE FROM inbox;
DELETE FROM records;
DELETE FROM session;
DELETE FROM account;
DELETE FROM staff;
DELETE FROM "user";
DELETE FROM verification;
DELETE FROM audit;
DELETE FROM request_limits;
UPDATE sync_state SET data='{}' WHERE id=1;
COMMIT;
