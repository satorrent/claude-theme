# ClaudeTheme

[English](README.md) · **Español**

Temas de color personalizados para la web de [claude.ai](https://claude.ai), más allá de claro y oscuro. Eliges un color base y uno de acento, y ClaudeTheme genera un tema completo en versión clara **y** oscura, comprueba el contraste de cada texto y control según WCAG AA, y corrige lo que no llega.

> **Proyecto no oficial.** ClaudeTheme no está hecho, respaldado ni mantenido por Anthropic. «Claude» es una marca de Anthropic y aquí solo se usa para indicar en qué web funciona la extensión.

> **Estado: 0.1.0, en desarrollo.** Esta versión incluye colores elegidos a mano con vista previa en vivo. Las paletas predefinidas, los temas desde imagen, los temas guardados y la importación/exportación llegarán a continuación.

## Construir y cargar (modo desarrollador)

Necesitas [Node.js](https://nodejs.org) 20.10 o posterior y Google Chrome 120 o posterior.

1. Descarga el código y constrúyelo:

   ```bash
   git clone <URL de este repositorio>
   cd claude-theme
   npm install
   npm run build
   ```

   Esto crea la carpeta `dist/`, que es la extensión. (`dist/` se genera, por eso no está en el repositorio).

2. Abre `chrome://extensions` en Chrome.
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar descomprimida** y selecciona la carpeta `dist/`.
5. Abre o recarga una pestaña de claude.ai y pulsa el icono de ClaudeTheme en la barra (fíjalo desde el menú de la pieza de puzle).

Después de cambiar el código, vuelve a ejecutar `npm run build` y pulsa el icono de recarga en la tarjeta de la extensión en `chrome://extensions`. `npm run watch` reconstruye automáticamente con cada cambio.

### ¿Por qué hace falta un build?

Los content scripts de Manifest V3 no admiten módulos ES, y el motor de temas está escrito como módulos ES normales para poder reutilizarlo en cualquier sitio. [esbuild](https://esbuild.github.io) los empaqueta en archivos únicos. Es la única dependencia y solo se usa al construir: dentro de la extensión no va código de terceros.

## Uso

- El **color base** tiñe fondos y texto. El **color de acento** se usa en botones, enlaces y anillos de foco.
- Mientras el popup está abierto, la pestaña de claude.ai muestra una vista previa en vivo. Cierra el popup para descartarla o pulsa **Aplicar tema** para quedártela.
- El tema sigue el modo claro/oscuro/sistema que tengas elegido en los ajustes de Claude.
- **Volver al tema original de Claude** quita el tema.
- **Correcciones de contraste** muestra cada color que se ha ajustado para cumplir WCAG AA (4,5:1 para texto, 3:1 para controles), con el valor antes y después.

## Desarrollo

```bash
npm test        # tests del motor y del adaptador (node:test, sin dependencias extra)
npm run build   # construye dist/
npm run watch   # reconstruye al cambiar archivos
```

Estructura:

```
src/engine/            Motor de temas: módulos ES puros, sin APIs del navegador
src/adapter/claude-ai/ Todo lo específico de claude.ai (selectors.js es el único sitio con sus selectores)
src/popup/             Interfaz del popup
src/shared/            Claves de almacenamiento compartidas por popup y content script
themes/                Temas predefinidos (un JSON cada uno) y theme.schema.json
tests/                 Tests
scripts/build.mjs      Script de build
```

## Limitaciones

- Solo funciona en la **web** de claude.ai en Chrome (y navegadores basados en Chromium). No puede cambiar el aspecto de las apps de escritorio o móvil de Claude.
- Depende de variables CSS internas de claude.ai. Si claude.ai las cambia, partes del tema pueden dejar de aplicarse hasta que se actualice `src/adapter/claude-ai/selectors.js`. La extensión nunca rompe la página: muestra un aviso `[ClaudeTheme]` en la consola y sigue aplicando lo que funciona.
- Los artefactos, las imágenes y los colores de sintaxis del código mantienen sus propios colores.

## Desinstalar

Quítala desde `chrome://extensions`. Chrome borra todos sus datos guardados; ClaudeTheme no escribe nada en el almacenamiento propio de claude.ai, así que no queda ningún resto.

## Licencia

[MIT](LICENSE)
