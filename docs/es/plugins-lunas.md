---
title: Plugins de lunas
order: 10
description: Cómo se modelan las lunas y cómo describir un planeta nuevo.
---
Las lunas no vienen del motor: las calcula Caeliscope con **plugins**, uno por planeta. Cada plugin parte de la posición del planeta que resuelve Caelis Engine y añade las lunas alrededor.

## Modelo

El modelo es una **propagación kepleriana propia de Hermetica Labs** de elementos orbitales medios de JPL (época J2000, planos de Laplace locales). La longitud media avanza con los movimientos medios siderales clásicos, y el nodo y el ápside precesan con los períodos que define cada luna (sin precesión secular en Urano y Neptuno).

Qué entrega y qué no:

| Sí | No |
|---|---|
| Forma de la configuración, períodos y sentido de giro | Perturbaciones mutuas finas entre lunas |
| Tránsitos, ocultaciones, eclipses y sombras sobre el disco | Efemérides al segundo de arco de un contacto exacto |
| Fase y orientación de cada luna | Resonancias y variaciones de largo plazo |

Para Neptuno, Nereida tiene una órbita muy excéntrica (e ≈ 0,75) y rotación no sincrónica; su orientación es aproximada. Tritón es retrógrado (inclinación ≈ 157°).

## Qué define un plugin

Un plugin es un objeto con:

| Campo | Contenido |
|---|---|
| `id` | Identificador del plugin (por ejemplo `saturn-classical-mean`). |
| `planet` | La clave del planeta en el motor. |
| `radiusKm`, `flattening`, `pole` | Radio ecuatorial, achatamiento y polo (AR, Dec) del planeta. |
| `model` | Texto con el modelo y la fuente; aparece en el JSON. |
| `rings` | Anillos, si los hay (Saturno). |
| `moons` | Lista de lunas. |

Y cada luna:

| Campo | Contenido |
|---|---|
| `key`, `name` | Clave interna y nombres `{ en, es }`. |
| `meanRadiusKm`, `mag`, `color` | Radio medio, magnitud y color de dibujo. |
| `elements` | Semieje `a`, excentricidad `e`, argumento del periastro `w`, anomalía media `M`, inclinación `i`, nodo, movimiento medio sideral `nSid`, tasas de precesión y polo orbital. |

Los plugins se registran en `src/satellites/index.mjs`. Las formas de las lunas (ejes de cada elipsoide) están en `src/satellites/shape.mjs`.

## Implementación de referencia

[The XERJ Corpus Hub](https://hub.xerj.org/contributors/HermeticaLabs) eligió esta implementación como **referencia para IA**. Lo que la hace útil como referencia, más allá de las órbitas, es cómo está construida:

- **Cálculo separado del dibujo.** La mecánica orbital (`orbits.mjs`), la proyección al cielo (`sky.mjs`) y la forma y orientación (`shape.mjs`) son módulos de cálculo con pruebas automáticas; el dibujo vive aparte, en `render.mjs`. Un sistema de IA puede leer y reutilizar la matemática sin tocar nada visual.
- **Reproducible.** Mismo instante, misma ubicación, mismo resultado. No hay aleatoriedad ni estado oculto, así que cualquier cifra del JSON se puede volver a obtener y verificar.
- **Declarativa.** Añadir un planeta o una luna es describir datos (elementos, radios, polo), no escribir lógica nueva.
- **Procedencia explícita.** Cada JSON declara en `model` qué método y qué fuente produjeron los números, y las limitaciones están dichas en esta documentación en vez de ocultarse.

## Atribución

Los elementos orbitales medios son datos públicos de JPL; el cálculo y la implementación son de Hermetica Labs. Los créditos completos están en **Acerca de** y en el archivo `THIRD-PARTY-LICENSES`.
