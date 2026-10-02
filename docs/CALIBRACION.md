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
- R07 < R02 ≈ R01 < R03 ≈ R04 < R05 < R06
- R08 < R09; R12 < R09; R10 ≈ R09 ≈ R11
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
- R03 ≈ R04 > R05: a Pareja le basta con casa, salvo que también necesite la passphrase de casa de los padres.

### Bandas

Bandas: **muy mal** < 25 · **flojo** 25–50 · **aceptable** 50–70 · **bueno** 70–85 · **excelente** > 85.

| Esquema | Seguridad | Resiliencia | Usabilidad | Herencia |
|---|---|---|---|---|
| R01 Papel en el cajón | muy mal / flojo | flojo | excelente | excelente |
| R02 Foto en la nube | muy mal | flojo | excelente | muy mal |
| R03 Acero en la caja fuerte | aceptable | aceptable | excelente | excelente |
| R04 Acero + copia en el banco | aceptable | bueno | excelente | excelente |
| R05 Passphrase con copia aparte | bueno | aceptable | excelente | bueno |
| R06 Passphrase solo en la memoria | bueno | muy mal | excelente | muy mal |
| R07 Coldcard afectada | muy mal | aceptable | excelente | excelente |
| R08 2 de 3 todo en casa | aceptable | aceptable | excelente | excelente |
| R09 2 de 3 distribuido | bueno | bueno | excelente | bueno |
| R10 2 de 3 con custodio | bueno | bueno | excelente | bueno |
| R11 2 de 3 sin plan de herencia | bueno | aceptable | excelente | muy mal |
| R12 2 de 3 con una SeedSigner | aceptable | bueno | bueno | bueno |

## Resultados

Notas actuales del motor (Seguridad · Resiliencia · Usabilidad · Herencia). ✓ = dentro de la banda
esperada, ✗ = fuera. Se recalculan todas cada vez que cambia `score.ts`; la última columna dice qué
ajuste las movió.

| Esquema | Seg | Res | Usa | Her | Último cambio |
|---|---|---|---|---|---|
| R01 Papel en el cajón | 23 ✓ | 34 ✓ | 100 ✓ | 100 ✓ | — |
| R02 Foto en la nube | 23 ✓ | 34 ✓ | 100 ✓ | 0 ✓ | hackeo de una nube 1,5 → 1 (Seg 27 → 23) |
| R03 Acero en la caja fuerte | 27 ✗ | 51 ✓ | 100 ✓ | 100 ✓ | — |

## Por dónde vamos

Hecho: R01–R03. Siguiente: **R04** (acero en casa y copia en el banco). Al terminar la galería: diagnóstico de todo junto,
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
