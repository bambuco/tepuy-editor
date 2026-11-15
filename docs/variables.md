# Variables CSS de Tepuy

Los valores por defecto salen de la plantilla base (`css/styles.css`). Un tema los redefine en `:root`. Los componentes usan `var(--nombre, valor por defecto)`.

| Variable | Defecto | Uso | Archivo |
|---|---|---|---|
| `--tepuy-color-bg` | `#f2f2f2` | Fondo de la página | `tepuy/css/tokens.css` |
| `--tepuy-color-text` | `#222222` | Texto general | `tepuy/css/tokens.css` |
| `--tepuy-color-heading` | `#3f637e` | Títulos | `tepuy/css/tokens.css` |
| `--tepuy-color-border` | `#d3d3d3` | Bordes | `tepuy/css/tokens.css` |
| `--tepuy-color-shadow` | `#c2c2c2` | Sombra de bloques | `tepuy/css/boxes.css` |
| `--tepuy-font-family` | `sans-serif` | Familia tipográfica | `tepuy/css/tokens.css` |
| `--tepuy-font-size` | `14px` | Tamaño base | `tepuy/css/tokens.css` |
| `--tepuy-radius-box` | `10px` | Esquinas de bloques de texto | `tepuy/css/boxes.css` |
| `--tepuy-radius-control` | `0px` | Esquinas de controles. `0` = rectas | `tepuy/css/tokens.css` |
| `--tepuy-color-correct` | `#2e7d32` | Actividad correcta | `tepuy/css/tokens.css` |
| `--tepuy-color-incorrect` | `#d60c1b` | Actividad incorrecta | `tepuy/css/tokens.css` |
| `--tepuy-color-partial` | `#f2d84c` | Actividad parcial | `tepuy/css/tokens.css` |
| `--tepuy-color-unanswered` | `#9e9e9e` | Sin responder | `tepuy/css/tokens.css` |
| `--tepuy-color-info` | `#3476a3` | Información y `.ui-state-highlight` | `tepuy/css/tokens.css` |
| `--tepuy-color-warning` | `#f2d84c` | Advertencia | `tepuy/css/tokens.css` |
| `--tepuy-color-danger` | `#d60c1b` | Peligro y `.ui-state-error` | `tepuy/css/tokens.css` |
| `--tepuy-color-link` | `#f7931e` | Hipervínculos y bloque `link` | `tepuy/css/boxes.css` |
| `--tepuy-color-important` | `#e2793d` | Bloque important | `tepuy/css/boxes.css` |
| `--tepuy-color-important-text` | `#ffffff` | Texto sobre important | `tepuy/css/boxes.css` |
| `--tepuy-color-example` | `#e5e5e6` | Bloque example | `tepuy/css/boxes.css` |
| `--tepuy-color-example-text` | `#222222` | Texto sobre example | `tepuy/css/boxes.css` |
| `--tepuy-color-note` | `#f6f5f2` | Bloque note | `tepuy/css/boxes.css` |
| `--tepuy-color-note-text` | `#808080` | Texto sobre note | `tepuy/css/boxes.css` |
| `--tepuy-color-link-bg` | `#222d32` | Fondo del bloque link | `tepuy/css/boxes.css` |
| `--tepuy-color-link-text` | `#ffffff` | Texto del bloque link | `tepuy/css/boxes.css` |
| `--tepuy-color-connection` | `#3476a3` | Bloque connection | `tepuy/css/boxes.css` |
| `--tepuy-color-connection-text` | `#ffffff` | Texto sobre connection | `tepuy/css/boxes.css` |
| `--tepuy-color-activity` | `#f5f0f5` | Bloque activity | `tepuy/css/boxes.css` |
| `--tepuy-color-activity-text` | `#222222` | Texto sobre activity | `tepuy/css/boxes.css` |
| `--tepuy-color-nav-bg` | `#ffffff` | Fondo de navegación | `tepuy/css/tokens.css` |
| `--tepuy-color-nav-text` | `#222222` | Texto de navegación | `tepuy/css/tokens.css` |
| `--tepuy-color-nav-active` | `#3f637e` | Ítem activo | `tepuy/css/tokens.css` |
| `--tepuy-color-progress` | `#3f637e` | Indicador de progreso | `tepuy/css/tokens.css` |

La hoja histórica `css/styles.css` de la plantilla base todavía tiene colores sueltos y sprites. Esos selectores se sustituyen por estas variables al migrar cada tema. `link-box` no existe como variable aparte: el enlace y el bloque `link` comparten `--tepuy-color-link`.
