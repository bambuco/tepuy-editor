# Huecos de Edy para el editor Tepuy

Edy entra en este proyecto como submódulo de solo lectura en `fuentes/vendor/edy`.

- No se editan archivos dentro de `fuentes/vendor/edy`.
- Un cambio de comportamiento de Tepuy se escribe en `fuentes/src/` o, si hace falta una capacidad nueva de Edy, se anota aquí.
- Lo anotado se implementa en el repositorio de Edy (`https://github.com/bambuco/edy-tor`) y luego se trae con `fuentes/scripts/update-edy.sh`.

## Pedidos abiertos

### Personalizar Acerca de

Edy fija en **Ayuda** una entrada `about` que notifica «Edy 0.1.0».

Tepuy necesita sustituir o personalizar **Acerca de** (título, contenido modal, marca del producto).

**Workaround actual en Tepuy:** menú `help.about` propio con modal; la entrada built-in de Edy sigue visible junto a ella.
