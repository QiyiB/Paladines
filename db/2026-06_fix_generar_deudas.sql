-- Fix: la regeneracion de deudas por vencimiento debe basarse SOLO en el
-- ULTIMO pago (no anulado) de cada jugador+concepto. Antes recorria todos los
-- pagos vencidos, por lo que al pagar la mensualidad el pago viejo (ya vencido)
-- volvia a generar la deuda y el jugador reaparecia como deudor pese a haber pagado.
--
-- Con DISTINCT ON tomamos el pago mas reciente por (jugador, concepto): si ese
-- ya vencio y no hay una deuda pendiente que lo cubra, se genera la deuda; si el
-- ultimo pago aun esta vigente, el jugador NO debe nada de ese concepto.
-- La funcion sigue siendo idempotente.

CREATE OR REPLACE FUNCTION generar_deudas_por_vencimiento()
RETURNS INTEGER AS $$
DECLARE
    n INTEGER := 0;
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT ON (p.jugador_id, p.concepto_id)
               p.jugador_id, p.concepto_id, cp.monto, p.fecha_expiracion
          FROM pago p
          JOIN concepto_pago cp ON cp.id = p.concepto_id
         WHERE p.anulado = FALSE
           AND p.fecha_expiracion IS NOT NULL
         ORDER BY p.jugador_id, p.concepto_id, p.fecha_pago DESC, p.id DESC
    LOOP
        IF r.fecha_expiracion < CURRENT_DATE
           AND NOT EXISTS (
               SELECT 1 FROM deuda d
                WHERE d.jugador_id = r.jugador_id
                  AND d.concepto_id = r.concepto_id
                  AND d.estado = 'PENDIENTE'
                  AND d.fecha_generada >= r.fecha_expiracion
           ) THEN
            INSERT INTO deuda (jugador_id, concepto_id, monto, fecha_generada, fecha_vencimiento, estado)
            VALUES (r.jugador_id, r.concepto_id, r.monto, r.fecha_expiracion, r.fecha_expiracion, 'PENDIENTE');
            n := n + 1;
        END IF;
    END LOOP;
    RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Limpieza: deja como maximo UNA deuda PENDIENTE por jugador+concepto
-- (elimina duplicados que pudo crear la version anterior; conserva la mas antigua).
DELETE FROM deuda d
 WHERE d.estado = 'PENDIENTE'
   AND EXISTS (
       SELECT 1 FROM deuda d2
        WHERE d2.jugador_id = d.jugador_id
          AND d2.concepto_id = d.concepto_id
          AND d2.estado = 'PENDIENTE'
          AND d2.id < d.id
   );
