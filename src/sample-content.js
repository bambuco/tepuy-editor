/**
 * @file Small content document used to exercise the shell.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/** @type {string} Sample content.html body. */
export const SAMPLE_CONTENT = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="tepuy-theme" content="base@1.0.0">
  <meta name="tepuy-version" content="2.0">
  <title>Paquete de ejemplo</title>
</head>
<body data-display-mode="onlypages" data-approve-limit="100" data-activities-percentaje="60" data-model="scorm">
  <nav class="main">
    <a data-page="pag-introduccion">Introducción</a>
    <a data-page="pag-actividades">Actividades</a>
  </nav>
  <main>
    <section id="pag-introduccion" ptitle="Introducción">
      <div class="subpage" data-title="Inicio">
        <h3>Inicio</h3>
        <p>Texto de la introducción.</p>
        <div class="box-text important" label="Importante">
          <p>Una idea para destacar.</p>
        </div>
      </div>
    </section>
    <section id="pag-actividades" ptitle="Actividades">
      <p>Página de actividades.</p>
    </section>
  </main>
</body>
</html>
`;
