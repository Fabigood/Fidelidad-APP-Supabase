const { fetchAll } = require('./fetchAll');

const CAMPOS = 'id, nombre, email';

class ClienteRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async findAll() {
    return fetchAll((desde, hasta) =>
      this.db
        .from('clientes')
        .select(CAMPOS)
        .order('id', { ascending: false })
        .range(desde, hasta)
    );
  }

  async findById(id) {
    const { data, error } = await this.db
      .from('clientes')
      .select(CAMPOS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByEmail(email) {
    const { data, error } = await this.db
      .from('clientes')
      .select(CAMPOS)
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findDuplicatedEmail(email, exceptId = null) {
    let query = this.db.from('clientes').select('id').eq('email', email).limit(1);

    if (exceptId) query = query.neq('id', exceptId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async create(cliente) {
    const { data, error } = await this.db
      .from('clientes')
      .insert([cliente])
      .select(CAMPOS)
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, cliente) {
    const { data, error } = await this.db
      .from('clientes')
      .update(cliente)
      .eq('id', id)
      .select(CAMPOS)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { data, error } = await this.db
      .from('clientes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = ClienteRepository;
