/**
 * Atributos de todo campo donde se escribe texto (`<input {...PRIVADO} />`): el CSP no frena lo que hace el navegador
 * por su cuenta, y el corrector mejorado de Chrome, Microsoft Editor en Edge o extensiones como Grammarly y
 * LanguageTool envían a sus servidores lo que se teclea. Tampoco se guarda en el autocompletado, ni el teclado del
 * móvil lo corrige o lo pone en mayúscula. Lo exige `privacidad.test.ts`.
 */
export const PRIVADO = {
  spellCheck: false,
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false',
  'data-lt-active': 'false',
} as const;
