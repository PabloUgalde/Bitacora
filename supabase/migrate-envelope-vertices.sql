-- Migra el catálogo de wb_aircraft (user_id IS NULL) al nuevo modelo de
-- envolvente CG por vértices. Antes había dos representaciones redundantes:
--   - cgEnvelope{Normal,Utility}: tabla peso/fwd_in/aft_in usada para validar
--     si el CG calculado cae dentro de límites (menos precisa).
--   - cgEnvelopeGraph{Normal,Utility}: polígono {x,y} dibujado a mano copiado
--     del gráfico del manual, usado solo para el dibujo del gráfico.
-- Ahora un único polígono de vértices sirve para ambas cosas: se copia
-- cgEnvelopeGraph* sobre cgEnvelope* (más preciso que la tabla que reemplaza)
-- y se elimina el campo Graph* redundante. Ver CLAUDE.md, sección
-- "Peso y Balance" / envolvente CG. Espejo de la migración ya aplicada en
-- aeronaves-db.js (catálogo embebido en el cliente).
--
-- Idempotente: una segunda ejecución no encuentra cgEnvelopeGraph* y no toca nada.

update public.wb_aircraft
set data = jsonb_set(
    data,
    '{limits}',
    (
      (data->'limits' - 'cgEnvelopeGraphNormal' - 'cgEnvelopeGraphUtility')
      || case when data->'limits' ? 'cgEnvelopeGraphNormal'
              then jsonb_build_object('cgEnvelopeNormal', data->'limits'->'cgEnvelopeGraphNormal')
              else '{}'::jsonb end
      || case when data->'limits' ? 'cgEnvelopeGraphUtility'
              then jsonb_build_object('cgEnvelopeUtility', data->'limits'->'cgEnvelopeGraphUtility')
              else '{}'::jsonb end
    )
)
where user_id is null
  and (data->'limits' ? 'cgEnvelopeGraphNormal' or data->'limits' ? 'cgEnvelopeGraphUtility');
