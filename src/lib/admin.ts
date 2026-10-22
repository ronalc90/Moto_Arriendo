import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, bogotaToday } from "@/lib/format";

export type Option = { value: string; label: string };

/** Admin profiles (motorcycle owners). */
export async function getOwners(): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name");
  return (data ?? []).map((p) => ({ value: p.id, label: p.full_name }));
}

/** Drivers with their names (for selects and lists). */
export async function getDriverOptions(onlyActive = true): Promise<Option[]> {
  const supabase = await createClient();
  let q = supabase.from("drivers").select("id, status, profiles!inner(full_name)").order("created_at");
  if (onlyActive) q = q.eq("status", "active");
  const { data } = await q;
  return (data ?? []).map((d) => ({
    value: d.id,
    label: (d.profiles as unknown as { full_name: string }).full_name,
  }));
}

export async function getMotorcycleOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("motorcycles").select("id, plate, model").neq("status", "inactive").order("plate");
  return (data ?? []).map((m) => ({ value: m.id, label: `${m.plate} · ${m.model}` }));
}

/** Active contracts as options "Driver · PLATE". */
export async function getActiveContractOptions(): Promise<Array<Option & { driverId: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("id, driver_id, motorcycles!inner(plate), drivers!inner(profiles!inner(full_name))")
    .eq("status", "active")
    .order("start_date");
  return (data ?? []).map((c) => {
    const row = c as unknown as {
      id: string;
      driver_id: string;
      motorcycles: { plate: string };
      drivers: { profiles: { full_name: string } };
    };
    return { value: row.id, driverId: row.driver_id, label: `${row.drivers.profiles.full_name} · ${row.motorcycles.plate}` };
  });
}

/** Current month boundaries in Bogota. */
export function currentMonth() {
  const today = bogotaToday();
  const month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { today, month, from: `${month}-01`, to: addDays(nextMonth, -1) };
}
