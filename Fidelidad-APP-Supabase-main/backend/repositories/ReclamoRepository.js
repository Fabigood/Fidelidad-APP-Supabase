const { fetchAll } = require('./fetchAll');

const CAMPOS_CON_RECOMPENSA = `
  id,
  cliente_id,
  recompensa_id,
  fecha,
  recompensas (
    nombre,
    tipo,
    nivel
  )
`;

class ReclamoRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async findAllWithReward() {
    return fetchAll((desde, hasta) =>
      this.db
        .from('reclamos_recompensa')
        .select(CAMPOS_CON_RECOMPENSA)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .range(desde, hasta)
    );
  }

  async findByClienteId(clienteId) {
    return fetchAll((desde, hasta) =>
      this.db
        .from('reclamos_recompensa')
        .select(CAMPOS_CON_RECOMPENSA)
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .range(desde, hasta)
    );
  }

  async create(reclamo) {
    const { data, error } = await this.db
      .from('reclamos_recompensa')
      .insert([reclamo])
      .select('id, cliente_id, recompensa_id, fecha, mes, anio')
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = ReclamoRepository;
