# Avisos por WhatsApp: evaluación de costos (Fase 3)

## Qué quedó implementado (gratis)

- **Enlaces de WhatsApp listos para enviar** (técnica "click to chat", `wa.me`): en la ficha de cada
  conductor hay un botón **WhatsApp** que abre WhatsApp en tu celular con el mensaje ya escrito
  (recordatorio de pago o cobro de atraso, con el valor exacto). Tú solo tocas *Enviar*.
  No requiere cuentas, aprobación de Meta ni pago.
- **Notificaciones push** de la app (gratis) y **correo** para administradores (gratis con Resend hasta
  3.000 correos/mes).

## La API oficial de WhatsApp Business (automática)

Desde el 1 de julio de 2025 Meta cobra **por mensaje entregado** (plantilla), según la categoría y el
país del número que recibe. Los mensajes que el usuario te escribe son gratis. Lo que cambió en octubre
de 2026: las respuestas de utilidad dentro de la ventana de 24 horas ahora se cobran, y cada número de
empresa recibe 1.000 mensajes de servicio gratis al mes.

Precios aproximados para Colombia (verifícalos en la tabla oficial de Meta antes de contratar, cambian
con frecuencia):

| Tipo de mensaje | Para qué lo usaríamos | Precio aprox. por mensaje |
| --- | --- | --- |
| Utilidad (*utility*) | Recordatorio de pago, pago aprobado/rechazado, vencimientos | ≈ US$0,0008 – 0,002 (≈ $3 – 8 COP) |
| Marketing | Promociones (no lo necesitamos) | ≈ US$0,0125 (≈ $50 COP) |

### Estimación para el piloto (2 motos)

- Mensajes al mes: ~2 conductores × 2 avisos/día × 30 días + avisos al administrador ≈ **150 mensajes**.
- Costo de Meta: **menos de US$1 al mes** (unos $1.000 – 4.000 COP).
- Pero hay costos y trámites adicionales:
  - Un **proveedor (BSP)** como Twilio, 360dialog o Gupshup: suelen cobrar una mensualidad
    (US$0 – 50) o un recargo por mensaje (Twilio ≈ US$0,005 adicional).
  - **Verificar el negocio** en Meta Business Manager (RUT/cámara de comercio) y un **número de
    teléfono exclusivo** que no se use en la app normal de WhatsApp.
  - Cada plantilla de mensaje debe ser **aprobada por Meta** antes de usarse.

## Recomendación

Para el piloto de 2 motos **no vale la pena** todavía: el costo por mensaje es mínimo, pero el trámite
(verificación del negocio, número dedicado, plantillas aprobadas, proveedor) es alto, y las
notificaciones push + los enlaces de WhatsApp ya cubren la necesidad sin costo.

Vale la pena implementarla cuando tengas **10 motos o más**, o si los conductores no instalan la app.
La plataforma ya está preparada: todos los avisos se guardan en la tabla `notifications` y se entregan
desde la función `notify` de Supabase; agregar WhatsApp sería un canal más en esa función
(variables `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`).

Fuentes:
- [Meta – Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Chately – WhatsApp Business API en Colombia: guía 2026](https://chately.co/blog/whatsapp-business-api-en-colombia)
- [Cliengo – Precio WhatsApp Business API 2026 por país](https://guiawabusiness.cliengo.com/precios)
