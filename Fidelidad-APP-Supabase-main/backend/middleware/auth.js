const jwt = require('jsonwebtoken');
const config = require('../core/config');

function getTokenFromHeader(req) {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (!authorization) return null;

  const [tipo, token] = String(authorization).split(' ');

  // Solo se acepta el esquema Bearer: aceptar el token crudo amplia la superficie
  // de ataque sin aportar nada.
  if (tipo === 'Bearer' && token) return token.trim();

  return null;
}

module.exports = (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    // algorithms fija HS256 (evita confusion de algoritmos si algun dia se migra a RS256).
    // maxAge + la comprobacion de exp impiden que un token forjado sin expiracion valga para siempre.
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algorithm],
      maxAge: config.jwt.expiresIn
    });

    if (!decoded || typeof decoded.exp !== 'number') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};
