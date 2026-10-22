# Manual del administrador

Entra en **https://moto-arriendo.vercel.app** con tu correo y contraseña. En el computador el menú está
a la izquierda; en el celular abajo (y el resto en **Más**).

## Puesta en marcha del piloto (orden recomendado)

1. **Configuración**: revisa la tarifa diaria por defecto ($40.000), los valores por defecto de los
   préstamos (concepto, abono diario y si es obligatorio), el día de inspección (lunes), la hora del
   recordatorio (7:00 p. m.) y los intervalos de mantenimiento. Activa las notificaciones.
2. **Motos → Nueva moto**: placa, valor y fecha de compra (sirven para el reporte de recuperación y la
   técnico-mecánica). Sube **SOAT**, **seguro** y **tarjeta de propiedad** con su fecha de vencimiento.
3. **Conductores → Nuevo conductor**: solo el **nombre**, un **usuario** (ej: `hamer`) o su celular, y una
   **contraseña inicial** (mínimo 4 caracteres). La primera vez que entre, la app le pide sus datos
   (cédula, licencia, contacto de emergencia) y que cambie la contraseña por una propia. Tú subes luego
   la foto de su licencia, cédula y antecedentes.
4. **Contratos → Nuevo contrato**: conductor, moto, tarifa, día de descanso, fecha de inicio y el PDF
   firmado.
5. **Préstamos → Nuevo préstamo** (si aplica): monto, abono diario y si el abono es obligatorio. Cada
   conductor tiene un solo préstamo activo: si le prestas más, edita el que ya tiene y súmale el monto.
6. Entrégale al conductor su usuario, la contraseña inicial y el enlace de la app (ver *Manual del conductor*).

Mientras falte algo (la moto o el contrato de un conductor, el SOAT o el seguro de una moto, el contrato
firmado), lo verás arriba en **Hoy → Pendientes por llenar** y te llega un aviso 📝 cada semana hasta
que lo completes.

## El día a día: pantalla **Hoy**

- **Pagos por revisar**: toca uno, mira el comprobante en grande y **Aprobar** (puedes ajustar cuánto
  va a tarifa y cuánto al préstamo) o **Rechazar** con un motivo. Al terminar pasa solo al siguiente.
- **Estado de los conductores** con su semáforo y lo que deben.
- **Documentos por vencer** (30 días), **inspecciones pendientes** y **lo recibido este mes** por moto y
  por propietario.

## Otras tareas

| Quiero… | Dónde |
| --- | --- |
| Registrar un pago en efectivo o un abono extra al préstamo | Pagos → Registrar pago |
| Anular un pago aprobado por error | Abre el pago → Anular pago (con motivo) |
| No cobrar unos días (moto en taller por garantía) | Días exentos, o dentro del contrato |
| Ver el calendario de un conductor | Contratos → abre el contrato |
| Subir o bajar la tarifa diaria | Contratos → abre el contrato → Cambiar tarifa (desde una fecha; lo anterior no cambia) |
| Prestarle más plata a un conductor | Préstamos → abre su préstamo → Editar préstamo (súmale el monto) |
| Cobrar por WhatsApp | Conductores → abre al conductor → botón WhatsApp |
| Revisar la cédula o la licencia que subió un conductor | Hoy → Pendientes por llenar, o Conductores → abre al conductor → Documentos: **Se lee bien** o **No se lee** (escribe el motivo; al conductor le llega el aviso) |
| Asignar una contraseña nueva | Conductores → abre al conductor → Asignar nueva contraseña |
| Registrar un cambio de aceite o un arreglo | Motos → abre la moto → Registrar servicio o arreglo |
| Registrar una multa, accidente, inmovilización o robo | Incidentes → Nuevo incidente |
| Registrar SOAT, GPS, impuestos y otros gastos | Gastos |
| Ver ganancias y cuánto falta para recuperar cada moto | Reportes |
| Descargar pagos o gastos en Excel | Reportes o Gastos → botón Excel |
| Terminar un contrato | Contratos → abre el contrato → Terminar contrato |
| Agregar a tu socio como administrador | Configuración → Agregar administrador |
| Ver quién aprobó qué | Configuración → Registro de cambios, o el historial de cada pago |

## Avisos automáticos

Cada 15 minutos el sistema revisa y avisa (en la campana, push al celular y correo si lo configuras):

- **Conductor:** recordatorio de pago a las 7:00 p. m. si no ha pagado, atraso, inspección pendiente,
  licencia por vencer, cambio de aceite próximo, pago aprobado o rechazado.
- **Administrador:** pago nuevo por revisar, atrasos, SOAT/seguro/técnico-mecánica/licencia que vencen en
  30, 15 y 7 días, mantenimiento próximo o atrasado, inspección pendiente y daños reportados.

## Datos de prueba

Al entregar la plataforma quedaron **Hamer (prueba)** y **Jeison (prueba)** con las motos **PRU01A** y
**PRU02A**. Úsalos para practicar. Cuando arranques el piloto real, bórralos ejecutando
`supabase/seed/clean_test_data.sql` en el SQL Editor de Supabase (o pídemelo).
