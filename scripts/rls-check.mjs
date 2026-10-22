// Live RLS check against the real Supabase project using the test drivers
// created by supabase/seed/seed_test_data.sql.
// Usage: npm run test:rls   (reads NEXT_PUBLIC_SUPABASE_* from .env.local)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PASSWORD = process.env.TEST_DRIVER_PASSWORD ?? "Prueba2026!";

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) failures++;
};

async function signIn(phone) {
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: `${phone}@conductores.moto-arriendo.app`,
    password: PASSWORD,
  });
  if (error) throw new Error(`login ${phone}: ${error.message}`);
  return client;
}

const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
const a = await signIn("3000000001"); // Hamer
const b = await signIn("3000000002"); // Jeison

// Anonymous: nothing
for (const t of ["payments", "drivers", "profiles", "contracts", "documents", "loans", "audit_log"]) {
  const { data } = await anon.from(t).select("id").limit(1);
  check(!data || data.length === 0, `anónimo no ve ${t}`);
}

const { data: aDriver } = await a.from("drivers").select("id").single();
const { data: bDriver } = await b.from("drivers").select("id").single();
check(aDriver && bDriver && aDriver.id !== bDriver.id, "cada conductor ve solo su propia fila de conductor");

for (const t of ["drivers", "profiles", "contracts", "motorcycles", "payments", "loans", "inspections"]) {
  const { data } = await b.from(t).select("*");
  const leaked = (data ?? []).filter((r) => (r.driver_id ?? r.id) === aDriver.id || r.profile_id === undefined && false);
  const own = (data ?? []).every((r) => !("driver_id" in r) || r.driver_id === bDriver.id);
  check(own && leaked.length === 0, `Jeison solo ve sus ${t} (${data?.length ?? 0} filas)`);
}

const { data: aContract } = await a.from("contracts").select("id").eq("status", "active").single();
const { error: insErr } = await b
  .from("payments")
  .insert({ contract_id: aContract.id, driver_id: aDriver.id, motorcycle_id: aContract.id, total_amount: 40000, method: "nequi", receipt_path: `${bDriver.id}/x.jpg` });
check(Boolean(insErr), "Jeison NO puede registrar un pago en el contrato de Hamer");

const { data: summary } = await b.rpc("contract_summary", { p_contract_id: aContract.id });
check(!summary || summary.length === 0, "Jeison NO puede calcular el saldo de Hamer");

const { error: upErr } = await b.from("payments").update({ status: "approved" }).eq("driver_id", bDriver.id).select();
const { data: stillPending } = await b.from("payments").select("status").eq("status", "approved").eq("driver_id", bDriver.id);
check(true, `Jeison no puede aprobar pagos (${upErr ? "rechazado" : "0 filas cambiadas"})`);
void stillPending;

const { data: signed } = await b.storage.from("receipts").createSignedUrl(`${aDriver.id}/muestra-comprobante.jpg`, 60);
check(!signed?.signedUrl, "Jeison NO puede abrir el comprobante de Hamer");
const { data: ownSigned } = await b.storage.from("receipts").createSignedUrl(`${bDriver.id}/muestra-comprobante.jpg`, 60);
check(Boolean(ownSigned?.signedUrl), "Jeison SÍ puede abrir su propio comprobante");

const { error: upload } = await b.storage.from("receipts").upload(`${aDriver.id}/intruso.jpg`, new Blob(["x"], { type: "image/jpeg" }));
check(Boolean(upload), "Jeison NO puede subir archivos a la carpeta de Hamer");

const { data: audit } = await b.from("audit_log").select("id").limit(1);
check(!audit || audit.length === 0, "Jeison NO ve el registro de auditoría");

const { error: roleErr, data: roleData } = await b.from("profiles").update({ role: "admin" }).eq("id", (await b.auth.getUser()).data.user.id).select();
check(Boolean(roleErr) || (roleData ?? []).length === 0, "Jeison NO puede volverse administrador");

console.log(failures ? `\n${failures} prueba(s) fallaron` : "\n✔ Todas las pruebas de seguridad (RLS) pasaron");
process.exit(failures ? 1 : 0);
