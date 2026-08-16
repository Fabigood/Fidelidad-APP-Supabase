// PostgREST aplica un tope de filas por respuesta (en Supabase, 1000 por defecto).
// Sin paginar, una consulta sin .range() devuelve solo el primer bloque SIN error:
// los puntos de fidelidad se calcularían con datos incompletos y en silencio.
const TAMANO_PAGINA = 1000;
const MAX_PAGINAS = 500; // tope de seguridad: 500.000 filas

/**
 * @param {(desde:number, hasta:number) => PromiseLike<{data:any[]|null, error:any}>} construirConsulta
 */
async function fetchAll(construirConsulta) {
  const filas = [];

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const desde = pagina * TAMANO_PAGINA;
    const hasta = desde + TAMANO_PAGINA - 1;

    const { data, error } = await construirConsulta(desde, hasta);
    if (error) throw error;

    const bloque = data || [];
    filas.push(...bloque);

    if (bloque.length < TAMANO_PAGINA) return filas;
  }

  console.warn(
    `[AVISO] fetchAll alcanzó el tope de ${MAX_PAGINAS * TAMANO_PAGINA} filas. ` +
    'Los resultados pueden estar incompletos: hay que migrar a consultas agregadas en la base.'
  );
  return filas;
}

module.exports = { fetchAll, TAMANO_PAGINA };
