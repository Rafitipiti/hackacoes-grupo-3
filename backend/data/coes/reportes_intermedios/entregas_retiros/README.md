# Reportes Intermedios — Entregas y Retiros

## Qué problema representa

Mientras los demás módulos hablan de dinero, este habla de **energía física**: cuánta entrega cada punto de generación, y cuánta retira cada cliente final. Es el dato más "operativo" de todo el paquete — y el único donde aparecen empresas consumidoras reales (no solo agentes del mercado eléctrico).

## Qué información está disponible

- El catálogo de puntos de entrega y su empresa dueña.
- El histórico diario de energía entregada, por punto.
- El histórico diario de energía retirada, por combinación cliente-barra, agrupado por generador.

## Cómo se relacionan

`entregas_historico_diario.json` se une con `puntos_entrega.json` por `codentcodi` para saber qué empresa entregó esa energía. `retiros_historico_diario.json` ya trae directamente el `cliente_id` y el `generador_id` anonimizados.

## Preguntas que podrían responderse

- ¿Qué generadores tienen más clientes distintos retirando su energía?
- ¿Hay estacionalidad en el consumo de los clientes finales (ej. industrias con patrones mensuales)?
- ¿Cómo se compara la energía entregada total vs. la retirada total, mes a mes?
- ¿Qué barras concentran más volumen de retiro?

## Ideas de visualización

- Serie de tiempo de energía entregada total del sistema, por mes.
- Grafo bipartito generador ↔ cliente (vía `retiros_historico_diario.json`).
- Ranking de clientes por volumen de retiro (sin saber cuál es cuál, pero viendo la escala relativa).

## Tipo de análisis posible

Análisis de patrones de consumo, detección de estacionalidad, análisis de red de distribución generador-cliente. Es también el módulo más apto para practicar el manejo de series de tiempo diarias de mayor volumen que los demás.
