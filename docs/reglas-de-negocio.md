# Reglas de negocio

Todo se calcula **en la base de datos** (función `contract_summary`), así el panel del administrador,
el celular del conductor y los reportes siempre muestran el mismo número. La hora y el día se toman
siempre en **America/Bogota**.

## 1. Lo que debe cada conductor

| Concepto | Cómo se calcula |
| --- | --- |
| Último día vencido | Hoy si ya pasaron las **9:00 p. m.** (hora límite del contrato); si no, ayer |
| Días cobrables | Días desde el inicio del contrato hasta el último día vencido, **sin** días de descanso ni días exentos |
| Debería haber pagado | Días cobrables × tarifa diaria |
| Saldo de tarifa | Debería haber pagado − suma de `monto_tarifa` de los pagos **aprobados** (negativo = pagó por adelantado) |
| Deuda de abonos | Solo préstamos con abono **obligatorio**: mín(monto del préstamo, días cobrables desde la fecha del préstamo × abono diario) − abonos aprobados |
| Deuda total | máx(saldo de tarifa, 0) + deuda de abonos |
| Días de atraso | Deuda total ÷ (tarifa diaria + abonos diarios obligatorios), redondeado hacia arriba |

### Semáforo

| Color | Condición |
| --- | --- |
| 🟢 Al día | 0 días de atraso |
| 🟡 Atrasado | 1 a 2 días de atraso |
| 🔴 Atraso grave | 3 días o más (`dias_max_atraso` del contrato): aplica la devolución de la moto |

### Ejemplo

Contrato desde el lunes 28/09/2026, descanso domingo, $40.000/día. El miércoles 21/10/2026 a las
10:00 p. m. hay 24 días, menos 3 domingos = **21 días cobrables → $840.000**.
Si el conductor tiene aprobados $760.000, debe $80.000 → **2 días de atraso → 🟡**.
A las 8:00 p. m. del mismo día (antes de la hora límite) serían 20 días → $40.000 → 1 día.

## 2. Préstamos y abonos

- Cada préstamo tiene: concepto, monto, **abono diario** y si el abono es **obligatorio** (por defecto sí).
- Obligatorio: el abono que no se pague suma deuda y mueve el semáforo.
- Voluntario: el abono se sugiere, pero no afecta el semáforo.
- **Saldo del préstamo** = monto − abonos aprobados. Cuando llega a 0 el préstamo pasa a **pagado**
  automáticamente (y vuelve a activo si se anula un pago).
- El administrador puede registrar **abonos extra** para adelantar la deuda.

## 3. Cómo se reparte un pago

Cuando el conductor sube un pago, la base de datos reparte el monto (el conductor no puede alterarlo):

1. Primero a la **tarifa** que debe hasta hoy (contando también pagos en revisión). Si no debe nada,
   un día de tarifa (pago del día).
2. Lo que sobre va al **abono del préstamo** más antiguo, hasta su saldo.
3. Si aún sobra, queda como **adelanto de tarifa** de los días siguientes.

El monto sugerido en el formulario es: tarifa pendiente hasta hoy (o la de un día) + abono pendiente
(o el abono de un día). El conductor puede cambiarlo. El administrador puede ajustar el reparto al
aprobar.

## 4. Calendario del conductor

Los pagos aprobados de tarifa cubren los días cobrables en orden, del más antiguo al más nuevo. Cada
día se marca como: **pagado**, **parcial**, **vencido**, **hoy**, **próximo**, **descanso** o **exento**.

## 5. Vencimientos

Se avisa **30, 15 y 7 días** antes de que venzan: SOAT, seguro, revisión técnico-mecánica (si no se
ha registrado, se calcula a los 2 años de la fecha de compra) y licencia del conductor.

## 6. Inspección semanal

Cada conductor debe subir una por semana (por defecto el **lunes**; configurable). Si no la ha subido
desde el último lunes, aparece como pendiente en el panel del administrador.

## 7. Auditoría

Cada aprobación o rechazo de pago guarda **quién** y **cuándo** (`revisado_por`, `revisado_en`) y además
queda un registro en `audit_log`, igual que cualquier cambio en motos, conductores, contratos,
préstamos, documentos, días exentos, inspecciones y daños.
