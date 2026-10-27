/** Internal e-mail domain used for driver logins (phone + password). */
export const DRIVER_EMAIL_DOMAIN = "conductores.moto-arriendo.app";

export function driverEmailFromPhone(phone: string): string {
  return `${phone}@${DRIVER_EMAIL_DOMAIN}`;
}

/** Drivers created with a username (e.g. "hamer") sign in with it. */
export function driverEmailFromUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${DRIVER_EMAIL_DOMAIN}`;
}

/** Usernames: start with a letter, 3-30 letters, numbers, dot, dash or underscore. */
export const USERNAME_RE = /^[a-z][a-z0-9._-]{2,29}$/;

/** Minimum length for passwords the admin assigns / the user chooses. */
export const MIN_ASSIGNED_PASSWORD = 4;
export const MIN_OWN_PASSWORD = 6; // Supabase Auth rejects shorter ones
/** Administrators are never asked to change the password they get (enforced in the database too). */
export const MIN_ADMIN_PASSWORD = 10;

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

export const MAINTENANCE_LABEL: Record<string, string> = {
  first_service: "Primera revisión (garantía)",
  oil_change: "Cambio de aceite",
  general_service: "Revisión general",
  repair: "Arreglo",
  other: "Otro",
};

export const INCIDENT_KIND_LABEL: Record<string, string> = {
  accident: "Accidente",
  fine: "Multa / comparendo",
  impound: "Inmovilización",
  theft: "Robo",
  other: "Otro",
};

export const RESPONSIBLE_LABEL: Record<string, string> = {
  driver: "Conductor",
  owner: "Propietario",
  third_party: "Tercero",
  insurer: "Aseguradora",
  pending: "Por definir",
};

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  soat: "SOAT",
  insurance: "Seguro",
  tech_inspection: "Técnico-mecánica",
  gps: "GPS",
  tax: "Impuestos",
  maintenance: "Mantenimiento",
  repair: "Arreglo",
  fine: "Multa",
  other: "Otro",
};
