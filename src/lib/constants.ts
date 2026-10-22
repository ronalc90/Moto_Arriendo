/** Internal e-mail domain used for driver logins (phone + password). */
export const DRIVER_EMAIL_DOMAIN = "conductores.moto-arriendo.app";

export function driverEmailFromPhone(phone: string): string {
  return `${phone}@${DRIVER_EMAIL_DOMAIN}`;
}

export const APP_NAME = "Moto Arriendo";

export type Light = "green" | "yellow" | "red";

export const LIGHT_LABEL: Record<Light, string> = {
  green: "Al día",
  yellow: "Atrasado",
  red: "Atraso grave",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  nequi: "Nequi",
  daviplata: "Daviplata",
  transfer: "Transferencia",
  cash: "Efectivo",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const MOTORCYCLE_STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  in_shop: "En taller",
  impounded: "Inmovilizada",
  inactive: "Inactiva",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  soat: "SOAT",
  insurance: "Seguro todo riesgo",
  tech_inspection: "Revisión técnico-mecánica",
  registration: "Tarjeta de propiedad",
  national_id: "Cédula",
  license: "Licencia de conducción",
  background_check: "Antecedentes",
  contract: "Contrato",
  other: "Otro",
};

export const DAMAGE_STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  in_repair: "En arreglo",
  closed: "Cerrado",
};

export const CHECKLIST_ITEMS = [
  { key: "tires", label: "Llantas" },
  { key: "brakes", label: "Frenos" },
  { key: "chain", label: "Cadena" },
  { key: "lights", label: "Luces" },
  { key: "oil", label: "Aceite" },
] as const;

/** Upload limits (also enforced by Supabase Storage on the server). */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"];
