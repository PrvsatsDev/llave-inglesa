/** Secciones, métricas, migas de pan y el banner de simulación sobre el mapa. */
export const navegacion = {
  secciones: { schema: 'Esquema', analysis: 'Análisis', simulate: 'Simular' },
  metricas: { security: 'Seguridad', resilience: 'Resiliencia', usability: 'Usabilidad', inheritance: 'Herencia' },
  /** Una frase que dice qué hay en cada sitio, para no perderse. */
  introSeccion: {
    schema: 'Qué keys hay, dónde está cada cosa y quién sabe qué. Pulsa cualquier elemento, aquí o en el mapa, para editarlo.',
    simulate: 'Combina ataques o desgracias y mira en el mapa qué pasaría.',
  },
  introMetrica: {
    security: 'Combinaciones de ataques con las que alguien podría gastar tus fondos, de la más barata a la más cara.',
    resilience: 'Desgracias que harían perder los fondos para siempre, o que los dejarían bloqueados un tiempo.',
    usability: 'Qué hace falta para firmar en el día a día.',
    inheritance: 'Si tus herederos podrían recuperar los fondos.',
  },
  introGuia: 'Cómo usar llave-inglesa, paso a paso. Los botones abren ejemplos y simulan en el mapa sin salir de la guía.',
  tipos: { location: 'Ubicación', person: 'Persona', device: 'Dispositivo', artifact: 'Backup', key: 'Key' },
  nombreSecciones: 'Secciones',
  errores: (n: number) => `${n} errores en el modelo`,
  avisos: (n: number) => `${n} avisos en el modelo`,
  simulacionActiva: 'Hay una simulación en el mapa',
  activa: 'activa',
  plegar: 'Plegar el panel',
  pistaPlegar: 'Plegar el panel para ver más mapa',
  via: (n: number, de: number) => `Vía ${n} de ${de}`,
  viaModificada: 'Vía modificada',
  simulacion: 'Simulación',
  guia: 'Guía',
  capitulos: 'Capítulos',
  abierto: 'abierto',
  enElMapa: 'en el mapa',

  volver: 'Volver',
  pistaVolver: 'Volver (Esc)',
  estasEn: 'Estás en',
  viaAnterior: 'Vía anterior',
  viaSiguiente: 'Vía siguiente',
};

export const banner = {
  resultado: {
    stolen: 'El atacante puede gastar tus fondos',
    safe: 'No le basta para robar',
    recoverable: 'Los fondos siguen siendo recuperables',
    lockout: 'Bloqueados hasta el fallecimiento; después, recuperables',
    lost: 'Fondos perdidos para siempre',
  },
  simulandoAtaque: 'Simulando ataque',
  simulandoDesgracia: 'Simulando desgracia',
  coaccion: 'Venciendo un PIN de coacción',
  comprometidos: ['dispositivo comprometido', 'dispositivos comprometidos'] as const,
  yAdemas: 'Y además',
  pero: 'Pero',
  veSaldo: 've tu saldo y tu historial',
  salir: 'Salir de la simulación',
  pistaSalir: 'Salir (Esc)',
};
