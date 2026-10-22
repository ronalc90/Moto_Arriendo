# Salida a producción: lista de pasos

Esta guía es para el día en que empiezas a usar la app con las motos y los conductores de verdad.
Hazla en orden. Cada paso dice **dónde** se hace.

---

## 1. Borra los datos de prueba (en la app)

> ✅ Ya se hizo el 21/10/2026 después de las pruebas completas. Solo repítelo si vuelves a cargar los datos de
> prueba (`supabase/seed/seed_test_data.sql`).

1. Entra a la app como administrador.
2. Ve a **Configuración** → sección **Respaldo y datos**.
3. Toca **Borrar datos de prueba** y luego **Sí, borrar los datos de prueba**.

Esto borra solo lo que creamos para probar: las motos **PRU01A, PRU02A y PRU03A**, los conductores de prueba
(celulares **3000000001, 3000000002 y 3000000003**), sus pagos, inspecciones, daños, préstamos, documentos y fotos.
Tus datos reales no se tocan. Si algún contrato mezcla una moto de prueba con un conductor real (o al revés), la
app no borra nada y te avisa para que lo revises primero.

Cuando ya no quedan datos de prueba, el botón desaparece solo.

## 2. Cambia tu contraseña (en la app)

**Mi cuenta** (tu nombre arriba a la derecha) → **Cambiar contraseña**. Usa una de al menos 10 caracteres que no
uses en otro lado.

## 3. Carga lo real (en la app)

1. **Motos** → **Nueva moto**: placa, marca, modelo, precio de compra, kilometraje actual. Sube la tarjeta de
   propiedad, el SOAT y la revisión técnico-mecánica con su fecha de vencimiento.
2. **Conductores** → **Nuevo conductor**: nombre, cédula, celular (será su usuario), contraseña inicial,
   contacto de emergencia. Sube la cédula, la licencia y los antecedentes.
3. **Contratos** → **Nuevo contrato**: escoge moto y conductor, tarifa diaria, fecha de inicio, y sube el
   contrato firmado.
4. Si hay préstamos, regístralos en **Préstamos**.
5. Envíale a cada conductor el enlace de la app, su celular y su contraseña inicial. La primera vez que entre
   tendrá que aceptar la autorización de tratamiento de datos (Ley 1581).

## 4. Activa los avisos (en la app, en tu celular)

1. Abre la app en tu celular y **agrégala a la pantalla de inicio** (en iPhone: Compartir → Agregar a inicio;
   en Android: menú ⋮ → Instalar app).
2. Abre la app desde el ícono, ve a **Configuración** → **Activar notificaciones en este celular**.
3. Toca **Enviar notificación de prueba**. Te debe llegar en segundos.
4. Pide a cada conductor que haga lo mismo desde **Avisos**.

**Correo (opcional):** en Configuración → *Avisos por correo (Resend)*. Con la cuenta gratis de Resend solo llegan
correos a tu propio correo, lo cual sirve para que tú recibas copia de los avisos.

## 5. Haz respaldos (cada semana)

El plan gratis de Supabase **no te deja descargar copias de seguridad**. Por eso la app trae su propio respaldo:

**Configuración** → **Descargar respaldo (Excel)**. Guarda el archivo en tu Google Drive o envíatelo por correo.
Hazlo cada semana (por ejemplo, el lunes) y siempre antes de un cambio grande.

El Excel trae todo: motos, conductores, contratos, pagos, préstamos, días exentos, gastos, mantenimientos,
incidentes e inspecciones. Las fotos y documentos quedan guardados en Supabase.

## 6. Revisa los planes de los servicios

Hoy todo funciona con los planes gratis, pero ten en cuenta:

| Servicio | Situación con el plan gratis | Cuándo pasar a pago |
|---|---|---|
| **Vercel** (donde vive la app) | El plan Hobby es **solo para uso personal, no comercial**. Un negocio de arriendo es uso comercial. | Desde que empieces a cobrar con la app: plan **Pro, USD 20 al mes**. Settings → Billing → Upgrade. |
| **Supabase** (base de datos y fotos) | 500 MB de base de datos y 1 GB de archivos, sin respaldos descargables. Si nadie usa la app durante 7 días, el proyecto **se pausa** (con conductores pagando a diario no pasa). | Cuando tengas más de 5–6 motos o quieras respaldos automáticos diarios: plan **Pro, desde USD 25 al mes**. |
| **Resend** (correos) | 3.000 correos al mes, solo a tu propio correo mientras no tengas un dominio. | Solo si quieres que los correos lleguen a los conductores; necesitas un dominio propio. |

## 7. Dominio propio (opcional)

Si quieres que la app se vea como `app.tunegocio.co` en vez de `moto-arriendo.vercel.app`:

1. Compra el dominio (por ejemplo en Vercel → Domains, o en un registrador colombiano para `.co`).
2. En Vercel → proyecto **moto-arriendo** → Settings → Domains → agrega el dominio y sigue las instrucciones.
3. En Supabase → Authentication → URL Configuration → cambia **Site URL** por el nuevo dominio.

## 8. Datos legales

La app ya tiene publicadas, sin necesidad de iniciar sesión:

- `/acerca` — quién está detrás de la app.
- `/privacidad` — política de tratamiento de datos personales (Ley 1581 de 2012).
- `/cookies` — política de cookies (solo se usan las necesarias para iniciar sesión).
- `/terminos` — términos de uso.

El correo de contacto que aparece en esas páginas es **dirox7@gmail.com**. Si quieres usar otro (por ejemplo, uno
del negocio), cámbialo en el archivo `src/lib/legal.ts` y vuelve a publicar. Si cambias algo de fondo en las
políticas, actualiza también `LEGAL_VERSION_DATE` en ese mismo archivo.

> La inscripción en el Registro Nacional de Bases de Datos (RNBD) de la SIC solo es obligatoria para sociedades y
> entidades sin ánimo de lucro con activos de más de 100.000 UVT, y para entidades públicas (Decreto 090 de 2018).
> Como persona natural, hoy no te aplica; revísalo si algún día constituyes una empresa.

## 9. Lista final

- [ ] Datos de prueba borrados
- [ ] Contraseña cambiada
- [ ] Motos, conductores y contratos reales cargados, con documentos y vencimientos
- [ ] Avisos activados en tu celular y en el de cada conductor
- [ ] Primer respaldo descargado y guardado
- [ ] Decidido si pasas Vercel a Pro
