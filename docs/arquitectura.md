# Arquitectura y diagramas de flujo

> Los diagramas están en formato Mermaid: GitHub los dibuja automáticamente al abrir este archivo.

## 1. Vista general

```mermaid
flowchart LR
  subgraph Celular["Celular / computador"]
    C[Conductor<br/>PWA instalada]
    A[Administrador<br/>navegador]
  end
  subgraph Vercel["Vercel (app Next.js)"]
    P[proxy.ts<br/>refresca sesión y protege rutas]
    S[Páginas y Server Actions<br/>validan datos con zod]
  end
  subgraph Supabase["Supabase"]
    AU[Auth<br/>usuario + contraseña]
    DB[(PostgreSQL<br/>tablas + RLS<br/>contract_summary)]
    ST[(Storage privado<br/>comprobantes, fotos,<br/>documentos)]
  end
  C & A -->|HTTPS| P --> S
  S -->|sesión del usuario<br/>clave publicable| DB
  S --> AU
  C -->|sube fotos comprimidas<br/>a su propia carpeta| ST
  S -->|URLs firmadas<br/>que expiran| ST
```

- La app solo usa la **clave publicable**. Cada consulta viaja con la sesión del usuario, y PostgreSQL
  decide con **RLS** qué filas puede ver o escribir. No existe un "modo administrador" en el servidor
  que se salte esas reglas.
- Los cálculos de dinero (saldo, atraso, reparto de pagos) viven en funciones SQL: una sola fuente de
  verdad.

## 2. Inicio de sesión

```mermaid
flowchart TD
  A[Abre la app] --> B{¿Tiene sesión?}
  B -- No --> L[Pantalla Entrar]
  L --> C{¿Escribió un correo?}
  C -- Sí --> E[Usa el correo]
  C -- No --> F[Celular de 10 dígitos<br/>→ correo interno<br/>3001234567@conductores...]
  E & F --> G[Supabase Auth<br/>verifica contraseña]
  G -- Error --> L
  G -- OK --> B
  B -- Sí --> H{¿Tiene perfil activo?}
  H -- No --> X[Cerrar sesión<br/>'Esta cuenta no tiene acceso']
  H -- Sí --> R{Rol}
  R -- Administrador --> AD[Panel Hoy]
  R -- Conductor --> K{¿Aceptó tratamiento<br/>de datos?}
  K -- No --> CO[Autorización Ley 1581<br/>guarda fecha de aceptación]
  CO --> CD
  K -- Sí --> CD[Inicio del conductor]
```

Solo un administrador crea cuentas (función `admin_create_user`). Aunque alguien lograra registrarse
por su cuenta, sin fila en `profiles` no ve absolutamente nada.

## 3. Pago diario (de punta a punta)

```mermaid
sequenceDiagram
  autonumber
  actor Co as Conductor
  participant App as App (celular)
  participant St as Storage privado
  participant DB as PostgreSQL
  actor Ad as Administrador

  Co->>App: Toca "Subir pago"
  App->>DB: contract_summary() → monto sugerido
  Co->>App: Toma foto del comprobante, confirma monto y método
  App->>App: Comprime la foto (máx. 1600 px, JPG)
  App->>St: Sube a receipts/<id_conductor>/...
  App->>DB: INSERT payments (monto, método, ruta)
  DB->>DB: Trigger: fuerza estado "pendiente",<br/>reparte tarifa / abono, valida dueño
  DB-->>App: Pago en revisión
  Ad->>App: Abre "Revisar pagos"
  App->>St: URL firmada del comprobante (expira)
  Ad->>DB: Aprueba (o rechaza con motivo)
  DB->>DB: Guarda revisado_por / revisado_en,<br/>audit_log, préstamo → pagado si llega a 0
  Co->>App: Ve su saldo y semáforo actualizados
```

## 4. Cálculo del semáforo

```mermaid
flowchart TD
  A[Hora actual en Bogotá] --> B{¿Ya pasaron<br/>las 9:00 p. m.?}
  B -- Sí --> C[Último día vencido = hoy]
  B -- No --> D[Último día vencido = ayer]
  C & D --> E[Días cobrables = días desde el inicio<br/>sin descansos ni exentos]
  E --> F[Debería pagar = días × tarifa]
  F --> G[Saldo tarifa = debería − tarifas aprobadas]
  G --> H[Deuda abonos obligatorios]
  H --> I["Deuda total = máx(saldo, 0) + deuda abonos"]
  I --> J[Días de atraso = ⌈deuda ÷ cuota diaria⌉]
  J --> K{Días}
  K -- 0 --> V[🟢 Al día]
  K -- 1 a 2 --> Y[🟡 Atrasado]
  K -- 3 o más --> R[🔴 Devolver la moto]
```

## 5. Inspección semanal

```mermaid
flowchart TD
  A[Lunes: inspección pendiente] --> B[Conductor abre 'Inspección semanal']
  B --> C[Foto frente] --> D[Foto atrás] --> E[Foto izquierda] --> F[Foto derecha] --> G[Foto tablero con km]
  G --> H[Escribe el kilometraje]
  H --> I[Lista: llantas, frenos, cadena, luces, aceite<br/>Bien / Revisar]
  I --> J[Enviar]
  J --> K[(Se guarda y actualiza el km de la moto)]
  K --> L[Admin revisa y marca como revisada]
  A -. si no la sube .-> M[Aparece como pendiente en el panel Hoy]
```

## 6. Documentos y vencimientos

```mermaid
flowchart LR
  A[Admin sube SOAT / seguro /<br/>técnico-mecánica / licencia<br/>con fecha de vencimiento] --> B[(documents)]
  B --> C[Vista document_expirations<br/>último documento por tipo]
  D[Fecha de compra + 2 años] --> C
  C --> E{Días para vencer}
  E -- ≤ 30 --> F[Panel Hoy: por vencer]
  E -- 30 / 15 / 7 --> G[Avisos por correo y push<br/>Fase 2]
```

## 7. Avisos automáticos

```mermaid
flowchart LR
  subgraph DB["PostgreSQL (Supabase)"]
    T1[Triggers: pago nuevo,<br/>pago aprobado/rechazado,<br/>daño reportado] --> N[(notifications)]
    CR[pg_cron cada 15 min] --> G[generate_notifications:<br/>recordatorio 7 p. m., atrasos,<br/>vencimientos 30/15/7,<br/>mantenimiento, inspección]
    G --> N
    N -->|trigger + pg_net| F
    CR -->|pg_net| F
  end
  F[Edge Function notify] --> P[Web Push<br/>al celular]
  F --> E[Correo Resend<br/>administradores]
  N --> B[Campana de avisos<br/>en la app]
```

Cada aviso tiene una clave única (por ejemplo `exp:soat:<moto>:<fecha>:15`), así nunca se repite.

## 8. Seguridad (quién ve qué)

| Información | Administrador | Conductor |
| --- | --- | --- |
| Perfiles | Todos | Solo el suyo |
| Motos | Todas | Solo la de su contrato vigente |
| Contratos, pagos, préstamos, días exentos | Todos | Solo los suyos |
| Documentos | Todos | Los suyos y los de su moto |
| Inspecciones y daños | Todos (revisa y cierra) | Crea y ve los suyos |
| Archivos (Storage) | Todos | Solo su carpeta y documentos de su moto |
| Registro de auditoría | Lee | Nada |
| Aprobar pagos, crear cuentas | Sí | No |

La prueba automática `supabase/tests/rls_and_balance_test.sql` verifica estas reglas.
