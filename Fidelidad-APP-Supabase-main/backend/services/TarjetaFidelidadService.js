const AppError = require('../core/AppError');
const { buildTarjetaHtml } = require('../utils/tarjetaTemplate');

class TarjetaFidelidadService {
  constructor({ fidelidadService, emailProvider, tarjetaRepository }) {
    this.fidelidadService = fidelidadService;
    this.emailProvider = emailProvider;
    this.tarjetaRepository = tarjetaRepository;
  }

  async enviarTarjeta(clienteId) {
    const cliente = await this.fidelidadService.getClienteDetalle(clienteId);

    const htmlContent = buildTarjetaHtml({
      id: cliente.id,
      nombre: cliente.nombre,
      nivel: cliente.nivel,
      puntos: cliente.puntos
    });

    await this.emailProvider.send({
      to: cliente.email,
      toName: cliente.nombre,
      subject: `Tu tarjeta de fidelidad ${cliente.nivel} está lista`,
      htmlContent
    });

    // El correo ya salió: si falla el registro no se puede deshacer el envío,
    // así que se deja constancia en el log y se avisa al cliente de la API en
    // lugar de devolver un 500 que sugeriría que no se envió nada.
    try {
      const registro = await this.tarjetaRepository.create({
        cliente_id: cliente.id,
        nivel: cliente.nivel,
        puntos: cliente.puntos
      });

      return { mensaje: `Tarjeta de fidelidad enviada a ${cliente.email}`, tarjeta: registro };
    } catch (err) {
      console.error(
        `[INCONSISTENCIA] Se envió la tarjeta a ${cliente.email} (cliente ${cliente.id}) ` +
        'pero no se pudo registrar el envío:',
        err
      );

      return {
        mensaje: `Tarjeta enviada a ${cliente.email}, pero no se pudo registrar en el historial`,
        tarjeta: null,
        registrada: false
      };
    }
  }

  async listEnviadas() {
    const tarjetas = await this.tarjetaRepository.findAllWithCliente();

    return tarjetas.map((tarjeta) => ({
      id: tarjeta.id,
      clienteId: tarjeta.cliente_id,
      nombre: tarjeta.clientes?.nombre || 'Cliente eliminado',
      email: tarjeta.clientes?.email || '',
      nivel: tarjeta.nivel,
      puntos: tarjeta.puntos,
      fechaEnvio: tarjeta.fecha_envio
    }));
  }

  async listPorCliente(clienteId) {
    await this.fidelidadService.getClienteDetalle(clienteId);
    return this.tarjetaRepository.findByClienteId(clienteId);
  }

  async previsualizarActual(clienteId) {
    const cliente = await this.fidelidadService.getClienteDetalle(clienteId);

    return buildTarjetaHtml({
      id: cliente.id,
      nombre: cliente.nombre,
      nivel: cliente.nivel,
      puntos: cliente.puntos
    });
  }

  async previsualizarEnviada(tarjetaId) {
    const id = Number(tarjetaId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Tarjeta inválida', 400);
    }

    const tarjeta = await this.tarjetaRepository.findById(id);

    if (!tarjeta) {
      throw new AppError('Tarjeta no encontrada', 404);
    }

    return buildTarjetaHtml({
      id: tarjeta.cliente_id,
      nombre: tarjeta.clientes?.nombre || 'Cliente eliminado',
      nivel: tarjeta.nivel,
      puntos: tarjeta.puntos
    });
  }
}

module.exports = TarjetaFidelidadService;
