-- Trigger functions are never meant to be called through the API.
-- (Triggers keep working: Postgres only checks EXECUTE when the trigger is created.)
revoke execute on function
  public.audit_trigger(),
  public.inspections_after_insert(),
  public.inspections_before_update(),
  public.loans_after_update(),
  public.payments_after_change(),
  public.payments_before_insert(),
  public.payments_before_update(),
  public.driver_owned_before_insert(),
  public.damage_reports_before_update(),
  public.refresh_loan_status(uuid)
from public, anon, authenticated;

-- is_admin(), my_driver_id(), my_motorcycle_id() and accept_data_policy() stay
-- executable by signed-in users on purpose: RLS policies call them, and they
-- only ever return information about the calling user.
