import type { AttackAtom, LossEvent } from '@llave-inglesa/engine';

/**
 * La guía de uso, como datos: la web la muestra al lado del mapa (con botones que abren ejemplos y
 * simulan) y scripts/guia.ts la convierte en docs/GUIA.md. Las cifras no se escriben: se citan
 * (`{ cifra }`) y salen de guia-cifras.ts, que genera el motor; un test comprueba que está al día.
 */

export type Metrica = 'security' | 'resilience' | 'usability' | 'inheritance';

/** Un trozo de texto: texto normal, en negrita, o la puntuación de un ejemplo en una métrica. */
export type Trozo = string | { negrita: string } | { cifra: { ejemplo: string; metrica: Metrica } };

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

const CASA = 'todo-en-casa';
const PAPEL = 'r01-papel-en-casa';
const ACERO_BANCO = 'r04-acero-y-banco';
const SOLO_MEMORIA = 'r06-passphrase-solo-memoria';
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
          ': no es una cartera, no toca la red de Bitcoin ni tus fondos, y no sustituye a tu criterio. Es un modelo: las notas comparan esquemas entre sí y explican sus puntos débiles, pero las probabilidades reales dependen de tu vida. Lo que el motor no tiene en cuenta está en el capítulo de límites.',
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
          '. El mismo esquema con la tercera placa en manos de un abogado: ',
          cifra(CUSTODIO, 'inheritance'),
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
];
