const AppError = require('../core/AppError');
const { normalizeEmail, validarEmail } = require('../validators');

const LONGITUD_MAXIMA_NOMBRE = 120;

class ClienteService {
  constructor({ clienteRepository, levelStrategy }) {
    this.clienteRepository = clienteRepository;
    this.levelStrategy = levelStrategy;
  }

  async list() {
    return this.clienteRepository.findAll();
  }

  async create(payload) {
    const cliente = this.normalizeAndValidate(payload);
    await this.ensureEmailAvailable(cliente.email);

    try {
      return await this.clienteRepository.create(cliente);
    } catch (err) {
      throw this.traducirConflicto(err);
    }
  }

  async update(id, payload) {
    const clienteId = this.validateId(id, 'Cliente inválido');
    const cliente = this.normalizeAndValidate(payload);
    await this.ensureEmailAvailable(cliente.email, clienteId);

    let updated;
    try {
      updated = await this.clienteRepository.update(clienteId, cliente);
    } catch (err) {
      throw this.traducirConflicto(err);
    }

    if (!updated) {
      throw new AppError('Cliente no encontrado', 404);
    }

    return updated;
  }

  async delete(id) {
    const clienteId = this.validateId(id, 'Cliente inválido');
    const eliminado = await this.clienteRepository.delete(clienteId);

    if (!eliminado) {
      throw new AppError('Cliente no encontrado', 404);
    }

    return { mensaje: 'Cliente eliminado' };
  }

  addResumenFidelidad(cliente, puntos = 0) {
    const total = Number(puntos) || 0;
    return {
      ...cliente,
      puntos: total,
      nivel: this.levelStrategy.calculate(total)
    };
  }

  normalizeAndValidate(payload) {
    const nombre = String(payload?.nombre ?? '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(payload?.email);

    if (!nombre || !email) {
      throw new AppError('El nombre y el correo son obligatorios', 400);
    }

    if (nombre.length > LONGITUD_MAXIMA_NOMBRE) {
      throw new AppError(
        `El nombre no puede superar los ${LONGITUD_MAXIMA_NOMBRE} caracteres`,
        422,
        { campo: 'nombre' }
      );
    }

    const emailError = validarEmail(email);
    if (emailError) {
      throw new AppError(emailError, 422, { campo: 'email' });
    }

    // Se devuelve un objeto nuevo con solo los campos permitidos: cualquier otra
    // propiedad del payload se descarta antes de llegar a la base.
    return { nombre, email };
  }

  async ensureEmailAvailable(email, exceptId = null) {
    const duplicados = await this.clienteRepository.findDuplicatedEmail(email, exceptId);

    if (duplicados.length > 0) {
      throw new AppError('El correo ya está registrado por otro cliente', 409, { campo: 'email' });
    }
  }

  /**
   * El chequeo previo y la escritura no son atómicos: dos peticiones simultáneas
   * pueden pasar ambas y chocar contra el UNIQUE de Postgres. Se traduce a un 409
   * limpio en vez de dejar escapar un 500.
   */
  traducirConflicto(err) {
    if (err?.code === '23505') {
      return new AppError('El correo ya está registrado por otro cliente', 409, { campo: 'email' });
    }
    return err;
  }

  validateId(id, message) {
    const value = Number(id);
    if (!Number.isInteger(value) || value <= 0) throw new AppError(message, 400);
    return value;
  }
}

module.exports = ClienteService;
