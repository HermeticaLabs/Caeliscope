---
title: Referencia del JSON
order: 9
description: Estructura, campos y unidades del JSON en vivo que muestra y descarga Caeliscope.
---
El JSON que muestra la vista para desarrolladores (y que puedes copiar o descargar) tiene siempre la misma estructura de tres bloques más uno opcional. Se genera en vivo para el objeto seleccionado y el instante mostrado.

```json
{
  "_meta":  { "...": "procedencia y contexto" },
  "object": { "kind": "moon", "id": "Enceladus", "name": "Enceladus" },
  "data":   { "...": "los datos del objeto" },
  "extra":  { "...": "opcional" }
}
```

## `_meta`

| Campo | Significado |
|---|---|
| `generated_by`, `app_url` | Aplicación que generó el archivo (Caeliscope) y su repositorio. |
| `engine`, `engine_version`, `engine_url` | Caelis Engine y la versión del motor usada. |
| `schema_version` | Versión del esquema de datos que devuelve el motor. |
| `publisher` | Hermetica Labs. |
| `data_origin` | De dónde salen los datos de este tipo de objeto (motor, catálogo de estrellas o plugin de lunas sobre la posición del motor). |
| `instant_utc`, `jd_tt`, `delta_t_sec` | Instante en UTC, fecha juliana en TT y ΔT usado. |
| `observer` | Latitud y longitud del observador en grados. |
| `rounding` | Solo en lunas: cómo se redondean los valores (ver más abajo). |

## `object`

| Campo | Significado |
|---|---|
| `kind` | `body` (Sol, Luna, planetas), `star` o `moon`. |
| `id` | Identificador en inglés (`Saturn`, `Enceladus`, `Moon`). |
| `engine_key` | Solo si la clave interna del motor es distinta (por ejemplo `Saturno`, `Luna`). Es el nombre con el que el motor expone ese cuerpo. |
| `name` | Nombre legible en inglés. |

Los identificadores del JSON van siempre en inglés, para facilitar su uso desde otros sistemas. La traducción pertenece a la interfaz, no al dato.

## `data`

- **Cuerpos** (`body`): el objeto tal como lo devuelve `getSnapshotAt()` de Caelis Engine, sin modificar.
- **Estrellas** (`star`): `ra_j2000_deg`, `dec_j2000_deg`, `magnitude`, `bv_index`, `hip`, `az_deg`, `alt_geometric_deg` y `lst_deg`. Las coordenadas horizontales se calculan en Caeliscope con el tiempo sidéreo del motor.
- **Lunas** (`moon`):

| Campo | Unidad | Significado |
|---|---|---|
| `planet`, `planet_engine_key` | | Planeta, en inglés y con la clave del motor. |
| `east_arcsec`, `north_arcsec` | arcsec | Posición respecto del centro del planeta (este y norte celestes). |
| `separation_arcsec` | arcsec | Separación angular del centro del planeta. |
| `position_km` | km | Posición `[x, y, z]` respecto del planeta. |
| `transit`, `occulted` | booleano | Pasa delante del disco del planeta; está detrás del planeta. |
| `in_planet_shadow` | booleano | Está dentro de la sombra del planeta. |
| `shadow_on_disc` | booleano | Su sombra cae sobre el disco del planeta. |
| `behind_rings_opacity` | 0–1 | Cuánto cubren los anillos a la luna (Saturno). |
| `mean_radius_km`, `magnitude` | km, mag | Radio medio y magnitud. |
| `orbit` | | Los elementos orbitales medios usados. |

En el JSON de un planeta con lunas, `extra.satellites` lista cada luna con su `id` en inglés y los mismos campos de posición y estado.

## Redondeo

Los desplazamientos y separaciones de las lunas se redondean a 0,001 arcsec y las distancias a kilómetros enteros. JSON no escribe los ceros finales, así que `-3.000` aparece como `-3`: es el mismo número, no una pérdida de precisión.

## Determinismo

Para el mismo instante y la misma ubicación, el JSON es el mismo: Caelis Engine es determinista y Caeliscope no añade aleatoriedad. Esto permite reproducir cualquier captura.
