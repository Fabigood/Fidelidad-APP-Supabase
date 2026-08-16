const ESTILOS_NIVEL = Object.freeze({
  Bronce: { gradiente: ['#8a5a34', '#c98a4b'], texto: '#3a2410' },
  Plata: { gradiente: ['#7c8894', '#c9d3dc'], texto: '#26313b' },
  Oro: { gradiente: ['#b8860b', '#f6d365'], texto: '#3a2c00' }
});

// Escapa también comillas: sin ellas, mover un valor a un atributo HTML
// convertiría la plantilla en un XSS.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function obtenerEstilo(nivel) {
  // Object.hasOwn evita que claves del prototipo ('constructor', 'toString',
  // '__proto__') devuelvan algo sin 'gradiente' y revienten el destructuring.
  return Object.hasOwn(ESTILOS_NIVEL, nivel) ? ESTILOS_NIVEL[nivel] : ESTILOS_NIVEL.Bronce;
}

function buildTarjetaHtml({ nombre, nivel, puntos, id }) {
  const estilo = obtenerEstilo(nivel);
  const [colorInicio, colorFin] = estilo.gradiente;
  const nombreSeguro = escapeHtml(nombre);
  const nivelSeguro = escapeHtml(Object.hasOwn(ESTILOS_NIVEL, nivel) ? nivel : 'Bronce');
  const numeroSocio = escapeHtml(String(id ?? '').padStart(6, '0'));
  const puntosSeguro = Number.isFinite(Number(puntos)) ? Number(puntos) : 0;

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f2f2f2; padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; border-collapse:collapse;">
      <tr>
        <td style="text-align:center; padding-bottom:20px;">
          <span style="font-size:14px; letter-spacing:2px; color:#888; text-transform:uppercase;">Fidelidad APP</span>
        </td>
      </tr>
      <tr>
        <td>
          <div style="border-radius:18px; padding:28px; background:linear-gradient(135deg, ${colorInicio}, ${colorFin}); color:${estilo.texto}; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:13px; letter-spacing:1.5px; text-transform:uppercase; opacity:0.85;">Tarjeta de Fidelidad</span>
              <span style="font-size:13px; font-weight:bold; text-transform:uppercase;">${nivelSeguro}</span>
            </div>
            <div style="margin-top:28px; font-size:22px; font-weight:bold;">${nombreSeguro}</div>
            <div style="margin-top:6px; font-size:13px; opacity:0.8;">N° de socio: ${numeroSocio}</div>
            <div style="margin-top:24px; display:flex; justify-content:space-between; align-items:flex-end;">
              <div>
                <div style="font-size:12px; opacity:0.8;">Puntos acumulados</div>
                <div style="font-size:26px; font-weight:bold;">${puntosSeguro} pts</div>
              </div>
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:20px; text-align:center; color:#666; font-size:13px; line-height:1.5;">
          ¡Hola ${nombreSeguro}! Esta es tu tarjeta de fidelidad digital.<br />
          Segui acumulando puntos en tus compras para subir de nivel y acceder a mejores recompensas.
        </td>
      </tr>
    </table>
  </div>`;
}

module.exports = { buildTarjetaHtml, escapeHtml };
