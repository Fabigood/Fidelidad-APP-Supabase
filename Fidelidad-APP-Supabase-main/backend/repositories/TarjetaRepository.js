const { fetchAll } = require('./fetchAll');

const CAMPOS_CON_CLIENTE = `
  id,
  cliente_id,
  nivel,
  puntos,
  fecha_envio,
  clientes (
    nombre,
    email
  )
`;

class TarjetaRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async findAllWithCliente() {
    return fetchAll((desde, hasta) =>
      this.db
        .from('tarjetas_fidelidad')
        .select(CAMPOS_CON_CLIENTE)
        .order('fecha_envio', { ascending: false })
        .range(desde, hasta)
    );
  }

  async findById(id) {
    const { data, error } = await this.db
      .from('tarjetas_fidelidad')
      .select(CAMPOS_CON_CLIENTE)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByClienteId(clienteId) {
    return fetchAll((desde, hasta) =>
      this.db
        .from('tarjetas_fidelidad')
        .select('id, cliente_id, nivel, puntos, fecha_envio')
        .eq('cliente_id', clienteId)
        .order('fecha_envio', { ascending: false })
        .range(desde, hasta)
    );
  }

  async create(tarjeta) {
    const { data, error } = await this.db
      .from('tarjetas_fidelidad')
      .insert([tarjeta])
      .select('id, cliente_id, nivel, puntos, fecha_envio')
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = TarjetaRepository;
