import { formatCOP } from "@/lib/format";

/**
 * Free WhatsApp "click to chat" links (no API, no cost): the admin taps the
 * link and WhatsApp opens with the message ready to send from their own phone.
 * See docs/whatsapp.md for the paid WhatsApp Business API evaluation.
 */
export function whatsappLink(phone: string | null | undefined, text: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const intl = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function reminderText(name: string, debt: number, lateDays: number) {
  const first = name.split(" ")[0];
  if (lateDays <= 0) return `Hola ${first}, ¿cómo vas? Te recuerdo subir el pago de hoy en la app de Moto Arriendo antes de las 9:00 p. m. ¡Gracias!`;
  return `Hola ${first}. Tienes ${lateDays} ${lateDays === 1 ? "día" : "días"} de atraso (${formatCOP(debt)}). Por favor ponte al día hoy y sube el comprobante en la app de Moto Arriendo. Recuerda que con 3 días de atraso se devuelve la moto.`;
}
