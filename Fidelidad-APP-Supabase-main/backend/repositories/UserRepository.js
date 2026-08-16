class UserRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Devuelve el usuario con su hash. La contraseña NUNCA se compara en la base:
   * eso obligaría a guardarla en claro. La verificación es en AuthService con bcrypt.
   */
  async findByUsername(username) {
    const { data, error } = await this.db
      .from('usuarios')
      .select('id, username, password')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updatePasswordHash(id, passwordHash) {
    const { error } = await this.db
      .from('usuarios')
      .update({ password: passwordHash })
      .eq('id', id);

    if (error) throw error;
  }
}

module.exports = UserRepository;
