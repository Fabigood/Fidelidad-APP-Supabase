const { fetchAll } = require('./fetchAll');

const CAMPOS = 'id, nombre, nivel, tipo, detalle, activo';

class RecompensaRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async findAll() {
    return fetchAll((desde, hasta) =>
      this.db
        .from('recompensas')
        .select(CAMPOS)
        .order('id', { ascending: true })
        .range(desde, hasta)
    );
  }

  async findById(id) {
    const { data, error } = await this.db
      .from('recompensas')
      .select(CAMPOS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(recompensa) {
    const { data, error } = await this.db
      .from('recompensas')
      .insert([recompensa])
      .select(CAMPOS)
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, recompensa) {
    const { data, error } = await this.db
      .from('recompensas')
      .update(recompensa)
      .eq('id', id)
      .select(CAMPOS)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { data, error } = await this.db
      .from('recompensas')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = RecompensaRepository;
