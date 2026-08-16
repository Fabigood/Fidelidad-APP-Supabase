const AppError = require('../core/AppError');
const { formatFecha } = require('../utils/dateFormatter');
const { NIVELES, TIPOS_RECOMPENSA, validarFechaISO } = require('../validators');

const ORDEN_NIVEL = { Bronce: 1, Plata: 2, Oro: 3 };

// La columna es NUMERIC(10,2): por encima de este valor Postgres rechaza el insert.
const MONTO_MAXIMO = 99999999.99;
const LONGITUD_MAXIMA_NOMBRE = 120;
const LONGITUD_MAXIMA_DETALLE = 500;

class FidelidadService {
  constructor({
    clienteRepository,
    compraRepository,
    recompensaRepository,
    reclamoRepository,
    pointsStrategy,
    levelStrategy,
    zonaHoraria = 'UTC'
  }) {
    this.clienteRepository = clienteRepository;
    this.compraRepository = compraRepository;
    this.recompensaRepository = recompensaRepository;
    this.reclamoRepository = reclamoRepository;
    this.pointsStrategy = pointsStrategy;
    this.levelStrategy = levelStrategy;
    this.formateadorFecha = new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  async getClientesConDetalle() {
    const [clientes, compras, reclamos] = await Promise.all([
      this.clienteRepository.findAll(),
      this.compraRepository.findAllOrdered(),
      this.reclamoRepository.findAllWithReward()
    ]);

    // Se indexa una sola vez por cliente. El cruce anterior era clientes.map ×
    // compras.filter, es decir O(n×m) en cada peticion.
    const comprasPorCliente = this.agruparPor(compras, 'cliente_id');
    const reclamosPorCliente = this.agruparPor(reclamos, 'cliente_id');

    // Se devuelve ya analizado: el estado y la probabilidad de retorno son
    // reglas de negocio y deben calcularse en un unico sitio. Cuando el
    // frontend las recalculaba por su cuenta, un cliente con una sola compra
    // salia "En observacion" en el panel y "Sin datos" en el listado.
    return clientes.map((cliente) =>
      this.analizarEstadoCliente(
        this.buildClienteDetalle(
          cliente,
          comprasPorCliente.get(Number(cliente.id)) || [],
          reclamosPorCliente.get(Number(cliente.id)) || []
        )
      )
    );
  }

  /**
   * Consulta solo los datos del cliente pedido.
   * Antes delegaba en getClientesConDetalle(), que descargaba la base entera
   * para quedarse con una unica fila.
   */
  async getClienteDetalle(id) {
    const clienteId = this.validateId(id, 'Cliente inválido');
    const cliente = await this.clienteRepository.findById(clienteId);

    if (!cliente) {
      throw new AppError('Cliente no encontrado', 404);
    }

    const [compras, reclamos] = await Promise.all([
      this.compraRepository.findByClienteId(clienteId),
      this.reclamoRepository.findByClienteId(clienteId)
    ]);

    return this.analizarEstadoCliente(
      this.buildClienteDetalle(cliente, compras, reclamos)
    );
  }

  async registrarCompra(payload) {
    const clienteId = this.validateId(payload?.cliente_id, 'Datos de compra inválidos');
    const monto = this.validarMonto(payload?.monto);
    const { fecha } = this.validarFecha(payload?.fecha);

    await this.ensureClienteExists(clienteId);

    const puntos = this.pointsStrategy.calculate(monto);

    const data = await this.compraRepository.create({
      cliente_id: clienteId,
      fecha,
      monto,
      puntos_generados: puntos
    });

    return {
      ...data,
      fecha: formatFecha(data.fecha),
      monto: Number(data.monto),
      puntos_generados: Number(data.puntos_generados)
    };
  }

  async listRecompensas() {
    const recompensas = await this.recompensaRepository.findAll();

    return recompensas
      .map((recompensa) => ({ ...recompensa, activo: Boolean(recompensa.activo) }))
      .sort((a, b) => this.sortByNivelThenId(a, b));
  }

  async createRecompensa(payload) {
    const recompensa = this.normalizeRecompensa(payload);
    const data = await this.recompensaRepository.create(recompensa);
    return { ...data, activo: Boolean(data.activo) };
  }

  async updateRecompensa(id, payload) {
    const recompensaId = this.validateId(id, 'Recompensa inválida');
    const recompensa = this.normalizeRecompensa(payload);
    const data = await this.recompensaRepository.update(recompensaId, recompensa);

    if (!data) {
      throw new AppError('Recompensa no encontrada', 404);
    }

    return { ...data, activo: Boolean(data.activo) };
  }

  async deleteRecompensa(id) {
    const recompensaId = this.validateId(id, 'Recompensa inválida');
    const eliminada = await this.recompensaRepository.delete(recompensaId);

    if (!eliminada) {
      throw new AppError('Recompensa no encontrada', 404);
    }

    return { mensaje: 'Recompensa eliminada' };
  }

  async registrarReclamo(payload) {
    const clienteId = this.validateId(payload?.cliente_id, 'Datos de reclamo inválidos');
    const recompensaId = this.validateId(payload?.recompensa_id, 'Datos de reclamo inválidos');
    const { fecha, mes, anio } = this.validarFecha(payload?.fecha);

    await this.ensureClienteExists(clienteId);
    await this.ensureRecompensaExists(recompensaId);

    const data = await this.reclamoRepository.create({
      cliente_id: clienteId,
      recompensa_id: recompensaId,
      fecha,
      mes,
      anio
    });

    return { ...data, fecha: formatFecha(data.fecha) };
  }

  buildClienteDetalle(cliente, compras = [], reclamos = []) {
    const comprasCliente = compras.map((compra) => ({
      id: compra.id,
      fecha: formatFecha(compra.fecha),
      monto: Number(compra.monto),
      puntos_generados: Number(compra.puntos_generados)
    }));

    const puntos = comprasCliente.reduce(
      (total, compra) => total + Number(compra.puntos_generados || 0),
      0
    );

    return {
      ...cliente,
      puntos,
      nivel: this.levelStrategy.calculate(puntos),
      compras: comprasCliente,
      recompensasEntregadas: reclamos.map((reclamo) => ({
        id: reclamo.id,
        recompensaId: reclamo.recompensa_id,
        recompensa: reclamo.recompensas?.nombre || '',
        tipo: reclamo.recompensas?.tipo || '',
        nivel: reclamo.recompensas?.nivel || '',
        fecha: formatFecha(reclamo.fecha)
      }))
    };
  }

  normalizeRecompensa(payload) {
    const nombre = String(payload?.nombre ?? '').trim().replace(/\s+/g, ' ');
    const nivel = String(payload?.nivel ?? 'Bronce').trim();
    const tipo = String(payload?.tipo ?? 'Producto').trim();
    const detalle = String(payload?.detalle ?? '').trim();

    if (!nombre) {
      throw new AppError('El nombre de la recompensa es obligatorio', 400, { campo: 'nombre' });
    }
    if (nombre.length > LONGITUD_MAXIMA_NOMBRE) {
      throw new AppError(
        `El nombre no puede superar los ${LONGITUD_MAXIMA_NOMBRE} caracteres`,
        422,
        { campo: 'nombre' }
      );
    }

    // Sin lista blanca, un nivel arbitrario llegaba al CHECK de Postgres y volvia
    // como un 500 con el error de la base en el cuerpo.
    if (!NIVELES.includes(nivel)) {
      throw new AppError(`El nivel debe ser uno de: ${NIVELES.join(', ')}`, 422, { campo: 'nivel' });
    }
    if (!TIPOS_RECOMPENSA.includes(tipo)) {
      throw new AppError(
        `El tipo debe ser uno de: ${TIPOS_RECOMPENSA.join(', ')}`,
        422,
        { campo: 'tipo' }
      );
    }
    if (detalle.length > LONGITUD_MAXIMA_DETALLE) {
      throw new AppError(
        `El detalle no puede superar los ${LONGITUD_MAXIMA_DETALLE} caracteres`,
        422,
        { campo: 'detalle' }
      );
    }

    return { nombre, nivel, tipo, detalle, activo: this.normalizarBooleano(payload?.activo) };
  }

  // 'false' (string) y 0 son valores falsos legitimos que `!== false` convertia en true.
  normalizarBooleano(valor) {
    if (valor === undefined || valor === null) return true;
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'number') return valor !== 0;
    return !['false', '0', 'no', ''].includes(String(valor).trim().toLowerCase());
  }

  validarMonto(valor) {
    const monto = Number(valor);

    if (!Number.isFinite(monto) || monto <= 0) {
      throw new AppError('El monto debe ser un número mayor a cero', 400, { campo: 'monto' });
    }
    if (monto > MONTO_MAXIMO) {
      throw new AppError(`El monto no puede superar ${MONTO_MAXIMO}`, 422, { campo: 'monto' });
    }

    return Number(monto.toFixed(2));
  }

  validarFecha(valor) {
    const resultado = validarFechaISO(valor);

    if (!resultado.valida) {
      throw new AppError(resultado.error, 400, { campo: 'fecha' });
    }

    return resultado;
  }

  agruparPor(items, clave) {
    const mapa = new Map();

    for (const item of items) {
      const id = Number(item[clave]);
      if (!mapa.has(id)) mapa.set(id, []);
      mapa.get(id).push(item);
    }

    return mapa;
  }

  async ensureClienteExists(id) {
    const cliente = await this.clienteRepository.findById(id);
    if (!cliente) {
      throw new AppError('El cliente seleccionado no existe', 400, { campo: 'cliente_id' });
    }
  }

  async ensureRecompensaExists(id) {
    const recompensa = await this.recompensaRepository.findById(id);
    if (!recompensa) {
      throw new AppError('La recompensa seleccionada no existe', 400, { campo: 'recompensa_id' });
    }
  }

  async getResumenAdministrativo() {
    const [clientes, compras, recompensas, reclamos] = await Promise.all([
      this.clienteRepository.findAll(),
      this.compraRepository.findAllOrdered(),
      this.recompensaRepository.findAll(),
      this.reclamoRepository.findAllWithReward()
    ]);

    const comprasPorCliente = this.agruparPor(compras, 'cliente_id');
    const reclamosPorCliente = this.agruparPor(reclamos, 'cliente_id');

    const clientesAnalizados = clientes.map((cliente) =>
      this.analizarEstadoCliente(
        this.buildClienteDetalle(
          cliente,
          comprasPorCliente.get(Number(cliente.id)) || [],
          reclamosPorCliente.get(Number(cliente.id)) || []
        )
      )
    );

    const enRiesgo = clientesAnalizados.filter((cliente) => cliente.estado !== 'Activo');

    const puntosGenerados = compras.reduce(
      (total, compra) => total + Number(compra.puntos_generados || 0),
      0
    );

    const totalVentas = compras.reduce((total, compra) => total + Number(compra.monto || 0), 0);

    return {
      fechaGeneracion: new Date().toISOString(),
      totalClientes: clientes.length,
      totalCompras: compras.length,
      totalVentas: Number(totalVentas.toFixed(2)),
      ticketPromedio: compras.length ? Number((totalVentas / compras.length).toFixed(2)) : 0,
      puntosGenerados,
      recompensasDisponibles: recompensas.filter((r) => Boolean(r.activo)).length,
      recompensasEntregadas: reclamos.length,
      retornoPromedio: clientesAnalizados.length
        ? Math.round(
            clientesAnalizados.reduce((total, c) => total + c.probabilidadRetorno, 0) /
              clientesAnalizados.length
          )
        : 0,
      clientesPorNivel: this.getClientesPorNivel(clientesAnalizados),
      // El total va aparte de la lista: el panel mostraba la longitud de la
      // lista recortada, asi que con 20 clientes en riesgo seguia diciendo 5.
      totalClientesEnRiesgo: enRiesgo.length,
      clientesEnRiesgo: enRiesgo
        .slice(0, 5)
        .map((cliente) => ({
          id: cliente.id,
          nombre: cliente.nombre,
          estado: cliente.estado,
          probabilidadRetorno: cliente.probabilidadRetorno,
          ultimaCompra: cliente.ultimaCompra
        })),
      ultimasCompras: this.getUltimasCompras(clientes, compras)
    };
  }

  getClientesPorNivel(clientesDetalle) {
    return NIVELES.map((nivel) => {
      const total = clientesDetalle.filter((cliente) => cliente.nivel === nivel).length;
      return {
        nivel,
        total,
        porcentaje: clientesDetalle.length ? Math.round((total / clientesDetalle.length) * 100) : 0
      };
    });
  }

  getUltimasCompras(clientes, compras) {
    const clientesPorId = new Map(clientes.map((cliente) => [Number(cliente.id), cliente]));

    return [...compras]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || Number(b.id) - Number(a.id))
      .slice(0, 6)
      .map((compra) => ({
        id: compra.id,
        clienteId: compra.cliente_id,
        cliente: clientesPorId.get(Number(compra.cliente_id))?.nombre || 'Cliente no registrado',
        monto: Number(compra.monto),
        fecha: formatFecha(compra.fecha),
        puntosGenerados: Number(compra.puntos_generados || 0)
      }));
  }

  analizarEstadoCliente(cliente) {
    const compras = [...(cliente.compras || [])].sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha)
    );

    if (!compras.length) {
      return {
        ...cliente,
        estado: 'Sin datos',
        probabilidadRetorno: 20,
        intervalo: null,
        ultimaCompra: null,
        proximaCompra: null,
        diasDesdeUltima: null,
        totalCompras: 0
      };
    }

    const ultimaCompra = compras[compras.length - 1].fecha;
    const diasDesdeUltima = this.diffDays(ultimaCompra, this.hoy());

    if (compras.length < 2) {
      return {
        ...cliente,
        estado: 'En observación',
        probabilidadRetorno: 45,
        intervalo: null,
        ultimaCompra,
        proximaCompra: null,
        diasDesdeUltima,
        totalCompras: compras.length
      };
    }

    const intervalo = this.calcularIntervaloPromedio(compras);

    let estado = 'Activo';
    let probabilidadRetorno = 90;

    // Un intervalo de 0 dias (varias compras el mismo dia) haria que cualquier
    // comparacion contra sus multiplos diera siempre verdadero.
    if (intervalo > 0) {
      if (diasDesdeUltima > intervalo * 2.2) {
        estado = 'Inactivo';
        probabilidadRetorno = 15;
      } else if (diasDesdeUltima > intervalo * 1.5) {
        estado = 'En riesgo';
        probabilidadRetorno = 35;
      } else if (diasDesdeUltima > intervalo) {
        estado = 'En riesgo';
        probabilidadRetorno = 60;
      }
    }

    return {
      ...cliente,
      estado,
      probabilidadRetorno,
      intervalo: Number(intervalo.toFixed(1)),
      ultimaCompra,
      proximaCompra: this.sumarDias(ultimaCompra, Math.round(intervalo)),
      diasDesdeUltima,
      totalCompras: compras.length
    };
  }

  /**
   * Fecha de hoy en la zona horaria del negocio (formato AAAA-MM-DD).
   * en-CA produce exactamente ese formato.
   */
  hoy() {
    return this.formateadorFecha.format(new Date());
  }

  sumarDias(fechaISO, dias) {
    const base = new Date(`${String(fechaISO).slice(0, 10)}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + Number(dias || 0));
    return base.toISOString().slice(0, 10);
  }

  calcularIntervaloPromedio(compras) {
    if (compras.length < 2) return 0;

    let totalDias = 0;
    for (let i = 1; i < compras.length; i += 1) {
      totalDias += this.diffDays(compras[i - 1].fecha, compras[i].fecha);
    }

    return totalDias / (compras.length - 1);
  }

  diffDays(fechaInicio, fechaFin) {
    const inicio = new Date(`${String(fechaInicio).slice(0, 10)}T00:00:00Z`);
    const fin = new Date(`${String(fechaFin).slice(0, 10)}T00:00:00Z`);
    return Math.round((fin - inicio) / 86400000);
  }

  sortByNivelThenId(a, b) {
    const nivelA = ORDEN_NIVEL[a.nivel] || 4;
    const nivelB = ORDEN_NIVEL[b.nivel] || 4;
    if (nivelA !== nivelB) return nivelA - nivelB;
    return Number(a.id) - Number(b.id);
  }

  validateId(id, message) {
    const value = Number(id);
    if (!Number.isInteger(value) || value <= 0) throw new AppError(message, 400);
    return value;
  }
}

module.exports = FidelidadService;
