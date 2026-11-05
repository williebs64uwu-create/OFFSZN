---
name: fin-de-mes
description: Cierre de mes de las finanzas de Willie (OFFSZN / Willie Inspired). Úsalo cuando Willie diga "fin de mes", "cierre del mes", "/fin-de-mes" o mande capturas del banco, del saldo de Yape o del saldo de PayPal del último día del mes. Lee las capturas, las compara con el libro de finanzas (Supabase) y con PayPal, deja los saldos al día y entrega el reporte de cierre con lo que no cuadra.
---

# Fin de mes (finanzas de Willie)

Willie manda **3 capturas** al terminar el mes:
1. **Banco:** cuánto entró al banco en el mes (y el saldo si se ve).
2. **Yape:** saldo actual a fin de mes.
3. **PayPal:** saldo del día 31 (último día del mes).

Tu trabajo: leerlas, compararlas con el libro, dejar los saldos al día y decirle con claridad si todo cuadra. **Son sus finanzas: nunca inventes un monto ni redondees por tu cuenta.** Habla en español, simple y sin jerga.

## Dónde están los datos
- Supabase, proyecto **`qtjpvztpgfymjhhpoouq`** (OFFSZN_Academy Backend DB). Usa `mcp__Supabase__execute_sql` (cárgalo con ToolSearch si hace falta).
- Tablas: `finance_income` (cada cobro), `finance_expenses` (gastos), `finance_deposits`, `finance_settings` (clave/valor).
- Claves de `finance_settings`: `bank_base` `{pen, as_of, at}` · `yape_balance` `{pen, as_of, at}` · `bank_transfers` (lista de envíos Yape→banco) · `paypal_withdrawals` (retiros PayPal→banco) · `paypal_withdraw` `{fee, rate, threshold, provision}` · `month_goals` · `start_at` · `fx_pen_per_usd` · `binance_rate`.
- PayPal real: `mcp__PayPal__list_transactions` (máximo 31 días por consulta; cárgalo con ToolSearch si hace falta).
- Todo en **hora de Lima (UTC−5)**. Un mes va del día 1 00:00 Lima al día 1 del siguiente 00:00 Lima.
- El código que calcula todo: `server/src/shared/store/finance.js` y `server/src/infrastructure/services/financeService.js`. Si dudas de una cuenta, léelo, no adivines.

## Reglas del negocio (ya acordadas con Willie)
- **Meta del mes = ventas netas después de TODAS las comisiones** (la de PayPal y el costo del retiro: US$ 4, repartido en proporción). El primer mes cuenta **desde el 31 de octubre** (inicio del conteo limpio, `start_at`).
- Los S/ que ya pasaron al banco **sí cuentan** en la meta (vienen de ventas). El **saldo del banco y el saldo de Yape NO** son ventas y no entran a la meta.
- Los pagos manuales (Yape directo, Binance, transferencias) **son manuales a propósito**: no hay que automatizarlos ni "arreglarlos".
- PayPal **siempre** cobra comisión. Un cobro de PayPal sin comisión es un dato incompleto. Las ventas de **Payhip** pagan 0.84 por PayPal + 0.50 de Payhip (aparece como un movimiento aparte T0113).
- Yape, Binance y pesos ya confirmados llegan netos. Los pagos Binance se anotan redondeados: llevan nota con lo que llegó de verdad.
- Dinero para depositar = Yape + PayPal cambiado a soles (con el −US$ 4 del retiro). Dinero del mes total = eso + lo ya enviado al banco.

## Pasos

### 1. Recibir y leer las capturas
- Si falta alguna de las 3, pídela. No sigas sin ella.
- Lee cada una (Read sobre la imagen). **Repite a Willie lo que leíste**: monto, fecha y hora visibles. Si algo no se ve claro, pregunta; no lo supongas.

### 2. Cargar el mes del libro
Cambia las fechas al mes que se cierra (ejemplo noviembre 2026; usa `2026-10-31T05:00:00Z` como inicio si es el primer mes):
```sql
select occurred_at at time zone 'America/Lima' as lima, source, ref, product, method, currency, gross, fee, net, status, by_willie, verified, note
from finance_income where occurred_at >= '2026-11-01T05:00:00Z' and occurred_at < '2026-12-01T05:00:00Z' order by occurred_at;
select spent_at, category, amount_pen, note from finance_expenses where spent_at >= '2026-11-01' and spent_at < '2026-12-01' order by spent_at;
select key, value from finance_settings order by key;
```

### 3. PayPal: libro contra PayPal real contra la captura
- Pide a PayPal las transacciones del mes (`start_date` día 1 00:00 −05:00, `end_date` último día 23:59:59 −05:00).
- Cada transacción de PayPal debe estar en el libro con el mismo bruto, comisión y neto (suma el T0113 de −0.50 a la comisión de Payhip). Lista las que falten o difieran.
- **Saldo:** el `ending_balance` de la última transacción del 31 debe ser igual a la captura de Willie. Contra el libro: `saldo inicial de PayPal + suma de neto de PayPal del libro − retiros`. El saldo inicial es lo que tenía PayPal antes del conteo (al 31 oct 2026: US$ 0.55).
- Diferencia mayor a US$ 0.05: investiga (cobro sin anotar, comisión mal puesta, reembolso, retiro no anotado).

### 4. Yape
- Yape esperado = último `yape_balance` + cobros en soles posteriores a esa foto − gastos posteriores − envíos al banco posteriores. (Misma fórmula que `liveBalances`.)
- Compáralo con la captura. Diferencia mayor a **S/ 1**: busca un cobro sin anotar, un gasto sin anotar o un redondeo de Binance. Los redondeos de Binance de noviembre suman unos S/ 0.78 de más; ya son conocidos.

### 5. Banco
- Lo que entró al banco en el mes debe ser: envíos Yape→banco del mes + retiros PayPal→banco del mes (+ intereses de fin de mes si los hay). Compáralo con la captura.
- Si la diferencia son intereses, díselo; se anotan al actualizar el saldo del banco.

### 6. Pendientes que ensucian el cierre
Busca y lista: `status` distinto de `confirmed`, productos con "por confirmar" o "usd extra" (aparecen como *Por revisar*), pagos en pesos argentinos sin confirmar, despachos "sin dato", gastos de SUSCRIPCIÓN IMPORTANTE sin nota, cobros de PayPal sin comisión.

### 7. Reporte de cierre (en el chat, corto)
1. **Ventas netas del mes (la meta)** y qué nivel alcanzó (mínimo S/ 3,500 · intermedia S/ 4,000 · la mejor S/ 5,000+, salvo que `month_goals` diga otra cosa).
2. Bruto, comisiones y neto; cuánto de PayPal, Yape y Binance; gastos y resultado.
3. **Dónde está el dinero:** banco, Yape y PayPal (en US$ y en soles si lo retira hoy).
4. **¿Cuadra?** Una tabla: PayPal, Yape, Banco → libro / captura / diferencia.
5. Pendientes y diferencias, cada una con qué hacer.
Termina diciendo claramente: *"todo cuadra"* o *"no cuadra por X"*. No lo suavices.

### 8. Guardar (solo con el OK explícito de Willie)
Muéstrale primero el SQL. Después:
```sql
-- saldo de Yape de fin de mes (as_of = fecha de la captura; at = hora de la captura si se ve, si no omítelo)
insert into finance_settings (key, value, updated_at) values ('yape_balance', '{"pen": 0.00, "as_of": "2026-11-30", "at": "2026-11-30T23:59:00-05:00"}', now())
on conflict (key) do update set value = excluded.value, updated_at = now();
-- saldo del banco
insert into finance_settings (key, value, updated_at) values ('bank_base', '{"pen": 0.00, "as_of": "2026-11-30", "at": "2026-11-30T23:59:00-05:00"}', now())
on conflict (key) do update set value = excluded.value, updated_at = now();
-- foto del cierre (solo para tener historia)
insert into finance_settings (key, value, updated_at) values ('month_close:2026-11', '{"ventas_netas_meta": 0, "paypal_usd": 0, "yape_pen": 0, "banco_pen": 0, "entro_al_banco_pen": 0, "diferencias": [], "cerrado_el": "2026-12-01"}', now())
on conflict (key) do update set value = excluded.value, updated_at = now();
```
- Reemplaza los ceros por lo que de verdad leíste y confirmó Willie.
- **No guardes el saldo de PayPal:** se calcula del libro. Si PayPal real y libro difieren, propón anotar el ajuste como ingreso manual con una nota clara (se hace desde el CRM, Venta manual → Solo registrar) y espera su OK.
- Los saldos de Yape y banco son "fotos": lo que pase después de la hora de la foto se suma o resta solo.

## Nunca
- Nunca borres ni cambies cobros o gastos viejos sin pedirlo y mostrar qué cambia.
- Nunca inventes montos faltantes ni "cuadres" para que salga bien. Si no cuadra, se dice.
- Nunca escribas en la base de datos sin el OK de Willie en este mismo cierre.
- No mezcles con tareas de código: esto es un cierre contable. Si ves un error en el código de finanzas, avísale y proponlo aparte.
