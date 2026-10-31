# Plan: keys repartidas (FROST, Shamir) y Taproot

Rama `keys-repartidas-taproot`. **Borrador para discutir**: nada de esto es definitivo hasta que se acuerde. Las
cuestiones abiertas están al final; las que dicen «comprobar» son hechos que hay que verificar antes de programar.

## 1. Objetivo

Que se pueda modelar una key cuyo secreto **no es una semilla, sino n shares de las que bastan t**, y escribir su
cartera en Taproot:

- **FROST** (Frostsnap): las shares se generan entre todos (DKG) y **nunca se juntan**, ni al generar ni al firmar.
  En la cadena es una sola key Taproot (`tr(KEY)`). Para recuperar basta con t shares: no hay descriptor que guardar.
- **Shamir** (SLIP-39 en Trezor, SSKR en Keystone/Passport): las shares son un backup repartido de una semilla
  normal; **se juntan** al recuperar, y el dispositivo que firma guarda la semilla entera.
- **Taproot**: primero `tr(KEY)` (single-sig BIP-86 y la key agregada de FROST); después, `tr(interna, {árbol})` con
  Miniscript en tapscript (lo que hacen Liana y Nunchuk).

La diferencia entre FROST y Shamir sale casi entera de **dónde está cada cosa**: en FROST cada dispositivo guarda una
share; en Shamir el dispositivo guarda la key entera y las shares solo están en los backups. El motor ya sabe razonar
sobre eso.

## 2. Garantía: lo existente no cambia

Es lo primero que se hace y lo que manda sobre todo lo demás.

### 2.1 Fase 0: la red de seguridad (antes de tocar nada)

- **Resultados congelados**: un script (`scripts/congelar.ts`) guarda en `packages/engine/test/congelado/` la salida
  completa de `analyze()`, `inheritanceLetter()`, `spendStages()` y `walletDescriptor()` (con la primera dirección)
  para:
  - todos los `fixtures/` y `fixtures/referencia/`,
  - los ejemplos de `packages/text` (los de la web),
  - **300 modelos aleatorios** del mismo generador de `properties.test.ts`, con semilla fija (el modelo también se
    guarda, para no depender de que el generador no cambie).
- Un test (`congelado.test.ts`) recalcula todo y lo compara **byte a byte**. El script solo se ejecuta en la fase 0:
  durante la rama, cualquier diferencia es un fallo, nunca algo que se regenera. Si algún cambio tuviera que alterar
  un resultado antiguo (no debería), se para y se discute.
- Lo mismo para `packages/bitcoin`: los descriptores y direcciones de sus tests ya están fijados; se añaden los de
  los ejemplos.
- **Tiempo de `analyze`**: medirlo en los ejemplos antes y después. Los modelos antiguos no ganan átomos de ataque ni
  de pérdida, así que no debería moverse.

### 2.2 Cómo se diseña para no romper

- **Todo es aditivo y opcional**: campos nuevos opcionales, variantes nuevas en `SecretRef` y `Fact`. Los `switch`
  exhaustivos (TypeScript estricto) obligan a tratar cada variante nueva en todos los sitios.
- **El tipo `Policy` no cambia**: una key repartida es un nodo `key` como cualquier otro. La política, los cortes, los
  timelocks, las etapas de gasto y el Miniscript no se tocan.
- **Las reglas nuevas solo recorren keys repartidas**: en un modelo sin ellas no hay nada que recorrer y no producen
  ningún hecho. Las reglas existentes no cambian su condición para las keys normales.
- **Taproot no toca el motor**: es una forma de escribir la cartera (`packages/bitcoin` y `domain/wallet.ts`); la
  política que analiza el motor es la misma.
- **Sin parámetros nuevos de puntuación** si se puede: una share se pierde o se roba como cualquier objeto y pesa lo
  mismo. Si hiciera falta alguno, va en `score.ts` y no altera los modelos antiguos.

### 2.3 Compatibilidad del documento

zod **descarta en silencio los campos que no conoce**. Una versión antigua (p. ej. la de Umbrel sin actualizar) que
abriera un documento con shares las perdería sin avisar, y al guardar se borrarían.

Propuesta: el documento lleva `version: 2` **solo si usa algo nuevo** (keys repartidas o Taproot). Así, una versión
antigua lo rechaza con un error en vez de mutilarlo, y los documentos que no usan nada nuevo siguen en `version: 1`,
idénticos. La versión nueva lee los dos.

## 3. Modelo (`packages/domain`)

### 3.1 Esquema

```ts
// En KeySchema, opcional:
split?: {
  scheme: 'frost' | 'shamir';
  k: number;                              // umbral t (1 ≤ k ≤ n)
  shares: { id: Id; label: string }[];   // n = shares.length
}

// Nuevo SecretRef: una share concreta de una key.
{ type: 'share', key: Id, share: Id }

// En DeviceSchema, opcionales:
shares?: { key: Id; share: Id }[];   // shares que guarda (FROST)
unlockedBy?: Id;                     // ordenador o móvil sin el que su share no sirve (comprobar, ver 9.2)
```

- Las shares van en los backups (`contents`) y en la memoria de las personas (`knows`), como cualquier `SecretRef`.
- En una key FROST **no existe semilla**: un `seed` suyo en un backup o en `knows` es un error de integridad. El hecho
  interno `seed:K` del motor significa para ella «el secreto completo, reconstruido» (ver 4.1), nunca algo escrito.
- En una key Shamir, la semilla sí existe (la guarda el dispositivo); las shares son su backup.
- Passphrase: SLIP-39 la admite; FROST no (`passphrase` debe ser `false` en una key FROST).
- Límites de la primera versión: SLIP-39 de un solo grupo (sin grupos de dos niveles) y `n ≤ 16`.

### 3.2 Integridad (`validate.ts`)

- Ids de shares únicos dentro de la key; `1 ≤ k ≤ n`; las referencias a shares apuntan a shares que existen.
- Una share FROST guardada en un dispositivo que no es de FROST: aviso (no error: el catálogo puede no saberlo).
- Una key FROST en una cartera que no es Taproot: problema de cartera (`frost-needs-taproot`).
- Avisos nuevos: shares de la misma key en la misma ubicación (el reparto no reparte), menos de t shares en total
  accesibles, todas las shares en dispositivos de un solo fabricante (el motor ya lo cuenta; el aviso lo explica).

### 3.3 Edición (`edit.ts`, puras y con cascada)

- `splitKey(model, key, scheme, k, n)`: convierte una key en repartida. Para FROST, solo si no tiene semilla escrita
  en ningún sitio (si no, la ficha explica qué quitar primero; no se borra nada por su cuenta).
- `unsplitKey`: vuelve a key normal; **eliminar limpia**: las referencias a sus shares desaparecen en cascada.
- `addShare`, `removeShare` (cascada en backups, personas y dispositivos; `k` se ajusta a `n` si se pasa),
  `setShareThreshold`, `renameShare`.
- `removeKey`, `renameIds`, `tidyIds` y `stripSecrets` tratan las referencias a shares.
- Test de propiedad: ninguna secuencia de ediciones con shares rompe el modelo (el que ya existe, ampliado).

## 4. Motor (`packages/engine`)

### 4.1 Reglas nuevas

Para una key repartida K con umbral t:

| Regla | Premisas | Concluye | Modo |
|---|---|---|---|
| `combine-shares` | t secretos `share:K/*` distintos | `seed:K` (el secreto completo) | ambos¹ |
| `device-share` | dispositivo desbloqueado que guarda la share i (y, si tiene `unlockedBy`, ver 9.2) | `share-sign:K/i` | ambos |
| `frost-sign` | t hechos `share-sign:K/*` distintos | `sign:K` | ambos |
| `share-xpub` | un dispositivo desbloqueado con una share, o `seed:K` | `xpub:K` | ambos |

¹ En modo `secure` (firmar a diario), juntar shares solo vale en Shamir y cargando la semilla en un dispositivo, como
ya hace `seed-sign-on-device`. Una key FROST **nunca** firma por `seed-sign-on-device`: se excluye de forma explícita.

En modo `any` (ladrón, recuperación), t shares en software dan el secreto completo y se firma con `seed-sign`, como
hoy. Así, en un robo **FROST y Shamir se comportan igual**: lo que los distingue es qué guarda cada dispositivo. Eso
es justo la diferencia real.

Con `share-xpub` y una política que es solo la key FROST, no hace falta descriptor: `noDescriptorCopy` solo salta con
`thresh`, así que no penaliza, sin cambiarlo.

### 4.2 Ataques existentes, ampliados a shares

Cada uno añade las shares sin cambiar lo que ya hacía con las keys:

- **Firmware malicioso** (`firmware.ts`): `keysUsedOn` y `firmwareExposure` cuentan también las shares que guarda el
  dispositivo. `CompromisedSeed` gana un `share` opcional.
- **Dispositivo manipulado, extracción física, explotación desde el ordenador**: lo mismo, con las shares del
  dispositivo.
- **RNG comprometido**: es de la key entera. Con DKG no hay un único dispositivo que la genere (`generatedBy` sin
  indicar) y las fuentes son las de todos los participantes (los RNG de cada dispositivo y el del móvil): con la
  lógica actual de `keyCompromise`, cae solo si caen todos. No cambia la función.
- **Pérdidas**: las shares están en objetos que ya se pierden, se queman o se olvidan. No hace falta ningún átomo
  nuevo.

### 4.3 Herencia y carta

- `inheritanceReport` mira `policy.type === 'thresh'` para exigir la cartera. Una política con solo la key FROST no
  es `thresh`: no se exige descriptor, que es lo correcto. No cambia.
- La carta (`letter.ts`) lista las shares que hay que reunir y dónde están, y para FROST añade que se necesitan la app
  de Frostsnap y dispositivos en blanco donde cargar los backups (texto, no motor: ver 9.6).

### 4.4 Tests del motor

- **Equivalencia con el multisig**: una key FROST t-de-n con sus shares colocadas igual que las keys de un
  `thresh(t, K1…Kn)` da **los mismos cortes de robo y de pérdida** (salvo lo que es propio: firmware por fabricante,
  descriptor y xpubs). Es un test de propiedad: se genera el multisig y se transforma.
- **Equivalencia Shamir**: todas las shares de K en un mismo backup equivale a la semilla de K en ese backup.
- Monotonía con el generador ampliado (modelos con keys repartidas).
- Casos de referencia: Frostsnap 2-de-3 repartido; el mismo con las tres tarjetas en casa; Shamir 2-de-3 con un
  Trezor; un dispositivo robado sin su móvil.

## 5. Taproot (`packages/bitcoin` y `domain/wallet.ts`)

### 5.1 Etapa A: `tr(KEY)`

- `ScriptType` gana `'tr'`. Clave x-only, ajuste BIP-86 (`TapTweak` sin árbol), bech32m.
- `@noble/curves` pasa a ser dependencia directa de `packages/bitcoin` (ya está instalada como dependencia de
  `@scure/bip32`; sin red en ejecución, como siempre).
- Leer y escribir `tr(...)` con la suma de control BIP-380 actual.
- Vectores de prueba de BIP-86 (la dirección de «abandon … about»).
- `walletOf`: single-sig sigue saliendo `wpkh` por defecto. `tr` solo si se elige o si la key es FROST.
- La cartera de una key FROST: «no hay descriptor que guardar», y si se conoce la xpub agregada, el `tr(...)` para
  vigilarla (comprobar qué exporta Frostsnap, ver 9.5).

### 5.2 Etapa B: `tr(interna, {árbol})` con Miniscript

- Miniscript en contexto tapscript: `multi_a` y `sortedmulti_a` en lugar de `multi`, claves x-only, `OP_CHECKSIGADD`.
  Las reglas de tipos son las de `packages/bitcoin/src/miniscript.ts` con las diferencias de tapscript.
- Árbol: `TapLeaf` y `TapBranch` (BIP-341) y la raíz de Merkle para la dirección. Para la dirección no hacen falta
  bloques de control.
- Key interna: una key de la política (p. ej. la FROST, con las ramas de espera para los herederos) o el punto NUMS
  sin gasto posible. Se guarda en `wallet`.
- Importar: como con `wsh`, se guarda el árbol tal cual (`wallet.miniscript`) para dar las mismas direcciones que la
  cartera de origen. Escribir: una estrategia fija y documentada, como hoy.
- Vectores de prueba de BIP-341 (los `wallet-test-vectors` con árbol de scripts).
- El motor no cambia: la política es el mismo árbol.

### 5.3 Catálogo

- El campo `miniscript` actual significa «Miniscript en `wsh`» y **no se toca**. Se añade `taproot`:
  `{ singleSig?: { since?: string }; miniscript?: { since?: string } } | null`.
- Dispositivos que no firman la cartera Taproot elegida: aviso y resta de usabilidad, igual que
  `devicesWithoutMiniscript`, pero en una lista aparte. Solo cuenta con cartera `tr`, así que los modelos antiguos no
  cambian.
- Hay que investigar qué admite cada modelo (comprobar): Ledger (app de Bitcoin 2.1/2.2), BitBox02, Jade, Coldcard
  (Edge), Trezor, Passport, Keystone, SeedSigner, Krux, Specter DIY.

## 6. Textos (`packages/text`, es y en)

- Motor: las reglas nuevas en las explicaciones del «por qué», y los avisos de integridad.
- Cartera: `tr`, «sin descriptor que guardar», `frost-needs-taproot`, los problemas de tapscript.
- Carta para los herederos: las shares y lo que se necesita para cargarlas.
- Interfaz: ficha de key, de dispositivo y de backup (zona por fichero en `interfaz/`).
- Guía: un capítulo nuevo (keys repartidas: FROST frente a Shamir frente a multisig) con simulaciones y sus cifras
  (`scripts/guia.ts`). Las cifras de los capítulos existentes no deben cambiar: `guia.test.ts` ya lo comprueba.

## 7. Interfaz (`apps/web`)

- **Ficha de key**: «Cómo es: semilla / repartida». Si es repartida: FROST o Shamir, t de n y la lista de shares con su
  nombre.
- **Shares en el mapa**: etiqueta `K1·2` (la key con el número de share), siempre con su «Kn», con el color de su
  key. El estado sigue sin ir solo en color.
- **Dispositivo**: qué shares guarda y, para Frostsnap, con qué móvil se desbloquea. Opción de PIN desactivada si el
  modelo del catálogo no tiene PIN.
- **Backup**: entre sus contenidos, shares.
- **Cartera**: opción Taproot y el caso FROST sin descriptor.
- e2e con capturas en cada paso visual, y revisión del usuario en el navegador antes de cada commit visual.

## 8. Fases y commits

Cada fase pasa `npm run check` y el test de resultados congelados. Las fases 1 y 2 son independientes entre sí.

| Fase | Contenido | ¿Visual? |
|---|---|---|
| 0 | Red de seguridad: resultados congelados, tiempos de referencia | no |
| 1 | Taproot `tr(KEY)`: `packages/bitcoin`, `wallet.ts`, catálogo `taproot` | no |
| 2 | Modelo: esquema, `version: 2`, integridad, ediciones con cascada | no |
| 3 | Motor: Shamir (`combine-shares`, ataques ampliados) | no |
| 4 | Motor: FROST (`device-share`, `frost-sign`, `share-xpub`, `unlockedBy`) | no |
| 5 | Textos del motor, cartera y carta (es y en) | no |
| 6 | Interfaz: fichas, mapa, cartera | sí |
| 7 | Catálogo Frostsnap, ejemplos, guía, CAPACIDADES | sí |
| 8 | Taproot con árbol de scripts y Miniscript en tapscript | parte |

Propuesta: **dos PR**. El primero, fases 0 a 7 (keys repartidas con `tr(KEY)`); el segundo, la fase 8, que es la más
grande y no la necesita nadie para usar Frostsnap. `docs/CAPACIDADES.md` se actualiza en cada fase con su parte y
sus límites.

## 9. Cuestiones abiertas

1. **Anti-exfil en Frostsnap.** El móvil aporta aleatoriedad en cada firma, lo que frena filtrar la share en las
   firmas. Pero la app es del mismo fabricante: un fabricante malicioso controla los dos extremos. ¿Cuenta como
   anti-exfil (`antiExfil: true`) o no? Propuesta: no; con un campo que explique por qué.
2. **Qué protege el móvil (comprobar).** Según la web, los secretos van cifrados con una clave que guarda el móvil, y
   un móvil nuevo se empareja «visitando un umbral de dispositivos». Si es así, la regla sería: la share de un
   dispositivo sirve con su móvil **o** teniendo t dispositivos de esa key. Con menos de t dispositivos y sin móvil,
   el ladrón no consigue nada, pero las tarjetas de backup no tienen esa protección. Hay que confirmar el diseño
   exacto en su documentación o su código.
3. **¿Keys FROST junto a otras keys?** En tapscript se podría (`thresh(2, FROST, Coldcard…)`), pero no sé si Frostsnap
   firma hojas de tapscript. Propuesta: en la primera versión, una key FROST solo como política entera o como key
   interna de `tr`.
4. **Extracción física en el ESP32-C3 (comprobar).** No tiene secure element. ¿Hay avisos publicados de extracción
   por glitching que deban ir al catálogo? Solo con un aviso real; sin él, el motor no supone nada.
5. **Qué exporta Frostsnap (comprobar).** ¿Da un descriptor `tr(xpub…)` para vigilar la cartera en otro software?
   ¿Cuál es su `n` máximo? ¿Cómo se actualiza el firmware?
6. **Recuperar sin Frostsnap.** Hoy la recuperación necesita su app y dispositivos en blanco. En modo `any`, el motor
   supone que t shares bastan. ¿Basta con advertirlo en la carta y la guía, o los herederos deberían necesitar un
   dispositivo del fabricante? Propuesta: texto, no motor; el código es abierto (MIT) y el formato está publicado.
7. **Shamir de dos niveles** (grupos de SLIP-39) y SSKR: fuera de la primera versión.
8. **`version: 2` solo cuando se usa algo nuevo**: confirmar que es la forma preferida.
9. **Ordenador cuántico.** En Taproot, la clave pública (ajustada) está en la propia salida: queda expuesta en la
   cadena desde que se recibe, no desde que se gasta, como en `wpkh`/`wsh`, donde solo se ve un hash hasta gastar.
   Con un ordenador cuántico capaz de romper el logaritmo discreto, toda salida Taproot se gasta por la vía de la key,
   aunque la key interna sea NUMS: el árbol de scripts no protege. Matices: en `wpkh`/`wsh` la exposición llega igual
   al reutilizar direcciones, al gastar (ventana en la mempool) o si se filtra una xpub, algo que el modelo ya sigue
   (quién tiene cada xpub). Hay propuestas para salidas resistentes (BIP-360). Propuesta mínima: decirlo en la
   cartera al elegir `tr` y en la guía. A discutir: modelarlo como ataque teórico (un átomo con esfuerzo muy alto que
   da las semillas de las keys cuya clave pública está a la vista: todas en `tr`, y las de xpub filtrada en
   `wsh`/`wpkh`), sin que cambie la puntuación de los modelos actuales.
