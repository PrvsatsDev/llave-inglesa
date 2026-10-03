import type { AttackAtom, LossEvent } from '@llave-inglesa/engine';

/**
 * La guía de uso, como datos: la web la muestra al lado del mapa (con botones que abren ejemplos y
 * simulan) y scripts/guia.ts la convierte en docs/GUIA.md. Las cifras no se escriben: se citan
 * (`{ cifra }`) y salen de guia-cifras.ts, que genera el motor; un test comprueba que está al día.
 */

export type Metrica = 'security' | 'resilience' | 'usability' | 'inheritance';

/**
 * Un trozo de texto: texto normal, en negrita, la puntuación de un ejemplo en una métrica, un enlace
 * externo (se abre aparte) o un enlace a otro capítulo de la guía.
 */
export type Trozo =
  | string
  | { negrita: string }
  | { cifra: { ejemplo: string; metrica: Metrica } }
  | { enlace: string; texto: string }
  | { capitulo: string; texto: string };

export type Escenario = { kind: 'attack'; atoms: AttackAtom[] } | { kind: 'loss'; events: LossEvent[] };

export type Bloque =
  | { tipo: 'parrafo'; texto: Trozo[] }
  | { tipo: 'lista'; items: Trozo[][] }
  /** Recuadro destacado (una idea clave o un aviso). */
  | { tipo: 'nota'; texto: Trozo[] }
  /** Botón que abre un ejemplo. */
  | { tipo: 'ejemplo'; ejemplo: string; texto: string }
  /** Botón que abre un ejemplo (si no está abierto) y simula un escenario en el mapa. */
  | { tipo: 'simular'; ejemplo: string; escenario: Escenario; texto: string };

export interface Capitulo {
  id: string;
  titulo: string;
  /** Una línea para el índice. */
  resumen: string;
  bloques: Bloque[];
}

const cifra = (ejemplo: string, metrica: Metrica): Trozo => ({ cifra: { ejemplo, metrica } });
const n = (negrita: string): Trozo => ({ negrita });
const cap = (capitulo: string, texto: string): Trozo => ({ capitulo, texto });
const REPO = 'https://github.com/PrvsatsDev/llave-inglesa';

const CASA = 'todo-en-casa';
const PAPEL = 'r01-papel-en-casa';
const ACERO_BANCO = 'r04-acero-y-banco';
const SOLO_MEMORIA = 'r06-passphrase-solo-memoria';
const FOTO = 'r02-foto-en-la-nube';
const ACERO = 'r03-acero-en-caja-fuerte';
const COPIA_APARTE = 'r05-passphrase-copia-aparte';
const COLDCARD = 'r07-coldcard-afectada';
const TODO_EN_CASA = 'r08-2de3-todo-en-casa';
const DISTRIBUIDO = 'r09-2de3-distribuido';
const CUSTODIO = 'r10-2de3-custodio';
const SIN_HERENCIA = 'r11-2de3-sin-herencia';
const SEEDSIGNER = 'r12-2de3-seedsigner';

export const GUIA: readonly Capitulo[] = [
  {
    id: 'que-es',
    titulo: 'Qué es y qué no es',
    resumen: 'Un simulador de tu custodia: qué hace, qué no hace y por qué nunca necesita tus secretos.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'llave-inglesa es un ',
          n('simulador'),
          '. Describes cómo guardas tus bitcoins (qué keys hay, en qué dispositivos y backups, dónde está cada cosa y quién sabe qué) y la herramienta busca, con método, todas las formas en que eso puede salir mal.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          [n('Robos'), ': intrusiones, la llave inglesa, una traición, una cuenta en la nube hackeada, un fallo en el generador de números aleatorios de un fabricante…'],
          [n('Pérdidas'), ': un incendio, una inundación, perder una placa, olvidar una passphrase, fallecer o quedar incapacitado…'],
          [n('El día a día'), ': cuántos sitios tienes que visitar para firmar.'],
          [n('La herencia'), ': si tus herederos llegarían a los fondos, y qué podría impedirlo.'],
        ],
      },
      {
        tipo: 'nota',
        texto: [
          n('Nunca escribas frases semilla, claves privadas ni passphrases reales.'),
          ' No hacen falta: el modelo solo dice que una placa contiene la frase semilla de K1, nunca cuál es.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Todo ocurre en tu navegador: la aplicación no puede hacer ninguna petición de red, no hay cuentas ni telemetría. Aun sin secretos, tu esquema es un ',
          n('mapa del tesoro'),
          ' (dónde está cada copia y quién sabe cada PIN), así que guárdalo cifrado (',
          n('Archivo → Guardar en este navegador'),
          ' o ',
          n('Exportar cifrado'),
          ').',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Lo que no es'),
          ': no es una cartera, no toca la red de Bitcoin ni tus fondos, y no sustituye a tu criterio. Es un modelo: las notas comparan esquemas entre sí y explican sus puntos débiles, pero las probabilidades reales dependen de tu vida. Lo que el motor no tiene en cuenta está en ',
          cap('limites', 'Límites conocidos'),
          '.',
        ],
      },
    ],
  },
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    resumen: 'Cinco minutos con un ejemplo: las cuatro notas, el mapa y tu primera simulación.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Empieza con un esquema ya montado: un multisig 2 de 3 en el que casi todo está en casa. Es cómodo, y justo por eso tiene puntos débiles que se ven enseguida.',
        ],
      },
      { tipo: 'ejemplo', ejemplo: CASA, texto: 'Abrir «Todo a mano en casa»' },
      {
        tipo: 'parrafo',
        texto: [n('Las cuatro notas'), ', arriba en esta columna, resumen el esquema de 0 a 100:'],
      },
      {
        tipo: 'lista',
        items: [
          [n('Seguridad'), ' (', cifra(CASA, 'security'), '): lo que le cuesta a un atacante robarte por la vía más barata.'],
          [n('Resiliencia'), ' (', cifra(CASA, 'resilience'), '): lo improbable que es perderlo todo por desgracias (un incendio, perder una placa, olvidar algo…).'],
          [n('Usabilidad'), ' (', cifra(CASA, 'usability'), '): a cuántos sitios tienes que ir para firmar.'],
          [n('Herencia'), ' (', cifra(CASA, 'inheritance'), '): si tus herederos llegarían a los fondos, y lo frágil que es ese camino.'],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Más adelante, fuera de la guía, puedes pulsar cualquier nota para ver de dónde sale: la base, lo que se le resta y, plegado, cómo se calcula. Si sales, ',
          n('Archivo → Guía de uso'),
          ' te devuelve a este mismo punto.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('El mapa'),
          ' tiene arriba las ubicaciones, con lo que hay en cada una (dispositivos y backups) y las keys que guardan (K1, K2, K3). Abajo, las personas con lo que saben de memoria. Las líneas dicen quién puede entrar dónde; las discontinuas, solo tras un fallecimiento.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [n('Tu primera simulación'), ': ¿cuál es la forma más barata de robar este esquema?'],
      },
      {
        tipo: 'simular',
        ejemplo: CASA,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'Simular una llave inglesa a Yo en Casa',
      },
      {
        tipo: 'parrafo',
        texto: [
          'En rojo, lo que usa el atacante: obligado a dar el PIN, Yo desbloquea la Coldcard (K1), y la placa de K2 está en el mismo sitio. Dos de tres: puede gastar. Es una sola acción, y por eso la seguridad se queda en ',
          cifra(CASA, 'security'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'La pestaña ',
          n('Simular'),
          ' explica siempre ',
          n('por qué'),
          ': cada firma, cada secreto y de dónde lo saca el atacante.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: ['Ahora una desgracia: un incendio en casa.'],
      },
      {
        tipo: 'simular',
        ejemplo: CASA,
        escenario: { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }] },
        texto: 'Simular un incendio en Casa',
      },
      {
        tipo: 'parrafo',
        texto: [
          'La placa de acero de K2 resiste y, con la de K1 del banco, se recupera todo. Pulsa ',
          n('¿Y si no resiste?'),
          ' junto a la placa para ver qué pasaría si también se perdiera.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Ya has visto lo esencial. A partir de aquí puedes cambiar cualquier cosa del esquema y ver cómo se mueven las notas, o montar el tuyo desde ',
          n('Archivo → Nuevo esquema'),
          '.',
        ],
      },
    ],
  },
  {
    id: 'notas',
    titulo: 'Cómo se leen las notas',
    resumen: 'Qué mide cada una de las cuatro puntuaciones, con ejemplos que se mueven de un extremo a otro.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Cada nota va de 0 a 100 y se lee en cinco bandas: ',
          n('muy mal'),
          ' (menos de 25), ',
          n('flojo'),
          ' (hasta 50), ',
          n('aceptable'),
          ' (hasta 70), ',
          n('bueno'),
          ' (hasta 85) y ',
          n('excelente'),
          '. Los pesos exactos de cada cálculo están en el análisis de cada nota, en «Cómo se calcula».',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Seguridad'),
          ': lo que le cuesta al atacante la vía de robo más barata. Cada ataque tiene un esfuerzo (entrar en una casa cuesta poco; la llave inglesa, bastante más) y una vía puede combinar varios. Si hay otras vías casi igual de baratas, resta un poco: más puertas para el ladrón.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: PAPEL,
        escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] },
        texto: 'Papel en el cajón: basta con entrar en casa',
      },
      {
        tipo: 'parrafo',
        texto: ['Con la frase semilla en un papel en casa, un ladrón cualquiera se la lleva: seguridad ', cifra(PAPEL, 'security'), '.'],
      },
      {
        tipo: 'simular',
        ejemplo: SOLO_MEMORIA,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'Passphrase solo en la memoria: hace falta la llave inglesa',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Si además de la placa hace falta una passphrase que solo sabes tú, ya no basta con entrar: hay que obligarte a hablar. Seguridad ',
          cifra(SOLO_MEMORIA, 'security'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Resiliencia'),
          ': lo improbable que es perderlo todo para siempre. Cada desgracia tiene una rareza (olvidar algo es corriente; un incendio, mucho menos) y las que tienen que coincidir se suman. Manda la pérdida más probable; las demás restan algo.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: SOLO_MEMORIA,
        escenario: { kind: 'loss', events: [{ type: 'forget', person: 'yo' }] },
        texto: 'El mismo esquema, si olvidas la passphrase',
      },
      {
        tipo: 'parrafo',
        texto: [
          'La passphrase que te protegía del ladrón es también tu punto débil: olvidarla lo pierde todo. Resiliencia ',
          cifra(SOLO_MEMORIA, 'resilience'),
          '. Con dos placas de acero, una en casa y otra en el banco, sube a ',
          cifra(ACERO_BANCO, 'resilience'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Usabilidad'),
          ': a cuántos sitios tienes que ir para firmar de forma segura, con tus dispositivos. Un sitio y lo que tiene dentro (casa y su caja fuerte) cuentan como una visita.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          ['2 de 3 con los tres dispositivos en casa: una visita, usabilidad ', cifra(DISTRIBUIDO, 'usability'), '.'],
          [
            '2 de 3 con una sola SeedSigner y sin dispositivos que guarden keys: para firmar hay que ir a buscar las placas, también al banco. Usabilidad ',
            cifra(SEEDSIGNER, 'usability'),
            '.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Herencia'),
          ': si, tras tu fallecimiento, tus herederos pueden recuperar los fondos y a cuántos sitios tendrían que ir; menos lo frágil que es ese camino (que se pierda la única copia a su alcance, que fallezca también el heredero…).',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: SIN_HERENCIA,
        escenario: { kind: 'loss', events: [{ type: 'death', person: 'yo' }] },
        texto: '2 de 3 sin plan de herencia: tu fallecimiento',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Un multisig impecable para ti puede ser inútil para tu familia: si tu pareja no puede entrar ni en el banco ni en casa de tus padres, no heredaría nada. Herencia ',
          cifra(SIN_HERENCIA, 'inheritance'),
          '. El mismo esquema, con tu pareja pudiendo entrar en el banco y en casa de tus padres tras tu fallecimiento: ',
          cifra(DISTRIBUIDO, 'inheritance'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          n('No existe el 100 en todo.'),
          ' Firmar en un solo sitio choca con la llave inglesa; que tus herederos lo tengan fácil choca con que lo tenga fácil un ladrón; cada copia de más es otra puerta. Busca ser bueno en todo y elige qué sacrificas.',
        ],
      },
    ],
  },
  {
    id: 'simular',
    titulo: 'Simular',
    resumen: 'Probar ataques y desgracias, combinarlos y leer en el mapa qué pasaría y por qué.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'La pestaña ',
          n('Simular'),
          ' prueba cualquier suceso sobre el mapa: empieza con un ataque o una desgracia y añade otros con ',
          n('Añadir otro suceso a la vez'),
          '. En rojo, lo que usa el atacante; en verde, lo que usan los tuyos para recuperar los fondos. Lo que solo está al alcance, sin hacer falta, queda en tono suave.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Las desgracias suelen hacer daño ',
          n('combinadas'),
          '. Con dos placas y el dispositivo, ninguna pérdida suelta basta; estas tres juntas, sí:',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: ACERO_BANCO,
        escenario: {
          kind: 'loss',
          events: [
            { type: 'forget', person: 'yo' },
            { type: 'item-loss', item: 'nuevo-backup' },
            { type: 'item-loss', item: 'nuevo-backup-2' },
          ],
        },
        texto: 'Olvidar el PIN y perder las dos placas',
      },
      {
        tipo: 'parrafo',
        texto: [
          'El Trezor sigue en casa, pero sin su PIN no firma; y sin ninguna de las dos placas no queda copia. Prueba a quitar un suceso (✕ en el panel) y mira cómo vuelve a ser recuperable.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'No todos los robos necesitan a una persona. En un 2 de 3 en el que las tres frases semilla pasan por la misma SeedSigner, la vía más barata es un firmware malicioso de su fabricante, que filtraría las semillas al firmar:',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: SEEDSIGNER,
        escenario: { kind: 'attack', atoms: [{ type: 'malicious-firmware', vendor: 'SeedSigner' }] },
        texto: 'Simular un firmware malicioso en la SeedSigner',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Por eso conviene que cada key pase por dispositivos distintos, o que tengan ',
          n('anti-exfil'),
          ', que impide esa filtración. La seguridad de este esquema se queda en ',
          cifra(SEEDSIGNER, 'security'),
          '.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          [n('Desde el análisis'), ': cada vía de las listas se puede pulsar para simularla, y ‹ › recorren las demás.'],
          [n('¿Y si se pierde?'), ': al simular una desgracia, lo que usa la recuperación lleva este atajo para añadir también su pérdida.'],
          [n('Por qué'), ': debajo del resultado, el árbol de cada firma y cada secreto, y de dónde sale.'],
          [n('Privacidad'), ': si el atacante consigue todas las xpubs (por ejemplo, del descriptor), se avisa de que vería tu saldo y tus movimientos aunque no pueda gastar.'],
        ],
      },
      {
        tipo: 'nota',
        texto: ['Para quitar la simulación del mapa, pulsa la ✕ de su recuadro.'],
      },
    ],
  },
  {
    id: 'casos',
    titulo: 'Casos guiados',
    resumen: 'De la frase semilla en un papel a un multisig distribuido: qué falla en cada paso y qué lo arregla.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Doce esquemas típicos, de lo más habitual a lo más cuidado. Están todos en el selector de arriba, en la galería. Cada paso arregla algo del anterior… y casi siempre empeora otra cosa.',
        ],
      },
      { tipo: 'parrafo', texto: [n('1. Papel en el cajón.'), ' Un Trezor en casa y la frase semilla en un papel, en el mismo sitio.'] },
      {
        tipo: 'simular',
        ejemplo: PAPEL,
        escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] },
        texto: 'Una intrusión en casa',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Quien entre se lleva el papel, y con él todo: seguridad ',
          cifra(PAPEL, 'security'),
          '. Y un incendio quema a la vez el papel y el Trezor: resiliencia ',
          cifra(PAPEL, 'resilience'),
          '.',
        ],
      },
      { tipo: 'parrafo', texto: [n('2. Foto en la nube.'), ' En vez de papel, una foto de la frase semilla en iCloud, sin cifrar. El error clásico.'] },
      {
        tipo: 'simular',
        ejemplo: FOTO,
        escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'nueva-ubicacion' }] },
        texto: 'Un hackeo de la cuenta de iCloud',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Ni siquiera hace falta ir a tu casa: se hace en remoto y a escala. Seguridad ',
          cifra(FOTO, 'security'),
          '; y como tu pareja ni entra en tu iCloud ni sabe el PIN, herencia ',
          cifra(FOTO, 'inheritance'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [n('3. Acero en la caja fuerte.'), ' La frase semilla en una placa de acero, dentro de la caja fuerte de casa.'],
      },
      {
        tipo: 'simular',
        ejemplo: ACERO,
        escenario: { kind: 'attack', atoms: [{ type: 'insider', person: 'nueva-persona' }] },
        texto: 'Una traición de quien entra en la caja fuerte',
      },
      {
        tipo: 'parrafo',
        texto: [
          'El acero resiste el fuego y la caja fuerte frena al ladrón, pero quien conoce la caja (tu pareja, aquí) puede abrirla, y forzarla tampoco es imposible. Seguridad ',
          cifra(ACERO, 'security'),
          ', resiliencia ',
          cifra(ACERO, 'resilience'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('4. Una segunda placa en el banco.'),
          ' Ahora una sola desgracia ya no basta: resiliencia ',
          cifra(ACERO_BANCO, 'resilience'),
          ' y herencia ',
          cifra(ACERO_BANCO, 'inheritance'),
          '. La seguridad no cambia (',
          cifra(ACERO_BANCO, 'security'),
          '): el robo más barato sigue estando en casa.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('5. Una passphrase.'),
          ' Con ella, la frase semilla sola ya no sirve: hay que obligarte a decirla, o encontrar también su copia. Con la passphrase apuntada en casa de tus padres, seguridad ',
          cifra(COPIA_APARTE, 'security'),
          ', pero resiliencia ',
          cifra(COPIA_APARTE, 'resilience'),
          ': ahora hay dos cosas que no puedes perder. Si solo la sabes tú, la resiliencia cae a ',
          cifra(SOLO_MEMORIA, 'resilience'),
          ' y la herencia a ',
          cifra(SOLO_MEMORIA, 'inheritance'),
          '.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: COPIA_APARTE,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'Con passphrase: lo más barato ya es la llave inglesa',
      },
      {
        tipo: 'parrafo',
        texto: [
          n('6. Una Coldcard afectada.'),
          ' Como el paso 3, pero la frase semilla se generó sin dados en una Coldcard Q con el firmware del fallo de entropía de 2026: se puede adivinar desde cualquier parte.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: COLDCARD,
        escenario: { kind: 'attack', atoms: [{ type: 'known-weak-entropy', advisory: 'coldcard-rng-2026' }] },
        texto: 'Adivinar la semilla por el fallo publicado',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Seguridad ',
          cifra(COLDCARD, 'security'),
          ': da igual lo bien guardada que esté. Actualizar el firmware no la arregla; hay que mover los fondos a una frase semilla nueva. Lo evitan los dados (tiradas suficientes, mezcladas al generarla) o una passphrase.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'Mezclar dados con el generador del dispositivo protege de sus fallos, pero normalmente no se puede verificar: la parte del dispositivo es secreta. Para poder verificar, genera la frase semilla solo con tu entropía (dados o moneda) y recalcúlala en otra herramienta.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('7. Multisig 2 de 3, todo en casa.'),
          ' Tres dispositivos y tres placas, pero todo en el mismo sitio: quien llega a casa (o tu pareja) lo tiene todo. Seguridad ',
          cifra(TODO_EN_CASA, 'security'),
          ', resiliencia ',
          cifra(TODO_EN_CASA, 'resilience'),
          '. Un multisig sin distribuir se parece mucho a un single-sig.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('8. 2 de 3 distribuido.'),
          ' Los dispositivos en casa y cada placa en un sitio distinto (caja fuerte, banco y casa de tus padres), con su descriptor. Ya ningún sitio basta por sí solo, y lo más barato es obligarte a ti a firmar en casa.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: DISTRIBUIDO,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'El robo más barato del 2 de 3 distribuido',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Seguridad ',
          cifra(DISTRIBUIDO, 'security'),
          ', resiliencia ',
          cifra(DISTRIBUIDO, 'resilience'),
          ', usabilidad ',
          cifra(DISTRIBUIDO, 'usability'),
          ', herencia ',
          cifra(DISTRIBUIDO, 'inheritance'),
          ': bueno en todo. Es el esquema «de manual».',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('9. Sin plan de herencia.'),
          ' El mismo, pero tu pareja no puede entrar ni en el banco ni en casa de tus padres: herencia ',
          cifra(SIN_HERENCIA, 'inheritance'),
          '. Que los herederos puedan llegar es parte del diseño, no un añadido.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('10. Con custodio.'),
          ' La tercera placa la guarda un abogado en su despacho. Con una sola key no puede robar, y su copia aleja más las desgracias: resiliencia ',
          cifra(CUSTODIO, 'resilience'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'Nada de esto es «la respuesta»: es un mapa de compromisos. Abre el que se parezca al tuyo, cambia una cosa cada vez y mira qué nota sube y cuál baja.',
        ],
      },
    ],
  },
  {
    id: 'montar',
    titulo: 'Montar tu esquema',
    resumen: 'De un esquema en blanco al tuyo: keys, ubicaciones, dispositivos, backups, personas y guardarlo cifrado.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Empieza con ',
          n('Archivo → Nuevo esquema'),
          ' o, mejor, abre el ejemplo que más se parezca al tuyo y cámbialo. Todo se edita en la pestaña ',
          n('Esquema'),
          ' o pulsando cualquier elemento del mapa; Ctrl+Z deshace.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          [
            n('Política'),
            ': cuántas keys hacen falta para gastar (1 de 1, 2 de 3…). ',
            n('+ Key'),
            ' añade otra. En cada key: si lleva passphrase y cómo es (nunca cuál), y su procedencia: con qué entropía y en qué dispositivo se generó. Ahí se detectan los fallos de entropía publicados.',
          ],
          [
            n('Ubicaciones'),
            ': casa, banco, una nube, un portátil… Las físicas pueden ser caja fuerte o caja del banco, y estar dentro de otra (la caja fuerte dentro de casa). En cada una, quién puede entrar: siempre, solo tras el fallecimiento de alguien, o si queda incapacitado.',
          ],
          [
            n('Dispositivos y backups'),
            ': con el + de cada ubicación. En los dispositivos, el modelo (del catálogo: rellena lo que sabe y avisa de fallos conocidos), el firmware, qué keys guarda, el PIN y si tiene PIN de coacción. En los backups, el soporte (papel, acero…) y qué contienen: la frase semilla de una key, una passphrase, un PIN, el descriptor…',
          ],
          [
            n('Personas'),
            ': titular, heredero, custodio… y qué saben de memoria (un PIN, una passphrase). Lo que sabe alguien puede revelarlo bajo coacción, y se pierde si lo olvida, fallece o queda incapacitado.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Arriba de la pestaña Esquema aparecen los ',
          n('avisos'),
          ': cosas que probablemente no quieres, como un dispositivo con un PIN que nadie sabe (no serviría para firmar) o una passphrase sin indicar cómo es (se trata como débil).',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          n('Guárdalo cifrado.'),
          ' Ctrl+S lo guarda en este navegador con una contraseña; ',
          n('Exportar cifrado'),
          ' lo descarga como fichero .llave. Exportar sin cifrar (.json) es solo para trabajar con él: bórralo después.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'No hace falta que sea perfecto a la primera: monta lo esencial, mira las notas y prueba variantes (mover una placa al banco, añadir una passphrase, cambiar quién entra dónde). Las notas se recalculan al momento.',
        ],
      },
    ],
  },
  {
    id: 'conceptos',
    titulo: 'Conceptos',
    resumen: 'Las palabras que usa la herramienta, en una línea cada una.',
    bloques: [
      {
        tipo: 'lista',
        items: [
          [n('Key'), ': cada una de las claves que pueden firmar (K1, K2…). Su ', n('frase semilla'), ' son las palabras que la recuperan.'],
          [n('Passphrase'), ': una palabra o frase extra que, junto a la frase semilla, da otra key. Sin ella, la frase semilla sola no firma.'],
          [n('Multisig k de n'), ': hacen falta k firmas de n keys. Para gastar también hacen falta las ', n('xpubs'), ' de todas las keys, que suelen ir juntas en el ', n('descriptor'), '.'],
          [n('Dispositivo stateful'), ': guarda la key dentro (Coldcard, Trezor…). ', n('Stateless'), ': no guarda nada; se le carga la frase semilla para cada firma (SeedSigner…).'],
          [n('PIN de coacción'), ': un segundo PIN que, bajo amenaza, abre una cartera señuelo o borra el dispositivo. Encarece la llave inglesa, pero no la evita.'],
          [n('Anti-exfil'), ': protección de algunos dispositivos que impide que un firmware malicioso filtre la semilla dentro de las firmas.'],
          [n('Llave inglesa'), ': obligar a alguien por la fuerza a firmar o a revelar lo que sabe. Da nombre a la herramienta.'],
          [n('Esfuerzo'), ': lo que le cuesta un ataque al atacante (riesgo, tiempo, dinero). Los de una misma vía se suman.'],
          [n('Rareza'), ': lo improbable que es una desgracia, en órdenes de magnitud. Las que tienen que coincidir se suman.'],
          [n('Bloqueo temporal'), ': los fondos quedan inmovilizados mientras alguien está incapacitado, pero se recuperan cuando heredan.'],
          [n('Custodio'), ': alguien de confianza que guarda algo (una placa, un descriptor) sin ser titular ni heredero.'],
          [n('Entropía'), ': el azar con el que se genera la frase semilla (el generador del dispositivo, dados, una moneda…). ', n('Verificar'), ' es recalcularla en otra herramienta para comprobar que sale de ese azar.'],
        ],
      },
    ],
  },
  {
    id: 'limites',
    titulo: 'Límites conocidos',
    resumen: 'Lo que el motor simplifica o no tiene en cuenta, para leer las notas con criterio.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: ['Un modelo siempre simplifica. Estos son los atajos conscientes de llave-inglesa:'],
      },
      {
        tipo: 'lista',
        items: [
          ['Las rarezas y los esfuerzos son estimaciones de orden de magnitud, iguales para todos: no dependen de tu edad, tu zona o tu casa. Las desgracias se tratan como independientes.'],
          ['Se buscan combinaciones de hasta tres ataques o desgracias a la vez.'],
          ['La seguridad mira el robo más barato y los casi igual de baratos: endurecer una vía más cara no mueve la nota.'],
          ['La fortaleza de una passphrase son tres niveles aproximados (débil, frase, aleatoria larga); no se mide su entropía.'],
          ['El metal se supone acero: una placa de aluminio o latón no resistiría un incendio. Tampoco se distinguen una bolsa estanca o una caja fuerte ignífuga.'],
          ['La protección son tres niveles (ninguna, caja fuerte, caja del banco), sin distinguir la calidad de la caja ni alarmas. Las ubicaciones se anidan un solo nivel.'],
          ['No se sabe dónde vive cada persona: la llave inglesa puede hacerse en cualquier sitio al que la víctima tenga acceso. Coaccionar a dos personas a la vez cuenta como dos ataques.'],
          ['No se modela el ordenador o el móvil con el que se firma: los fallos explotables desde un ordenador con malware solo se avisan.'],
          ['El catálogo de dispositivos y sus fallos conocidos no se actualiza solo: cada versión lleva el suyo, con su fecha.'],
          ['Todavía no hay timelocks (herencia con espera, claves de recuperación con retraso).'],
          ['Con muchos dispositivos y ubicaciones el análisis tarda unos segundos: es exhaustivo.'],
        ],
      },
    ],
  },
  {
    id: 'verificar',
    titulo: 'Privacidad y verificación',
    resumen: 'Qué sale de tu equipo (nada), cómo se guarda tu esquema y cómo comprobar que la app es la que dice ser.',
    bloques: [
      {
        tipo: 'lista',
        items: [
          [n('Sin red'), ': la política de seguridad del contenido de la página prohíbe cualquier petición. No hay cuentas, ni analítica, ni recursos de terceros.'],
          [
            n('Cifrado'),
            ': tu esquema se guarda en el navegador o en un fichero .llave cifrado con AES-256-GCM y una clave que sale de tu contraseña (PBKDF2). Sin la contraseña no hay forma de abrirlo, ni para ti.',
          ],
          [n('Sin conexión'), ': cada versión se publica también como zip para usarla en tu equipo sin internet.'],
          [
            n('Verificable'),
            ': el código es abierto y el build es reproducible. Recompilando una versión se obtienen exactamente los mismos ficheros que se publican, y se puede comparar con la web fichero a fichero.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Cómo hacerlo, paso a paso: ',
          { enlace: `${REPO}/blob/main/docs/VERIFICAR.md`, texto: 'Verificar llave-inglesa' },
          '. El código y las versiones: ',
          { enlace: REPO, texto: 'GitHub' },
          '.',
        ],
      },
    ],
  },
];
