# Calibración: galería de esquemas de referencia

Doce esquemas típicos, de muy malos a muy buenos. Para cada uno dejamos escrito **qué esperamos**
antes de mirar lo que dice el motor: el orden entre esquemas y una banda aproximada por métrica.
Después se comparan con las notas reales, y lo que no cuadre se discute y se ajusta en
`packages/engine/src/score.ts`. Cuando quede acordado, el orden pasa a ser un test.

**Cómo se construyen.** El usuario monta cada esquema a mano en la web siguiendo su descripción y lo
exporta con *Exportar JSON*; el fichero se guarda en `fixtures/referencia/` con el nombre del
esquema (p. ej. `r01-papel-en-casa.json`). Las dudas o fricciones al montarlo se apuntan al final de
este documento: también son resultados de la calibración.

## Convenciones (salvo que el esquema diga otra cosa)

- **Personas**: *Yo* (titular) y *Pareja* (heredera). Pareja no sabe ningún PIN ni passphrase.
- **Keys**: cada una generada en su propio dispositivo con el firmware actual, mezclando **99 dados**
  (así la entropía no influye, salvo en R07).
- **Dispositivos**: con **PIN**, que solo sabe Yo; sin PIN de coacción.
- **Casa**: entran Yo y Pareja, siempre.
- **Caja fuerte**: protección *caja fuerte*, **dentro de Casa**; entran Yo y Pareja.
- **Caja del banco**: protección *caja del banco*; entra Yo siempre, y Pareja *tras fallecer Yo*.
- **Casa de mis padres**: entra Yo siempre, y Pareja *tras fallecer Yo*.
- **Multisig**: 2 de 3, con los dispositivos con el **multisig registrado** y un **descriptor en papel**
  junto a cada placa.

## Los esquemas

### Single-sig

**R01 · Papel en el cajón.** Trezor Safe 5 con K1 en Casa. La semilla de K1, en **papel** en Casa.
*Lo más habitual al empezar.*

**R02 · Foto en la nube.** Trezor Safe 5 con K1 en Casa. La semilla de K1, en **digital** (una foto)
en una ubicación de tipo **nube** "iCloud", sin cifrar, a la que entra Yo. No hay papel.
*El error clásico.*

**R03 · Acero en la caja fuerte.** Como R01, pero la semilla en una **placa de acero** dentro de la
**Caja fuerte**. *Un single-sig hecho con cuidado.*

**R04 · Acero en casa y copia en el banco.** R03 y además una **segunda placa** de K1 en la **Caja del
banco**. *Redundancia geográfica.*

**R05 · Passphrase con copia aparte.** R03, y K1 con **passphrase de tipo frase**: Yo la sabe de memoria
y está apuntada en **papel** en **Casa de mis padres**. *La semilla sola ya no basta.*

**R06 · Passphrase solo en la memoria.** R03, y K1 con **passphrase aleatoria larga** que solo sabe Yo,
sin apuntar en ningún sitio. *Muy seguro, y frágil.*

**R07 · Coldcard afectada.** Como R03, pero el dispositivo es una **Coldcard Q con firmware 1.2.0**,
y K1 se generó con ella **sin dados**. *El fallo de entropía de 2026.*

### Multisig 2 de 3

**R08 · 2 de 3 todo en casa.** Coldcard Q (K1), BitBox02 (K2) y Jade (K3) en Casa. Las tres placas
de acero en la Caja fuerte; un descriptor en papel en Casa. *Multisig sin distribuir.*

**R09 · 2 de 3 distribuido.** Los tres dispositivos en Casa. Placa K1 en la Caja fuerte, placa K2 en
la Caja del banco, placa K3 en Casa de mis padres, cada una con su descriptor. *El esquema "de manual".*

**R10 · 2 de 3 con custodio.** Como R09, pero la placa K3 (con su descriptor) está en el **Despacho del
abogado**, al que entra siempre una persona *Abogado* con papel **custodio**, y no en casa de los
padres. *Un tercero de confianza.*

**R11 · 2 de 3 sin plan de herencia.** Como R09, pero Pareja **no tiene acceso** ni a la Caja del banco
ni a Casa de mis padres. *Seguro para el titular, inútil para los herederos.*

**R12 · 2 de 3 con una SeedSigner.** Sin dispositivos con estado: una única **SeedSigner** en Casa con
la que se firman las tres keys, cargando la semilla. Placas como en R09. *Todo pasa por un mismo
aparato.*

## Lo que esperamos

### Orden

Dentro de cada métrica, `A < B` significa "A debe puntuar menos que B" y `A ≈ B`, "parecido
(±5)".

**Seguridad**
- R07 < R02 < R01 < R03 ≈ R04 < R05 < R06
- R08 < R09; R12 < R09; R10 ≈ R09 ≈ R11; R05 ≈ R09 (ver R09 en *Revisado*)
- R03 < R09: un multisig bien distribuido es más seguro que el mejor single-sig sin passphrase.

**Resiliencia**
- R06 < R03 < R04: olvidar la única copia de la passphrase es lo más probable de todo.
- R01 < R03: el papel no resiste un incendio; el acero sí.
- R05 < R03: la passphrase añade algo más que se puede perder.
- R08 < R09 ≈ R10; R11 < R09: sin acceso de Pareja, el fallecimiento del titular lo pierde todo.

**Usabilidad**
- R01 = R03 = R09: todo lo necesario para firmar está en casa.
- R12 < R09: para firmar con la SeedSigner hay que ir a buscar las placas.

**Herencia**
- R02, R06 y R11 no se pueden heredar (en R02, Pareja no entra en iCloud ni sabe el PIN).
- R05 < R01 < R03 < R04 (tras el ajuste 2): papel < acero < dos placas; en R05 el papel de la
  passphrase es otro punto único para Pareja.

### Bandas

Bandas: **muy mal** < 25 · **flojo** 25–50 · **aceptable** 50–70 · **bueno** 70–85 · **excelente** > 85.

| Esquema | Seguridad | Resiliencia | Usabilidad | Herencia |
|---|---|---|---|---|
| R01 Papel en el cajón | muy mal / flojo | flojo | excelente | bueno ¹ |
| R02 Foto en la nube | muy mal | flojo | excelente | muy mal |
| R03 Acero en la caja fuerte | aceptable | aceptable | excelente | bueno ¹ |
| R04 Acero + copia en el banco | aceptable | bueno | excelente | bueno ¹ |
| R05 Passphrase con copia aparte | bueno | flojo ¹ | excelente | aceptable ¹ |
| R06 Passphrase solo en la memoria | bueno | flojo ¹ | excelente | muy mal |
| R07 Coldcard afectada | muy mal | aceptable | excelente | bueno ¹ |
| R08 2 de 3 todo en casa | aceptable | aceptable | excelente | bueno ¹ |
| R09 2 de 3 distribuido | bueno | bueno | excelente | bueno |
| R10 2 de 3 con custodio | bueno | bueno | excelente | bueno |
| R11 2 de 3 sin plan de herencia | bueno | aceptable | excelente | muy mal |
| R12 2 de 3 con una SeedSigner | aceptable | aceptable ¹ | bueno | bueno |

¹ Revisadas en el diagnóstico conjunto, tras ver los resultados: en todas, el motor acierta y la banda
era optimista. Herencia: desde el ajuste 2 descuenta la fragilidad del camino de los herederos, y con
**un solo heredero no pasa de ~84** (su fallecimiento, rareza 2, siempre resta al menos 16): *excelente*
exige dos herederos o más. Resiliencia: en R05 la passphrase es un segundo secreto que se puede perder;
en R06 basta con olvidarla (en el borde de muy mal); en R12 las placas son la única copia.

Las bandas son un test (`packages/engine/test/calibracion.test.ts`): cada esquema de la galería debe
caer en la suya en las cuatro métricas.

## Resultados

Notas actuales del motor (Seguridad · Resiliencia · Usabilidad · Herencia). ✓ = dentro de la banda
esperada, ✗ = fuera. Se recalculan todas cada vez que cambia `score.ts`; la última columna dice qué
ajuste las movió.

| Esquema | Seg | Res | Usa | Her | Último cambio |
|---|---|---|---|---|---|
| R01 Papel en el cajón | 35 ✓ | 41 ✓ | 100 ✓ | 70 ✓ | ajuste 2 (Her 100 → 70) |
| R02 Foto en la nube | 23 ✓ | 41 ✓ | 100 ✓ | 0 ✓ | ajuste 1 (Res 34 → 41) |
| R03 Acero en la caja fuerte | 51 ✓ | 61 ✓ | 100 ✓ | 76 ✓ | ajuste 3 (Seg 49 → 51) |
| R04 Acero + copia en el banco | 51 ✓ | 77 ✓ | 100 ✓ | 82 ✓ | ajuste 3 (Seg 49 → 51) |
| R05 Passphrase con copia aparte | 71 ✓ | 45 ✓ | 100 ✓ | 59 ✓ | ajuste 3 (Seg 65 → 71) |
| R06 Passphrase solo en la memoria | 73 ✓ | 28 ✓ | 100 ✓ | 0 ✓ | ajuste 3 (Seg 65 → 73) |
| R07 Coldcard afectada | 12 ✓ | 61 ✓ | 100 ✓ | 76 ✓ | — |
| R08 2 de 3 todo en casa | 53 ✓ | 65 ✓ | 100 ✓ | 78 ✓ | ajuste 3 (Seg 49 → 53) |
| R09 2 de 3 distribuido | 71 ✓ | 72 ✓ | 100 ✓ | 72 ✓ | ajuste 3 (Seg 65 → 71) |
| R10 2 de 3 con custodio | 71 ✓ | 75 ✓ | 100 ✓ | 72 ✓ | — |
| R11 2 de 3 sin plan de herencia | 71 ✓ | 56 ✓ | 100 ✓ | 0 ✓ | — |
| R12 2 de 3 con una SeedSigner | 65 ✓ | 62 ✓ | 75 ✓ | 72 ✓ | — |

### Ajustes de `score.ts`

- **Ajuste 0** (tras R02): el hackeo de una nube cuesta 1 (antes, como una intrusión: 1,5).
- **Ajuste 1** (tras R05): la llave inglesa a Yo en casa era lo más barato en casi todo, y la
  resiliencia castigaba demasiado "dos descuidos a la vez".
  - Llave inglesa 2 → **3** (en la caja del banco, 4). Puede que suba a 3,5: lo dirán R08–R12.
  - Traición 1,5 → **2,5**.
  - Cada **sitio físico más** que haya que asaltar en un mismo robo, **+1**. Sin esto, con la llave
    inglesa cara, robar en dos casas (1,5 + 1,5) igualaba un multisig distribuido con tenerlo todo en casa.
  - Vías casi igual de baratas: −4 por vía (máx. −12) → **−2 (máx. −6)**.
  - Curva de resiliencia: rareza 1 → 30 · **2 → 60** · 3 → 75 · 4 → 85 (antes 25 · 50 · 70 · 85).
  - Bloqueo temporal: −10 / −5 → **−5 / −2**.
- **Ajuste 2** (tras R05): herencia daba 100 a casi todo, aunque el camino de los herederos fuera
  frágil (en R01, perder el papel basta). Ahora es la facilidad de siempre **menos la fragilidad** de
  ese camino: se da por hecho el fallecimiento (es seguro) y se buscan las desgracias que, además,
  dejan a los herederos sin los fondos; su robustez se puntúa como la resiliencia y se resta
  **0,4 × lo que le falta para 100** (como mucho −40). Se descartó restar la resiliencia del titular:
  sus desgracias no son las de los herederos (p. ej., copias a las que solo llega el titular).
- **Ajuste 3** (tras R09): llave inglesa 3 → **3,5** (en la caja del banco, 4,5). En R09 la única vía
  barata era la llave inglesa y daba 65, lejos de la *Referencia fija* (≈ 75). Con 3,5 todas las
  seguridades entran en su banda y aparece R05 < R06. Se
  descartó subir además la curva (esfuerzo 3 → 75): daría 75 a cualquier ataque sofisticado de
  esfuerzo 3, como el firmware de una SeedSigner que firma todas las keys.

## Por dónde vamos

Hecho: la galería completa (R01–R12), los ajustes 1, 2 y 3 y las bandas revisadas (paso 1 del
diagnóstico). Siguiente: **paso 2**, pendientes del motor; después, **paso 3**, las fricciones.

**Referencia fija**: un esquema cuya única vía de robo es la llave inglesa debería rondar **75 o más**
(con el ajuste 3, R06 da 73). Al terminar la galería: diagnóstico de todo junto,
ajustes en `score.ts` (la llave inglesa debería castigar menos) y arreglar las fricciones.

## Revisado con el motor

- **R01** (23 · 34 · 100 · 100): el usuario ve bien el 23: un papel a la vista en casa es muy mala
  custodia. Pendiente para más adelante: la traición de Pareja pesa igual (1,5) que una intrusión.
- **R02** (27 → 23 · 34 · 100 · 0): salía más seguro que R01 porque el hackeo de iCloud costaba lo
  mismo que una intrusión (1,5) y Pareja no puede traicionar. Ahora el hackeo de una nube cuesta **1**
  (remoto, sin riesgo, a escala). R02 ≈ R01 en vez de R02 < R01: papel a la vista y foto en la nube,
  igual de malos por motivos distintos. Pendiente: la llave inglesa a la misma persona cuenta como una
  vía por cada ubicación (en R02, dos), lo que infla la penalización por varias vías baratas.
- **R03** (27 · 51 · 100 · 100): seguridad muy por debajo de lo esperado (aceptable). El robo más
  barato es la traición de Pareja (1,5, porque entra en la caja fuerte), seguido de la llave inglesa a
  Yo o a Pareja (2). Ni subiendo traición y llave inglesa a 3 pasa de 43: la caja fuerte (2,5) es el
  techo, y la penalización por vías casi igual de baratas resta 12 (hasta el firmware malicioso, 3,
  entra en el margen). Se deja para el diagnóstico conjunto: los pesos de traición, llave inglesa y
  la penalización por varias vías mueven todos los esquemas.
- **R04** (27 · 70 · 100 · 100): todo como se esperaba salvo la seguridad, que es la de R03 (la caja
  del banco no abre vías baratas: intrusión 3,5, llave inglesa allí 3). La segunda placa sube la
  resiliencia de 51 a 70: lo más probable ya es que fallezcan Yo y Pareja, o perder las dos placas y
  el Trezor o el PIN (rareza 4).
- **R05** (45 · 31 · 100 · 90 → ajuste 1: 65 · 45 · 100 · 90): seguridad y resiliencia muy bajas. La
  llave inglesa a Yo era lo único que quedaba tras la passphrase; y la resiliencia caía por "olvidar la
  passphrase y perder el papel" (rareza 2 → 50) menos otras vías parecidas y el bloqueo por incapacidad
  (Pareja no entra en casa de los padres hasta que fallece Yo). Con un poder notarial (acceso "si queda
  incapacitado o fallece") el bloqueo desaparece. Motivó el ajuste 1. La herencia (90) supera la banda
  esperada (bueno): dos sitios a visitar, −10; parece razonable.
- **Multisig del fixture `distribuido-2de3`** (fuera de la galería): con la llave inglesa a 3 empataba
  con `todo-en-casa` (65), porque una única SeedSigner firma las tres keys y su firmware malicioso (3)
  lo roba todo. Si la SeedSigner solo carga la key de su misma ubicación, sube a 74.
- **R06** (65 · 28 · 100 · 0): seguridad igual que R05, no por encima: en los dos la única vía barata
  es la llave inglesa a Yo (3), y la seguridad ignora las vías secundarias (en R05, la copia de la
  passphrase). El usuario cree que "solo llave inglesa" debería rondar 75 o más (ver *Referencia fija*).
  Resiliencia 28: basta con olvidar la passphrase (rareza 1); justo por encima de "muy mal", aceptado.
  Probado con una Coldcard con PIN de coacción: sigue en 65, y es correcto: con la llave inglesa en
  casa también se abre la caja fuerte, y placa + passphrase bastan sin tocar el dispositivo. Sin la
  placa en casa, el PIN de coacción sí cuenta (3 + 1 → 80).
- **R07** (12 · 61 · 100 · 76): como se esperaba. La semilla se adivina en remoto por el fallo de
  Coldcard 2026 (esfuerzo 0,5): la peor seguridad de la galería. El resto, idéntico a R03. La herencia
  (76) queda bajo la banda antigua (excelente), pensada antes del ajuste 2.
- **R08** (49 · 65 · 100 · 78): seguridad igual que R03, y es lo esperable: con las tres placas en la
  caja fuerte, forzarla (2,5) da dos semillas, y Pareja también puede robar sola (2,5); las llaves
  inglesas (3) entran como vías casi igual de baratas (−6). Los ataques a fabricantes empiezan en 7,5:
  ahí sí ayudan tres fabricantes distintos. Resiliencia algo mejor que R03 (lo más probable, perder el
  acceso a Casa, rareza 3). Aquí la llave inglesa no es lo más barato: no informa sobre su peso.
- **R09** (65 → 71 · 72 · 100 · 72): la única vía barata es la llave inglesa en casa (dispositivos y
  PIN firman con dos keys); motivó el ajuste 3. Queda igual que R05 en seguridad, y el usuario se
  preguntó si un multisig distribuido no debería estar algo por encima. Mirando todas las vías, no:
  R05 es en la práctica un "2 de 2" contra el robo (semilla en la caja fuerte y passphrase en casa de
  los padres: una sola pareja que conseguir), y R09 un 2 de 3 (tres parejas posibles; cada fabricante
  y cada sitio da una key): 13 vías frente a 42, y a esfuerzo 4,5, una frente a tres. La tercera key
  sirve para no perder los fondos, no para que cueste más robarlos, y ahí R09 gana con claridad
  (resiliencia 72 frente a 45, herencia 72 frente a 59). Aceptado R05 ≈ R09 en seguridad.
- **R10** (71 · 75 · 100 · 72): el primero con las cuatro notas en su banda, y ≈ R09. El Abogado
  solo tiene K3: no abre vías baratas (su traición con la de Pareja cuesta 5). La resiliencia mejora un
  poco (72 → 75): como el Abogado entra siempre, con Yo incapacitado Pareja y él reúnen K1 (caja fuerte)
  y K3 (despacho), y la incapacidad ya no bloquea por sí sola. Para el diagnóstico: el despacho se modeló
  sin protección (intrusión 1,5, como una casa); si el abogado guarda la placa en su caja fuerte,
  debería ponerse *caja fuerte*.
- **R11** (71 · 56 · 100 · 0): como se esperaba. Seguridad idéntica a R09 (quitar a Pareja el acceso
  tras fallecer no encarece ningún robo); lo más probable que lo pierde todo es que fallezca Yo
  (rareza 2): Pareja solo llega a la placa K1. Para el titular en vida, tan bueno como R09; para los
  herederos, inútil.
- **R12** (65 · 62 · 75 · 72): lo más barato es el firmware malicioso de la SeedSigner (3): las tres
  semillas pasan por ella. La llave inglesa en casa ya no basta (allí no hay dispositivos con keys).
  Resiliencia por debajo de lo esperado (bueno): sin dispositivos que guarden las keys, las placas son la
  única copia y perder dos lo pierde todo (rareza 3); en R09 los dispositivos hacían de segunda copia.
  Parece correcto: la banda esperada era optimista.
- **Esquema de prueba "2 de 3 combinado"** (de prueba, no es fixture): sirvió para encontrar las
  fricciones marcadas como *esquema de prueba* (abajo) y una idea para el diagnóstico: el motor no distingue
  dónde vive la víctima de dónde solo tiene acceso. La llave inglesa en casa de un familiar exige llevarla
  allí (o retener a quien vive allí y hacerla venir); en la caja del banco eso ya cuesta +1. ¿Un recargo
  menor (+0,5) en ubicaciones donde la víctima no vive? Haría falta saber quién vive dónde.

## Fricciones al montar los esquemas

(Se rellena sobre la marcha.)

- **R01**: la procedencia de K1 quedó como "RNG de Desconocido + 99 dados", sin el Trezor que la generó:
  al crear la key y meterla en un dispositivo, la procedencia no se enlaza sola con él. (Aquí no cambia
  nada porque los 99 dados la protegen.)
- **R01**: los ids se quedan con el nombre por defecto (`nuevo-dispositivo`, `nueva-persona`) aunque luego
  se renombre. No se ve en la interfaz, solo en el JSON exportado.
- **R01**: no es obvio dónde se crea un dispositivo o un backup: solo se puede desde la ficha de su
  ubicación. Ideas: botones "+ Dispositivo" y "+ Backup" también en el Esquema (preguntando la
  ubicación), o un "+" junto a cada ubicación del índice.
- **R04**: dos backups con la misma etiqueta ("Backup K1", uno en la caja fuerte y otro en el banco) no
  se distinguen en las listas: "Pérdida de Backup K1 + Pérdida de Backup K1", o un bloqueo que nombra
  uno sin decir cuál. Ideas: avisar de etiquetas repetidas, o añadir la ubicación al nombre cuando
  dos coinciden.
- **R05**: al simular el fallecimiento, el mapa pinta en verde todas las ubicaciones a las que entra
  Pareja (también Casa, donde solo hay un Trezor que no puede desbloquear), no solo las que necesita.
  Lo que se usa sí se distingue (resaltado) de lo que solo está al alcance, pero en las ubicaciones
  no. Idea: distinguir también las ubicaciones necesarias de las solo alcanzables.
- **R06**: con un PIN de coacción, la seguridad no cambia si hay otro camino que no pasa por el
  dispositivo (la placa en la misma casa), pero la interfaz no explica por qué. Idea: avisar "el PIN de
  coacción no ayuda: con la llave inglesa también se llevan la placa de la caja fuerte".
- **R07**: el fabricante del RNG en la procedencia es texto libre y quedó "Coldcard Q", no "Coinkite"
  como en el catálogo. El fallo publicado se detecta igual (va por el firmware con que se generó), pero
  el ataque "RNG con fallo aún desconocido" agrupa por fabricante: dos keys con "Coldcard Q" y
  "Coinkite" no se verían comprometidas a la vez. Misma familia que la primera fricción de R01. Idea:
  elegir el fabricante del catálogo, o rellenarlo desde el dispositivo que generó la key.
  En R08 el usuario lo confirma: en la key hay que escribir el fabricante a mano en *Entropía* y luego
  volver a elegir el dispositivo en *Generada en*. Bastaría con elegir *Generada en* y que el RNG se
  rellenara desde ahí.
- **Esquema de prueba**: si nadie sabe el PIN de un dispositivo, el motor lo trata como inaccesible y la
  seguridad sube sin que el usuario se dé cuenta (en el esquema de prueba, 73 → 83).
  Idea: avisar "nadie sabe el PIN de X: no sirve para firmar" (aviso de validación).
- **Esquema de prueba**: "verificada de forma independiente" no protege una key cuya única fuente es el
  RNG del dispositivo: verificar demuestra que la semilla sale de esa entropía, no que la entropía sea
  buena. La interfaz no lo explica y es fácil creer lo contrario. Idea: explicarlo junto a la casilla, y
  avisar si una key solo tiene el RNG del dispositivo como fuente.
- **Esquema de prueba (fallo del motor, no de interfaz)**: al firmar con una semilla cargada, `derive.ts`
  usa el primer dispositivo que admite semillas (sin estado, o con "acepta semilla externa") y no mira
  qué keys carga. Con un dispositivo que solo carga K2 y otro que carga K1, el "por qué" dice que
  K1 se firma con el primero. Aquí no cambia la nota (están en el mismo sitio), pero si estuvieran en
  ubicaciones distintas la usabilidad saldría mal, y si ningún dispositivo cargara esa key se daría por
  posible una firma que no lo es. La parte de firmware malicioso (`firmware.ts`) sí respeta `loads`.
  Arreglar en el paso 2 del diagnóstico, con test.
