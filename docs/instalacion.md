# Instalación y despliegue (paso a paso)

Todo lo técnico ya está hecho: base de datos creada en Supabase, seguridad (RLS), archivos privados,
tu usuario administrador y el código en GitHub. Aquí están solo los pasos que te tocan a ti, en
español sencillo.

## Lo que ya existe

| Qué | Dónde |
| --- | --- |
| Código | GitHub: `ronalc90/Moto_Arriendo` (rama `main`) |
| Base de datos y archivos | Supabase, proyecto **moto-arriendo** (organización Koptup, región EE. UU. Este) |
| URL de Supabase | `https://orhdoywdjhxfnlhbbihy.supabase.co` |
| Clave publicable | `sb_publishable_bPo-mJpnIBZx9J5gjUU-8g_hgujZ-9S` (es pública por diseño) |

## Paso 1. Publicar la app en Vercel (5 minutos)

1. Entra a <https://vercel.com> con tu cuenta y elige el equipo **Koptup's projects**.
2. Toca **Add New… → Project**.
3. En la lista de repositorios de GitHub busca **Moto_Arriendo** y toca **Import**.
   - Si no aparece: toca **Adjust GitHub App Permissions**, elige tu usuario `ronalc90`
     y dale acceso al repositorio `Moto_Arriendo`. Vuelve a Vercel y aparecerá.
4. En **Project Name** escribe `moto-arriendo`. El framework se detecta solo (Next.js).
5. Abre **Environment Variables** y agrega estas dos (nombre → valor):
   - `NEXT_PUBLIC_SUPABASE_URL` → `https://orhdoywdjhxfnlhbbihy.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `sb_publishable_bPo-mJpnIBZx9J5gjUU-8g_hgujZ-9S`
6. Toca **Deploy** y espera 1–2 minutos. Al terminar te da un enlace como
   `https://moto-arriendo.vercel.app`.

Desde ahí, cada vez que se suba código a GitHub, Vercel publica la nueva versión solo.

## Paso 2. Cerrar el registro abierto en Supabase (1 minuto)

Solo el administrador debe crear cuentas. Para que nadie pueda registrarse por su cuenta:

1. Entra a <https://supabase.com/dashboard> y abre el proyecto **moto-arriendo**.
2. Menú izquierdo: **Authentication → Sign In / Providers** (en algunas versiones: *Providers*).
3. Apaga **Allow new users to sign up** y guarda.

(Aunque no lo hagas, una cuenta creada por fuera no ve nada: no tiene perfil. Pero es mejor apagarlo.)

4. En **Authentication → URL Configuration**, en **Site URL** pon el enlace que te dio Vercel
   (por ejemplo `https://moto-arriendo.vercel.app`) y guarda.

## Paso 3. Entrar como administrador

1. Abre el enlace de Vercel.
2. Escribe tu correo y la contraseña temporal que te entregué en el chat.
3. Ve a **Más → Mi cuenta** (o tu nombre arriba a la derecha) y **cambia la contraseña**.

## Paso 4. Instalar la app en el celular

- **Android (Chrome):** abre el enlace → menú ⋮ → **Instalar app** (o *Agregar a la pantalla principal*).
- **iPhone (Safari):** abre el enlace → botón **Compartir** → **Agregar a inicio**.

## Para un programador: correr el proyecto en un computador

```bash
git clone https://github.com/ronalc90/Moto_Arriendo.git
cd Moto_Arriendo
npm install
cp .env.example .env.local      # y pegar la URL y la clave publicable
npm run dev                      # http://localhost:3000
```

### Base de datos

Las migraciones están en `supabase/migrations/` y ya están aplicadas en el proyecto. Para un proyecto
nuevo de Supabase, ejecútalas en orden en **SQL Editor** (o con la CLI: `supabase db push`).

Pruebas automáticas de saldo y seguridad contra un PostgreSQL local:

```bash
PGHOST=localhost PGUSER=postgres npm run test:db
```

### Crear un administrador nuevo desde SQL

En Supabase → SQL Editor:

```sql
select public.admin_create_user('correo@ejemplo.com', 'ContraseñaSegura123', 'Nombre Apellido', 'admin');
```

(Los conductores se crean desde la app, en **Conductores → Nuevo**.)

### Variables de entorno

| Variable | Dónde se usa | ¿Secreta? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador y servidor | No (RLS protege los datos) |

La clave secreta de Supabase (`service_role` / `sb_secret_…`) **no se usa** y nunca debe ponerse en
Vercel ni en el repositorio.
