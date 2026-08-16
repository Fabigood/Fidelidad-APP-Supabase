const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../core/AppError');

// Hash descartable: se compara contra él cuando el usuario no existe, para que
// el tiempo de respuesta no revele si el nombre de usuario es válido.
const HASH_SEÑUELO = bcrypt.hashSync('usuario-inexistente', 10);

class AuthService {
  constructor({ userRepository, jwtConfig }) {
    this.userRepository = userRepository;
    this.jwtConfig = jwtConfig;
  }

  async login({ username, password }) {
    const usuario = String(username || '').trim();
    const clave = String(password || '');

    if (!usuario || !clave) {
      throw new AppError('Usuario y contraseña son obligatorios', 400);
    }

    const user = await this.userRepository.findByUsername(usuario);
    const hash = user?.password || HASH_SEÑUELO;
    const coincide = await bcrypt.compare(clave, hash);

    // Mensaje único para usuario inexistente y contraseña incorrecta:
    // distinguirlos permitiría enumerar usuarios válidos.
    if (!user || !coincide) {
      throw new AppError('Usuario o contraseña incorrectos', 401);
    }

    return jwt.sign(
      { id: user.id, username: user.username },
      this.jwtConfig.secret,
      { expiresIn: this.jwtConfig.expiresIn, algorithm: this.jwtConfig.algorithm }
    );
  }

  static async hashPassword(plano) {
    return bcrypt.hash(String(plano), 12);
  }
}

module.exports = AuthService;
