import { MIN_OWN_PASSWORD } from "@/lib/constants";

// Passwords so common that anyone could guess them.
const TOO_COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "000000", "111111", "121212", "123123",
  "654321", "666666", "112233", "abc123", "qwerty", "password", "contraseña", "contrasena", "motoarriendo",
]);

/** Checks a password a person chooses for themselves. Returns an error message or null. */
export function ownPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_OWN_PASSWORD) return `La contraseña debe tener al menos ${MIN_OWN_PASSWORD} caracteres.`;
  if (password !== confirm) return "Las contraseñas no coinciden.";
  if (TOO_COMMON.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
    return "Esa contraseña es muy fácil de adivinar. Usa otra.";
  }
  return null;
}

/** Turns a Supabase Auth password error into Spanish. */
export function authPasswordError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("different from the old")) return "La contraseña nueva debe ser distinta a la que te dieron.";
  if (m.includes("weak") || m.includes("at least")) return "Esa contraseña es muy débil. Usa una más larga.";
  return "No se pudo guardar la contraseña. Intenta con otra.";
}
