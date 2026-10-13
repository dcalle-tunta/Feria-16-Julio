export const CONFIGURACIONES_SEMILLA = [
  {
    clave: 'MAX_CONSULTAS_SESION',
    valor: '20',
    descripcion: 'Consultas de chat por sesión antes de bloquear',
  },
  {
    clave: 'TIEMPO_BLOQUEO_MINUTOS',
    valor: '60',
    descripcion: 'Minutos de bloqueo al superar el máximo',
  },
  {
    clave: 'MAX_NEGOCIOS_SUGERIDOS',
    valor: '5',
    descripcion: 'Tope de negocios devueltos por una recomendación',
  },
] as const;

export const CATEGORIAS_SEMILLA = [
  { nombre: 'Deportes', slug: 'deportes' },
  { nombre: 'Automóviles', slug: 'automoviles' },
  { nombre: 'Comida & bebidas', slug: 'comida-bebidas' },
  { nombre: 'Mascotas', slug: 'mascotas' },
] as const;

export const DIAS_SEMILLA = [
  { id: 1, codigo: 'JUEVES', nombre: 'Jueves' },
  { id: 2, codigo: 'DOMINGO', nombre: 'Domingo' },
  { id: 3, codigo: 'OTROS', nombre: 'Otros' },
] as const;
