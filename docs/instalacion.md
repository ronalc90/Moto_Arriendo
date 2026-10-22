# Instalación, despliegue y operación

## Estado actual (todo desplegado)

| Pieza | Dónde | Estado |
| --- | --- | --- |
| App web (Next.js) | Vercel, proyecto **moto-arriendo** (equipo Koptup's projects) → https://moto-arriendo.vercel.app | Despliegue automático con cada `git push` a `main` |
| Código | GitHub `ronalc90/Moto_Arriendo` | Rama `main` |
| Base de datos, usuarios, archivos | Supabase, proyecto **moto-arriendo** (`orhdoywdjhxfnlhbbihy`, EE. UU. Este) | Migraciones aplicadas, registro abierto **apagado**, Site URL configurada |
| Avisos | Supabase Edge Function `notify` + `pg_cron` cada 15 min | Activos (push). Correo: opcional, ver abajo |

> No se usa Railway: Vercel + Supabase cubren todo (incluidas las tareas programadas), sin otro servicio que pagar.

## Variables de entorno (Vercel)

| Variable | Valor | ¿Secreta? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://orhdoywdjhxfnlhbbihy.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | No (RLS protege los datos) |

La clave secreta de Supabase **no se usa en la app**. La función `notify` corre dentro de Supabase y
recibe su propia clave de servicio automáticamente. Las claves de los avisos (VAPID, clave del cron,
Resend) se guardan en la tabla privada `private.app_config`, que **no** está expuesta por la API.

## Activar los avisos por correo (opcional, 3 minutos)

1. Crea una cuenta gratis en https://resend.com con tu correo (dirox7@gmail.com).
2. En Resend: **API Keys → Create API Key** → copia la clave (empieza por `re_`).
3. En la app: **Configuración → Avisos por correo (Resend)** → pega la clave → Guardar.
4. Toca **Enviar notificación de prueba**.

Con la cuenta gratuita, Resend solo envía al correo con el que te registraste (suficiente para ti). Para
enviar a tu socio, verifica un dominio propio en Resend.

## Notificaciones push en el celular

Cada usuario las activa en **Avisos → Activar notificaciones en este celular** (iPhone: primero
instalar la app en la pantalla de inicio, iOS 16.4 o superior).

## Datos de prueba

- Cargar: `supabase/seed/seed_test_data.sql` en Supabase → SQL Editor → Run.
- Borrar: `supabase/seed/clean_test_data.sql`.
- Conductores de prueba: **3000000001** (Hamer) y **3000000002** (Jeison), contraseña `Prueba2026!`.

## Para un programador

```bash
git clone https://github.com/ronalc90/Moto_Arriendo.git && cd Moto_Arriendo
npm install
cp .env.example .env.local        # pegar URL y clave publicable
npm run dev                        # http://localhost:3000
npm run build && npm start         # modo producción
npm run lint
PGHOST=localhost PGUSER=postgres npm run test:db   # saldo, RLS, avisos y finanzas (PostgreSQL local)
npm run test:rls                   # RLS en vivo contra Supabase con los conductores de prueba
npm run icons                      # regenerar íconos de la PWA
```

### Base de datos

Migraciones en `supabase/migrations/` (orden por nombre). En un proyecto nuevo de Supabase:
ejecutarlas en orden en el SQL Editor (o `supabase db push`), desplegar `supabase/functions/notify`
(`supabase functions deploy notify --no-verify-jwt`) y cargar `private.app_config`:

```sql
insert into private.app_config (key, value) values
  ('cron', '<texto aleatorio de 40+ caracteres>'),
  ('functions_url', 'https://<ref>.supabase.co/functions/v1'),
  ('vapid_public', '<clave pública VAPID>'),
  ('vapid_private', '<clave privada VAPID>'),
  ('vapid_subject', 'mailto:tu@correo.com'),
  ('app_url', 'https://<tu-app>.vercel.app');
```

(Claves VAPID: `npx web-push generate-vapid-keys`.)

### Crear un administrador desde SQL

```sql
select public.admin_create_user('correo@ejemplo.com', 'ContraseñaSegura123', 'Nombre', 'admin');
```

### Avisos del asesor de seguridad de Supabase (revisados)

- *Funciones SECURITY DEFINER ejecutables por usuarios*: intencional. Todas validan `is_admin()` o
  solo devuelven datos del propio usuario.
- *pg_net en el esquema public*: así lo instala Supabase; no expone datos.
- *Protección de contraseñas filtradas*: disponible solo en el plan Pro de Supabase.
