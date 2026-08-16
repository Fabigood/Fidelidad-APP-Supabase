const { fetchAll } = require('./fetchAll');

const CAMPOS = 'id, cliente_id, fecha, monto, puntos_generados';

class CompraRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async findAllOrdered() {
    return fetchAll((desde, hasta) =>
      this.db
        .from('compras')
        .select(CAMPOS)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(desde, hasta)
    );
  }

  async findByClienteId(clienteId) {
    return fetchAll((desde, hasta) =>
      this.db
        .from('compras')
        .select(CAMPOS)
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(desde, hasta)
    );
  }

  async create(compra) {
    const { data, error } = await this.db
      .from('compras')
      .insert([compra])
      .select(CAMPOS)
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = CompraRepository;
