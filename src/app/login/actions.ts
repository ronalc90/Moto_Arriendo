"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_RE, driverEmailFromPhone, driverEmailFromUsername } from "@/lib/constants";
import { normalizePhone } from "@/lib/format";

export type LoginState = { error?: string; user?: string };

const schema = z.object({
  user: z.string().trim().min(3, "Escribe tu usuario, tu celular o tu correo"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    user: formData.get("user"),
    password: formData.get("password"),
  });
  const user = String(formData.get("user") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, user };
  }

  // Admins type their e-mail; drivers their username (e.g. "hamer") or phone.
  const raw = parsed.data.user.trim();
  let email: string;
  if (raw.includes("@")) {
    email = raw.toLowerCase();
  } else if (/^[\d\s()+.-]+$/.test(raw)) {
    const phone = normalizePhone(raw);
    if (phone.length !== 10) {
      return { error: "El celular debe tener 10 dígitos, por ejemplo 3001234567", user };
    }
    email = driverEmailFromPhone(phone);
  } else {
    const username = raw.toLowerCase();
    if (!USERNAME_RE.test(username)) return { error: "Usuario o contraseña incorrectos", user };
    email = driverEmailFromUsername(username);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: "Usuario o contraseña incorrectos", user };
  }
  redirect("/");
}
