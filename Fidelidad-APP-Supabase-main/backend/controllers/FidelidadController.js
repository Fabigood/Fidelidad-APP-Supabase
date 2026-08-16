const TTL_RESUMEN_PUBLICO_MS = 60_000;

class FidelidadController {
  constructor({ clienteService, fidelidadService, tarjetaFidelidadService }) {
    this.clienteService = clienteService;
    this.fidelidadService = fidelidadService;
    this.tarjetaFidelidadService = tarjetaFidelidadService;
    this.cacheResumenPublico = { datos: null, expiraEn: 0 };
  }

  getResumen = async (req, res) => {
    res.json(await this.fidelidadService.getResumenAdministrativo());
  };

  /**
   * Endpoint sin autenticación (evidencia académica).
   * Se omiten las cifras de facturación —totalVentas y ticketPromedio eran datos
   * de negocio expuestos públicamente— y se cachea el resultado, porque cada
   * cálculo recorre cuatro tablas completas y era un DoS barato.
   */
  getResumenPublico = async (req, res) => {
    const ahora = Date.now();

    if (this.cacheResumenPublico.datos && ahora < this.cacheResumenPublico.expiraEn) {
      res.set('X-Cache', 'HIT');
      return res.json(this.cacheResumenPublico.datos);
    }

    const resumen = await this.fidelidadService.getResumenAdministrativo();

    const publico = {
      fechaGeneracion: resumen.fechaGeneracion,
      totalClientes: resumen.totalClientes,
      totalCompras: resumen.totalCompras,
      puntosGenerados: resumen.puntosGenerados,
      recompensasDisponibles: resumen.recompensasDisponibles,
      recompensasEntregadas: resumen.recompensasEntregadas,
      retornoPromedio: resumen.retornoPromedio,
      clientesPorNivel: resumen.clientesPorNivel,
      arquitectura: 'API JSON consumida por frontend Vue/Vite',
      nota: 'Resumen público para evidencia académica: sin datos de clientes ni cifras de facturación'
    };

    this.cacheResumenPublico = { datos: publico, expiraEn: ahora + TTL_RESUMEN_PUBLICO_MS };

    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'public, max-age=60');
    res.json(publico);
  };

  listClientes = async (req, res) => {
    res.json(await this.fidelidadService.getClientesConDetalle());
  };

  getCliente = async (req, res) => {
    res.json(await this.fidelidadService.getClienteDetalle(req.params.id));
  };

  createCliente = async (req, res) => {
    const cliente = await this.clienteService.create(req.body);

    let tarjetaEnviada = false;
    try {
      await this.tarjetaFidelidadService.enviarTarjeta(cliente.id);
      tarjetaEnviada = true;
    } catch (err) {
      // El alta del cliente ya está confirmada: un fallo de correo no debe
      // deshacerla, pero sí tiene que quedar registrado y reportado.
      console.error(
        `[AVISO] Cliente ${cliente.id} creado, pero falló el envío automático de la tarjeta:`,
        err.message
      );
    }

    res.status(201).json({
      ...cliente,
      puntos: 0,
      nivel: this.fidelidadService.levelStrategy.calculate(0),
      compras: [],
      recompensasEntregadas: [],
      tarjetaEnviada
    });
  };

  enviarTarjeta = async (req, res) => {
    res.json(await this.tarjetaFidelidadService.enviarTarjeta(req.params.id));
  };

  listTarjetasEnviadas = async (req, res) => {
    res.json(await this.tarjetaFidelidadService.listEnviadas());
  };

  previsualizarTarjetaCliente = async (req, res) => {
    const html = await this.tarjetaFidelidadService.previsualizarActual(req.params.id);
    res.json({ html });
  };

  previsualizarTarjetaEnviada = async (req, res) => {
    const html = await this.tarjetaFidelidadService.previsualizarEnviada(req.params.id);
    res.json({ html });
  };

  updateCliente = async (req, res) => {
    res.json(await this.clienteService.update(req.params.id, req.body));
  };

  deleteCliente = async (req, res) => {
    res.json(await this.clienteService.delete(req.params.id));
  };

  registrarCompra = async (req, res) => {
    res.status(201).json(await this.fidelidadService.registrarCompra(req.body));
  };

  listRecompensas = async (req, res) => {
    res.json(await this.fidelidadService.listRecompensas());
  };

  createRecompensa = async (req, res) => {
    res.status(201).json(await this.fidelidadService.createRecompensa(req.body));
  };

  updateRecompensa = async (req, res) => {
    res.json(await this.fidelidadService.updateRecompensa(req.params.id, req.body));
  };

  deleteRecompensa = async (req, res) => {
    res.json(await this.fidelidadService.deleteRecompensa(req.params.id));
  };

  registrarReclamo = async (req, res) => {
    res.status(201).json(await this.fidelidadService.registrarReclamo(req.body));
  };
}

module.exports = FidelidadController;
