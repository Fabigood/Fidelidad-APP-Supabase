const AppError = require('../../core/AppError');

const TIMEOUT_MS = 10_000;

class BrevoEmailProvider {
  constructor({ apiKey, senderEmail, senderName }) {
    this.apiKey = String(apiKey || '').trim();
    this.senderEmail = String(senderEmail || '').trim();
    this.senderName = String(senderName || '').trim() || 'Fidelidad APP';
  }

  get configurado() {
    return Boolean(this.apiKey && this.senderEmail);
  }

  async send({ to, toName, subject, htmlContent }) {
    if (!this.configurado) {
      throw new AppError(
        'El envío de correos no está configurado. Definí BREVO_API_KEY y BREVO_SENDER_EMAIL en el .env del backend.',
        503
      );
    }

    // Sin timeout, una API lenta bloquea la petición indefinidamente.
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          sender: { name: this.senderName, email: this.senderEmail },
          to: [{ email: to, name: toName }],
          subject,
          htmlContent
        })
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new AppError('El servicio de correo no respondió a tiempo', 504);
      }
      throw new AppError('No se pudo contactar con el servicio de correo', 502);
    } finally {
      clearTimeout(temporizador);
    }

    if (!response.ok) {
      const detalle = await response.text().catch(() => '');
      // El detalle de Brevo puede incluir la clave o datos internos: se registra
      // en el servidor y no se devuelve al cliente.
      console.error(`[BREVO] Error ${response.status} al enviar correo:`, detalle);
      throw new AppError('No se pudo enviar el correo con la tarjeta de fidelidad', 502);
    }

    return response.json().catch(() => ({}));
  }
}

module.exports = BrevoEmailProvider;
