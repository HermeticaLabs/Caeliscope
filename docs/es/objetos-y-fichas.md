---
title: Objetos y fichas
order: 4
description: Buscar objetos, leer sus fichas y ver el JSON en vivo del motor.
---
## Buscar

El campo **Buscar** de Opciones encuentra objetos por nombre: *Luna, Marte, Sirio, Orión…* Al elegir uno, la vista se orienta hacia él. Si está bajo el horizonte, Caeliscope te lo indica con su altura.

## La ficha

Haz clic (o toca) un objeto para abrir su ficha. Según el tipo de objeto, muestra:

| Dato | Descripción |
|---|---|
| Magnitud | Brillo aparente. |
| Diámetro aparente | Tamaño angular visto desde tu ubicación. |
| Distancia | Desde la Tierra, y desde el Sol para los planetas. |
| RA/Dec | Ascensión recta y declinación, de la fecha y J2000. |
| Az/Alt | Dirección y altura sobre tu horizonte. |
| Eclíptica | Longitud y latitud eclípticas. |
| Fase y elongación | Para la Luna y los planetas. |
| Estado | Sobre o bajo el horizonte; sale y se pone a qué hora. |
| Observación | Si necesita telescopio. |

Las estrellas muestran además el índice B-V y su número del catálogo Hipparcos.

### Botones de la ficha

- **Seguir** (`T`): la cámara acompaña al objeto mientras corre el tiempo. El doble clic hace lo mismo.
- **Acercar**: acerca la vista hasta que el disco llena buena parte de la pantalla y lo sigue.
- **Trayectoria**: dibuja su recorrido con su propio color. Puedes activar varias a la vez. Ver [Trayectorias y geometrías](trayectorias-y-geometrias.md).
- **Todas**: en las estrellas, dibuja las estelas de todas las estrellas brillantes como una exposición larga: un clic las muestra formándose en vivo, otro el ciclo completo y otro las apaga.
- **Wikipedia**: abre más información del objeto en un sitio externo, solo si haces clic.
- **`</>`**: da vuelta la ficha y muestra el JSON del motor (ver abajo).

Puedes minimizar la ficha o cerrarla (`Esc`).

## Vista para desarrolladores: JSON en vivo

Activa **Opciones → Vista para desarrolladores → Snapshot JSON**. Cada ficha gana un botón `</>` que la da vuelta y muestra, en vivo, el JSON que devuelve Caelis Engine para ese objeto en el instante actual.

Desde ahí puedes **Copiar** el JSON o **Descargar .json**. El archivo incluye al principio los metadatos de procedencia: versión del motor, instante UTC, fecha juliana y ΔT, y la ubicación del observador. Ver la [referencia del JSON](json.md).
