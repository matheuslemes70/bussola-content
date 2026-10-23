// O Supabase devolve no máximo 1.000 linhas por consulta. Para medições que
// olham muitos registros (histórico de etapas, por exemplo), busca em páginas
// até acabar, para os números nunca saírem cortados sem ninguém perceber.
export async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanho = 1000,
  limite = 20000
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; de < limite; de += tamanho) {
    const { data, error } = await consulta(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    tudo.push(...pagina);
    if (pagina.length < tamanho) break;
  }
  return tudo;
}
