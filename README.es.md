# Contrast Themes for claude.ai

[English](README.md) · **Español**

Seis temas de color llamativos para la web de [claude.ai](https://claude.ai), con bordes visibles y texto legible. Cada tema se comprueba con las reglas de contraste de WCAG al construir la extensión, así que ninguno sacrifica la lectura por el aspecto.

> **Proyecto no oficial.** Contrast Themes no está hecho, respaldado ni mantenido por Anthropic. «Claude» es una marca de Anthropic y aquí solo se usa para indicar en qué web funciona la extensión.

> **Estado: 0.1.0, en desarrollo.**

## Temas

| Tema | Fondo | Bordes | Contraste del texto |
| --- | --- | --- | --- |
| Crema y verde | `#fbf6ea` | `#1b9e00` | 13,83:1 (AAA) |
| Crema y terracota | `#fbf6ea` | `#ce6d4e` | 14,16:1 (AAA) |
| Crema y azul marino | `#fbf6ea` | `#14284f` | 14,56:1 (AAA) |
| Azul marino y naranja | `#0b1f3a` | `#ff8a1f` | 10,63:1 (AAA) |
| Negro y verde | `#0a0a0a` | `#1b9e00` | 15,52:1 (AAA) |
| Negro y naranja | `#0a0a0a` | `#ff7a00` | 15,52:1 (AAA) |

El contraste del texto es el del texto normal sobre el fondo de la página ([WCAG](https://www.w3.org/TR/WCAG22/#contrast-minimum): AA es 4,5:1 y AAA es 7:1). Los bordes y controles llegan al menos a 3:1. Por eso el verde es un verde intenso y no uno flúor: un verde flúor de verdad sobre crema solo da un 1,3:1 y los bordes casi desaparecerían.

Cada tema se ve igual con Claude en modo claro o en modo oscuro: el color es el tema.

## Construir y cargar (modo desarrollador)

Necesitas [Node.js](https://nodejs.org) 20.10 o posterior y Google Chrome 120 o posterior.

1. Descarga el código y constrúyelo:

   ```bash
   git clone https://github.com/satorrent/claude-theme.git
   cd claude-theme
   npm install
   npm run build
   ```

   Esto crea la carpeta `dist/`, que es la extensión. (`dist/` se genera, por eso no está en el repositorio).

2. Abre `chrome://extensions` en Chrome.
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar descomprimida** y selecciona la carpeta `dist/`.
5. Abre o recarga una pestaña de claude.ai y pulsa el icono de Contrast Themes en la barra (fíjalo desde el menú de la pieza de puzle).

Después de cambiar el código, vuelve a ejecutar `npm run build` y pulsa el icono de recarga en la tarjeta de la extensión en `chrome://extensions`. `npm run watch` reconstruye automáticamente con cada cambio.

### ¿Por qué hace falta un build?

Los content scripts de Manifest V3 no admiten módulos ES, y el motor de temas está escrito como módulos ES normales para poder reutilizarlo en cualquier sitio. [esbuild](https://esbuild.github.io) los empaqueta en archivos únicos. Es la única dependencia y solo se usa al construir: dentro de la extensión no va código de terceros.

## Uso

- Pulsa un tema en el popup para verlo en la pestaña de claude.ai abierta. Cierra el popup para descartar la vista previa o pulsa **Aplicar** para quedártelo.
- Elige **Original de Claude** y pulsa **Aplicar** para quitar el tema.
- Si el popup dice que hay que recargar la pestaña (pestañas abiertas antes de instalar o actualizar la extensión), usa el botón **Recargar pestaña**.

## Añadir un tema

Añade un archivo JSON en `themes/` con el nombre de su `id` (por ejemplo `themes/forest-gold.json`), siguiendo `themes/theme.schema.json`. Puedes copiar un tema existente como punto de partida. `npm run build` lo valida y no construye si algún par de texto, acento o borde queda por debajo de WCAG AA; `npm test` hace las mismas comprobaciones. Después añade el nombre traducido como `theme_<id con guiones bajos>` en `_locales/*/messages.json`.

## Desarrollo

```bash
npm test        # tests del motor y del adaptador (node:test, sin dependencias extra)
npm run build   # construye dist/
npm run watch   # reconstruye al cambiar archivos
npm run package # tests + build + contrast-themes-<versión>.zip para la Chrome Web Store
npm run icons   # vuelve a dibujar los iconos de icons/
```

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) (en inglés) para proponer un tema, arreglar cosas cuando claude.ai cambie o publicar una versión.

Estructura:

```
src/engine/            Motor de temas: módulos ES puros, sin APIs del navegador
src/adapter/claude-ai/ Todo lo específico de claude.ai (selectors.js es el único sitio con sus selectores)
src/popup/             Interfaz del popup
src/shared/            Claves de almacenamiento compartidas por popup y content script
themes/                Temas predefinidos (un JSON cada uno) y theme.schema.json
icons/                 Iconos de la extensión (dibujados por scripts/icons.mjs)
tests/                 Tests
scripts/               Scripts de build, empaquetado e iconos
```

## Limitaciones

- Solo funciona en la **web** de claude.ai en Chrome (y navegadores basados en Chromium). No puede cambiar el aspecto de las apps de escritorio o móvil de Claude.
- Depende de variables CSS internas de claude.ai. Si claude.ai las cambia, partes del tema pueden dejar de aplicarse hasta que se actualice `src/adapter/claude-ai/selectors.js`. La extensión nunca rompe la página: muestra un aviso `[Contrast Themes]` en la consola y sigue aplicando lo que funciona.
- Los artefactos, las imágenes y los colores de sintaxis del código mantienen sus propios colores.

## Desinstalar

Quítala desde `chrome://extensions`. Chrome borra todos sus datos guardados; Contrast Themes no escribe nada en el almacenamiento propio de claude.ai, así que no queda ningún resto.

## Privacidad

Contrast Themes no recoge nada ni hace peticiones de red. Solo guarda el tema que eliges en tu ordenador. Consulta [PRIVACY.md](PRIVACY.md#política-de-privacidad).

## Licencia

[MIT](LICENSE). Los cambios están en [CHANGELOG.md](CHANGELOG.md).
