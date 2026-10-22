import "server-only";
import { cache } from "react";
import { requireDriver } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Contract, ContractSummary, Driver, LoanBalance, Motorcycle } from "@/lib/types";

export type DriverContext = {
  profileName: string;
  driver: Driver;
  contract: Contract | null;
  motorcycle: Motorcycle | null;
  summary: ContractSummary | null;
  loans: LoanBalance[];
  inspection: { done_this_week: boolean; required_this_week: boolean; week_start: string; last_inspection_on: string | null } | null;
};

/** Everything the driver screens need, read with the driver's own session (RLS). */
export const getDriverContext = cache(async (): Promise<DriverContext> => {
  const profile = await requireDriver();
  const supabase = await createClient();

  const { data: driver } = await supabase.from("drivers").select("*").eq("profile_id", profile.id).single();
  if (!driver) throw new Error("Conductor no encontrado");

  const [{ data: contract }, { data: loans }] = await Promise.all([
    supabase.from("contracts").select("*").eq("driver_id", driver.id).eq("status", "active").maybeSingle(),
    supabase.from("loan_balances").select("*").eq("driver_id", driver.id).order("loan_date"),
  ]);

  let motorcycle: Motorcycle | null = null;
  let summary: ContractSummary | null = null;
  let inspection: DriverContext["inspection"] = null;
  if (contract) {
    const [moto, sum, insp] = await Promise.all([
      supabase.from("motorcycles").select("*").eq("id", contract.motorcycle_id).maybeSingle(),
      supabase.rpc("contract_summary", { p_contract_id: contract.id }),
      supabase.from("inspection_status").select("*").eq("contract_id", contract.id).maybeSingle(),
    ]);
    motorcycle = (moto.data as Motorcycle) ?? null;
    summary = ((sum.data as ContractSummary[] | null) ?? [])[0] ?? null;
    inspection = insp.data ?? null;
  }

  return {
    profileName: profile.full_name,
    driver: driver as Driver,
    contract: (contract as Contract) ?? null,
    motorcycle,
    summary,
    loans: (loans as LoanBalance[]) ?? [],
    inspection,
  };
});
