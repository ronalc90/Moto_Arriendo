# Moto Arriendo

Plataforma web (instalable en el celular) para controlar el arriendo de motos a conductores de
aplicaciones (Picap, DiDi, Uber Moto, Rappi): pagos diarios con comprobante, préstamos con abonos,
atrasos con semáforo, documentos con vencimientos, inspecciones semanales y reportes de daño.

- **Conductores:** entran con su **celular + contraseña**, suben comprobantes, inspecciones y daños.
- **Administradores:** entran con **correo + contraseña**, aprueban pagos y controlan todo.

## Tecnología

| Parte | Herramienta |
| --- | --- |
| Web y servidor | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 |
| Base de datos, usuarios y archivos | Supabase (PostgreSQL, Auth, Storage) |
| Seguridad | Row Level Security (RLS) en todas las tablas y buckets privados |
| Despliegue | Vercel (la app, https://moto-arriendo.vercel.app) + Supabase (datos, avisos programados) |
| Celular | PWA instalable (manifest + service worker) |

Moneda en COP sin decimales (`$40.000`), fechas `dd/mm/aaaa`, zona horaria `America/Bogota` para
todos los cálculos de días y horas límite.

## Documentación

- [Instalación y despliegue paso a paso](docs/instalacion.md)
- [Arquitectura y diagramas de flujo](docs/arquitectura.md)
- [Reglas de negocio (saldo, atraso, semáforo, préstamos)](docs/reglas-de-negocio.md)
- [Modelo de datos](docs/modelo-de-datos.md)
- [Manual del administrador](docs/manual-administrador.md)
- [Manual del conductor](docs/manual-conductor.md)
- [Avisos por WhatsApp: evaluación de costos](docs/whatsapp.md)

## Fases entregadas

| Fase | Contenido |
| --- | --- |
| 0 | Proyecto, Supabase con RLS y buckets privados, login, PWA, despliegue en Vercel |
| 1 | Conductores, motos, documentos con vencimientos, contratos, pagos (subir/aprobar/rechazar), saldo, semáforo, calendario, préstamos, días exentos, inspección semanal, daños, panel Hoy, datos de prueba, pruebas de RLS |
| 2 | Mantenimiento por kilometraje (configurable) con facturas y quién pagó; avisos automáticos (campana, push y correo) |
| 3 | Incidentes (accidentes, multas, inmovilizaciones, robo), gastos, reportes financieros por moto y propietario con gráficas de recuperación de la inversión, exportar a Excel, evaluación de WhatsApp + enlaces gratis |

## Comandos

```bash
npm install          # instalar dependencias
cp .env.example .env.local   # y llenar los 2 valores de Supabase
npm run dev          # abrir en http://localhost:3000
npm run build        # compilar para producción
npm run test:db      # pruebas de saldo, RLS, avisos y finanzas (PostgreSQL local)
npm run test:rls     # prueba de seguridad en vivo contra Supabase
```

## Estructura

```
src/
  app/
    login/            inicio de sesión (celular o correo)
    consentimiento/   autorización Ley 1581 de 2012 (primer ingreso del conductor)
    conductor/        pantallas del conductor (celular)
    admin/            pantallas del administrador
    cuenta/           cambiar contraseña
    salir/            cerrar sesión
  components/         interfaz reutilizable
  lib/                Supabase, formatos (COP, fechas Bogotá), autenticación
  proxy.ts            refresca la sesión y protege las rutas
supabase/
  migrations/         esquema, lógica de negocio, RLS, buckets, avisos, finanzas
  functions/notify/   envío de notificaciones push y correo (Edge Function)
  seed/               datos de prueba y script para borrarlos
  tests/              pruebas automáticas de saldo, RLS, avisos y finanzas
public/sw.js          service worker (PWA y notificaciones push)
```

## Seguridad en una línea

La app solo usa la clave **publicable** de Supabase. Toda la protección vive en la base de datos (RLS),
así que un conductor no puede ver nada de otro aunque manipule la app. La clave secreta
(`service_role`) **no se usa en ninguna parte**.
