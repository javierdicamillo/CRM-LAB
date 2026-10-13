import { query, database } from "../src/lib/db";
// Never discard an undelivered inquiry automatically.
const stale = Number(
  (
    await query(
      "SELECT count(*) FROM inquiries WHERE acknowledged_at IS NULL AND created_at<now()-interval '30 days'",
    )
  ).rows[0].count,
);
console.log(
  `Consultas pendientes de más de 30 días: ${stale}. Requieren revisión operativa.`,
);
await query(
  "DELETE FROM inquiries WHERE acknowledged_at<now()-interval '7 days'",
);
await query("DELETE FROM request_limits WHERE expires_at<now()");
console.log("Mantenimiento completado.");
await (await database()).close();
