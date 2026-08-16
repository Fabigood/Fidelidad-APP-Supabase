class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res) => {
    const usuario = String(req.body?.username || '').slice(0, 50);

    try {
      const token = await this.authService.login(req.body);

      // Rastro de auditoría: sin esto no hay forma de detectar un ataque de
      // fuerza bruta en curso ni de investigar un acceso indebido a posteriori.
      console.log(`[AUTH] Inicio de sesión correcto usuario="${usuario}" ip=${req.ip}`);

      res.json({ token });
    } catch (err) {
      if (err?.statusCode === 401) {
        console.warn(`[AUTH] Intento fallido usuario="${usuario}" ip=${req.ip}`);
      }
      throw err;
    }
  };
}

module.exports = AuthController;
