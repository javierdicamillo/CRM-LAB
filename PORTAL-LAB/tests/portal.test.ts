import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";
process.env.PORTAL_LOCAL_DB = ":memory:";
Object.assign(process.env, { NODE_ENV: "test" });
process.env.PORTAL_ORIGIN = "http://localhost:3100";
const { migrate } = await import("../scripts/migrate");
const { query, database } = await import("../src/lib/db");
const { hash } = await import("../src/lib/http");
const { protocol } = await import("../src/lib/protocol");
const { catalog, mapCatalog, publicListing, submitInquiry, mediaResponse } =
  await import("../src/lib/catalog");
const { lookupParcel, normalizeNomenclature, CadastreError } = await import(
  "../../contracts/cadastre"
);
const contract = JSON.parse(
  readFileSync(
    new URL("../../contracts/openapi.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const valid = (name: string, value: unknown) => {
  const check = ajv.compile({
    $ref: `#/components/schemas/${name}`,
    components: contract.components,
  });
  assert.equal(check(value), true, JSON.stringify(check.errors));
};
await migrate();
after(async () => {
  await (await database()).close();
});
const tokenA = "a".repeat(48),
  tokenB = "b".repeat(48),
  a = randomUUID(),
  b = randomUUID();
await query(
  "INSERT INTO agencies(id,slug,name,token_hash) VALUES($1,'a','Agencia A',$2),($3,'b','Agencia B',$4)",
  [a, hash(tokenA), b, hash(tokenB)],
);
async function api(
  path: string,
  method = "GET",
  value?: unknown,
  token = tokenA,
  extra: Record<string, string> = {},
) {
  const headers = { Authorization: `Bearer ${token}`, ...extra };
  return protocol(
    new Request(`http://localhost:3100/v1/${path}`, {
      method,
      headers,
      body:
        value === undefined
          ? undefined
          : value instanceof Buffer
            ? new Uint8Array(value)
            : JSON.stringify(value),
    }),
  );
}
const source = randomUUID(),
  photoKey = randomUUID();
let media: string, id: string;
const listing: any = {
  source_property_id: randomUUID(),
  title: "Casa de prueba",
  description: "Descripción pública.",
  operation: "sale",
  property_type: "house",
  price: { amount: "120000", currency: "USD", period: "total" },
  location: { country_code: "AR", region: "Neuquén", city: "Neuquén" },
  area_m2: 120,
  media_ids: [],
};
test("contrato, aislamiento, fotos, revisiones, reconciliación y entrega de consultas", async (t) => {
  await t.test(
    "autenticación y capacidades compatibles con el CRM",
    async () => {
      assert.equal(
        (await api("capabilities", "GET", undefined, "invalid")).status,
        401,
      );
      const r = await api("capabilities");
      assert.equal(r.status, 200);
      valid("Capabilities", await r.json());
    },
  );
  await t.test(
    "fotos: idempotencia, recodificación y ausencia de acceso público anticipado",
    async () => {
      const photo = await sharp({
        create: { width: 40, height: 40, channels: 3, background: "#456" },
      })
        .webp()
        .toBuffer();
      const headers = {
        "Content-Type": "image/webp",
        "Idempotency-Key": photoKey,
      };
      const response = await api("media", "POST", photo, tokenA, headers);
      assert.equal(response.status, 201);
      const result = await response.json();
      valid("MediaReceipt", result);
      media = result.media_id;
      listing.media_ids = [media];
      assert.deepEqual(
        await (await api("media", "POST", photo, tokenA, headers)).json(),
        result,
      );
      const other = await sharp({
        create: { width: 40, height: 40, channels: 3, background: "#abc" },
      })
        .webp()
        .toBuffer();
      assert.equal(
        (await api("media", "POST", other, tokenA, headers)).status,
        409,
      );
      assert.equal((await mediaResponse(media)).status, 404);
    },
  );
  await t.test("rechaza campos privados y medios ajenos", async () => {
    assert.equal(
      (
        await api(`listings/${source}`, "PUT", {
          status: "published",
          revision: 1,
          listing: { ...listing, ownerId: randomUUID() },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await api(
          `listings/${source}`,
          "PUT",
          { status: "published", revision: 1, listing },
          tokenB,
        )
      ).status,
      422,
    );
    assert.equal((await catalog({})).count, 0);
    assert.equal((await mapCatalog()).length, 0);
  });
  await t.test(
    "revisión idempotente y conflicto sin sobrescribir",
    async () => {
      const input = { status: "published", revision: 2, listing };
      const response = await api(`listings/${source}`, "PUT", input);
      assert.equal(response.status, 200);
      const receipt = await response.json();
      valid("ListingReceipt", receipt);
      id = receipt.public_listing_id;
      assert.deepEqual(
        await (await api(`listings/${source}`, "PUT", input)).json(),
        receipt,
      );
      assert.equal(
        (await api(`listings/${source}`, "PUT", { ...input, revision: 1 }))
          .status,
        409,
      );
      assert.equal(
        (
          await api(`listings/${source}`, "PUT", {
            ...input,
            listing: { ...listing, title: "Otro" },
          })
        ).status,
        409,
      );
      assert.equal((await catalog({})).count, 0);
      assert.equal((await mapCatalog()).length, 0);
    },
  );
  await t.test(
    "solo una reconciliación exacta habilita catálogo y fotos",
    async () => {
      const fail = await (
        await api("reconcile", "POST", { active_listings: [] })
      ).json();
      assert.equal(fail.matched, false);
      valid("ReconcileReceipt", fail);
      assert.equal((await catalog({})).count, 0);
      assert.equal((await mapCatalog()).length, 0);
      const result = await (
        await api("reconcile", "POST", {
          active_listings: [{ source_listing_id: source, revision: 2 }],
        })
      ).json();
      valid("ReconcileReceipt", result);
      assert.equal(result.matched, true);
      assert.equal((await catalog({ q: "Casa" })).count, 1);
      assert.equal((await catalog({ q: "Sin coincidencia" })).count, 0);
      assert.equal((await catalog({ operation: "rent" })).count, 0);
      assert.equal((await publicListing(id)).listing.title, listing.title);
      assert.equal((await mediaResponse(media)).status, 200);
      const index = await (await api("listings")).json();
      valid("IndexPage", index);
      assert.equal(index.items.length, 1);
      assert.equal(
        (await (await api("listings", "GET", undefined, tokenB)).json()).items
          .length,
        0,
      );
    },
  );
  await t.test(
    "consulta pública, entrega aislada y ACK idempotente",
    async () => {
      const input = {
        listingId: id,
        name: "Persona de prueba",
        email: "test@example.invalid",
        phone: "",
        message: "Consulta de prueba",
        consent: true,
      };
      const submit = (v: any, origin = "http://localhost:3100") =>
        submitInquiry(
          new Request("http://localhost:3100/api/inquiries", {
            method: "POST",
            headers: { origin, "Content-Type": "application/json" },
            body: JSON.stringify(v),
          }),
        );
      assert.equal((await submit(input, "https://otro.invalid")).status, 403);
      assert.equal((await submit({ ...input, consent: false })).status, 422);
      assert.equal((await submit({ ...input, email: "" })).status, 422);
      assert.equal((await submit(input)).status, 201);
      const page = await (await api("inquiries")).json();
      valid("InquiryPage", page);
      assert.equal(page.items.length, 1);
      assert.equal(
        (await (await api("inquiries", "GET", undefined, tokenB)).json()).items
          .length,
        0,
      );
      const inquiry = page.items[0].inquiry_id,
        crmId = randomUUID();
      assert.equal(
        (
          await api(
            `inquiries/${inquiry}/ack`,
            "POST",
            { crm_inquiry_id: crmId },
            tokenB,
          )
        ).status,
        404,
      );
      const receipt = await (
        await api(`inquiries/${inquiry}/ack`, "POST", { crm_inquiry_id: crmId })
      ).json();
      valid("AckReceipt", receipt);
      assert.deepEqual(
        await (
          await api(`inquiries/${inquiry}/ack`, "POST", {
            crm_inquiry_id: crmId,
          })
        ).json(),
        receipt,
      );
      assert.equal(
        (
          await api(`inquiries/${inquiry}/ack`, "POST", {
            crm_inquiry_id: randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal((await (await api("inquiries")).json()).items.length, 0);
      assert.equal(
        (await (await api("inquiries?include_delivered=true")).json()).items
          .length,
        1,
      );
    },
  );
  await t.test("retirada y expiración ocultan ficha y medios", async () => {
    await query(
      "UPDATE agencies SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [a],
    );
    assert.equal((await catalog({})).count, 0);
    assert.equal((await mapCatalog()).length, 0);
    assert.equal((await mediaResponse(media)).status, 404);
    await api("reconcile", "POST", {
      active_listings: [{ source_listing_id: source, revision: 2 }],
    });
    assert.equal(
      (
        await api(`listings/${source}`, "PUT", {
          status: "withdrawn",
          revision: 3,
        })
      ).status,
      200,
    );
    assert.equal(await publicListing(id), null);
    assert.equal((await mediaResponse(media)).status, 404);
    const index = await (await api("listings")).json();
    assert.equal(index.items[0].status, "withdrawn");
    await query("UPDATE agencies SET active=false WHERE id=$1", [a]);
    assert.equal((await api("capabilities")).status, 403);
  });
});
test("Catastro: coincidencia exacta, campos mínimos, geometría y fallos seguros", async () => {
  const nc = "042105348930000";
  assert.equal(normalizeNomenclature("0421-0534-8930-000"), nc);
  assert.throws(() => normalizeNomenclature("' OR 1=1"), CadastreError);
  const response = {
    spatialReference: { wkid: 4326 },
    features: [
      {
        attributes: {
          OBJECTID: 1,
          PAR_NOMENCLATURA: nc,
          LOCALIDAD: "EL CHOLAR",
          DEPARTAMENTO: "ÑORQUIN",
          TIPO_PARCELA: "RURAL",
          INFO_TITULO: "NO COPIAR",
        },
        geometry: {
          rings: [
            [
              [-70, -38],
              [-70.01, -38],
              [-70.01, -38.01],
              [-70, -38],
            ],
          ],
        },
      },
    ],
  };
  const fake = (data: any) =>
    (async (url: any) => {
      const u = new URL(url);
      assert.equal(u.hostname, "catastro.neuquen.gov.ar");
      assert.ok(!u.searchParams.get("outFields")?.includes("INFO_TITULO"));
      return Response.json(data);
    }) as typeof fetch;
  const parcel = await lookupParcel(nc, fake(response));
  assert.equal(parcel.nomenclature, nc);
  assert.ok(!JSON.stringify(parcel).includes("NO COPIAR"));
  await assert.rejects(
    lookupParcel(nc, fake({ ...response, features: [] })),
    (e: any) => e.status === 404,
  );
  await assert.rejects(
    lookupParcel(
      nc,
      fake({
        ...response,
        features: [...response.features, ...response.features],
      }),
    ),
    (e: any) => e.status === 409,
  );
  await assert.rejects(
    lookupParcel(nc, fake({ error: { code: 500 } })),
    (e: any) => e.status === 503,
  );
  await assert.rejects(
    lookupParcel(nc, fake({ ...response, spatialReference: { wkid: 3857 } })),
    (e: any) => e.status === 503,
  );
});

test("vínculo público consultado por el portal y eliminación al retirar autorización", async () => {
  await query("UPDATE agencies SET active=true WHERE id=$1", [a]);
  const nc = "042105348930000",
    oldFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      spatialReference: { wkid: 4326 },
      features: [
        {
          attributes: {
            OBJECTID: 1,
            PAR_NOMENCLATURA: nc,
            LOCALIDAD: "EL CHOLAR",
          },
          geometry: {
            rings: [
              [
                [-70, -38],
                [-70.01, -38],
                [-70.01, -38.01],
                [-70, -38],
              ],
            ],
          },
        },
      ],
    })) as typeof fetch;
  try {
    const response = await api(`listings/${source}`, "PUT", {
      status: "published",
      revision: 4,
      listing: { ...listing, cadastre: { province: "AR-Q", nomenclature: nc } },
    });
    assert.equal(response.status, 200);
    await api("reconcile", "POST", {
      active_listings: [{ source_listing_id: source, revision: 4 }],
    });
    const row = await publicListing(id);
    assert.equal(row.parcel.nomenclature, nc);
    assert.equal(row.parcel.locality, "EL CHOLAR");
    assert.equal(
      (await mapCatalog()).find((r) => r.id === id).parcel.nomenclature,
      nc,
    );
    assert.equal(
      (
        await api(`listings/${source}`, "PUT", {
          status: "published",
          revision: 5,
          listing,
        })
      ).status,
      200,
    );
    assert.equal((await publicListing(id)).parcel, null);
    assert.equal((await mapCatalog()).find((r) => r.id === id).parcel, null);
    assert.equal((await publicListing(id)).listing.cadastre, undefined);
    assert.equal((await mediaResponse(media)).status, 200);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("paginación del índice no omite ofertas entre páginas", async () => {
  for (let n = 0; n < 4; n++)
    await api(
      `listings/${randomUUID()}`,
      "PUT",
      { status: "withdrawn", revision: 1 },
      tokenB,
    );
  let cursor: string | null = null;
  const ids = new Set<string>();
  do {
    const page = await (
      await api(
        "listings?limit=2" + (cursor ? "&cursor=" + cursor : ""),
        "GET",
        undefined,
        tokenB,
      )
    ).json();
    valid("IndexPage", page);
    for (const item of page.items) {
      assert.ok(!ids.has(item.source_listing_id));
      ids.add(item.source_listing_id);
    }
    cursor = page.next_cursor;
  } while (cursor);
  assert.equal(ids.size, 4);
});

test("el mapa incluye publicaciones más allá de la primera página del catálogo", async () => {
  for (let n = 0; n < 13; n++) {
    await query(
      "INSERT INTO listings(id,agency_id,source_id,revision,status,payload) VALUES($1,$2,$3,1,'published',$4)",
      [randomUUID(), a, randomUUID(), JSON.stringify({ listing })],
    );
  }
  assert.equal((await catalog({})).rows.length, 12);
  assert.equal((await mapCatalog()).length, (await catalog({})).count);
});
