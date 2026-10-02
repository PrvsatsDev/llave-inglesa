# Qué soporta llave-inglesa

Inventario vivo de todo lo que la herramienta modela, calcula y muestra. **Se actualiza con
cada cambio de comportamiento** y es la base de la guía de uso. Lo pendiente está en
[IDEAS.md](IDEAS.md).

## 1. El modelo (qué se describe)

Nunca material secreto real: solo qué existe, dónde está y quién sabe qué.

| Elemento | Qué se indica |
|---|---|
| **Política** | Árbol tipo Miniscript: `key` y `thresh` (k de n, anidable). Single-sig = una key. |
| **Key** | Nombre, fingerprint (opcional), si requiere **passphrase** y **cómo es** (débil, frase o aleatoria larga; nunca cuál es; sin indicar cuenta como débil y da un aviso), y su **procedencia**: fuentes de entropía mezcladas (RNG de dispositivo o software, dados, moneda, cartas, desconocido; con nº de tiradas), dónde se generó (modelo del catálogo u otro, o "calculada a mano"), **firmware con el que se generó** y si se **verificó de forma independiente**. |
| **Dispositivo** | Modelo (del catálogo o escrito a mano), **firmware instalado**, stateful/stateless, keys que guarda, **keys que se firman con él** (stateless o semilla externa; "sin indicar" = cualquiera en un stateless), PIN, **PIN de coacción configurado** (si el modelo lo admite), si firma con semillas externas, si tiene el multisig registrado, ubicación. |
| **Backup** | Soporte (papel, metal, arandelas, digital, otro), contenido (semilla, passphrase, xpub, PIN, descriptor, contraseña) y secretos que lo bloquean (p. ej. cifrado con contraseña). |
| **Persona** | Rol (titular, heredero, custodio, otro) y qué sabe de memoria. |
| **Ubicación** | Tipo (física, dispositivo como un portátil, nube) y quién puede entrar y **cuándo**: siempre, tras el fallecimiento de alguien, o si alguien queda incapacitado o fallece (poder notarial). Las físicas tienen **protección** (ninguna, **caja fuerte** doméstica o **caja del banco**) y pueden estar **dentro de otra** física (p. ej. la caja fuerte dentro de Casa; un solo nivel): para entrar en ella hay que poder entrar también en la que la contiene. |

La validación avisa de referencias rotas y de incoherencias (p. ej. un stateful que no guarda nada, una key fuera de la política).

## 2. Catálogo de hardware (fecha: ver `CATALOG_DATE`)

- **Modelos**: Trezor, Ledger, Coldcard, Tapsigner, BitBox, Passport, Jade, Bitkey, SeedSigner, Krux, Specter DIY, Keystone. Por modelo: stateful/stateless, descatalogado, semilla externa, registro de multisig, **anti-exfil**, **PIN de coacción** (señuelo / borrado) y, en los Coldcard actuales, las **series de firmware** conocidas.
- **Avisos de seguridad** con rangos de firmware, mitigaciones y fuentes: entropía débil (Coldcard 2026), extracción física (Trezor One/T), cadena de suministro (Trezor Safe 3), explotable desde un ordenador con malware (Jade, BitBox02).
- Firmware vacío, incompleto (no `x.y.z`) o de otro modelo → se asume afectado.
- Elegir un modelo rellena sus campos (editables después). Los documentos guardan el nombre del modelo, así que los escritos a mano con el mismo nombre se enlazan solos.

## 3. Ataques (seguridad)

Un robo es una **combinación** de ataques; se buscan todas las combinaciones mínimas y su esfuerzo es la suma. Si exige asaltar (intrusión o llave inglesa) **varios sitios físicos distintos**, cada uno después del primero suma **+1**: localizar y asaltar dos casas es mucho más que dos veces una. Una ubicación dentro de otra es el mismo sitio; la nube, la traición o el firmware no cuentan como sitios.

| Ataque | Esfuerzo | Qué consigue |
|---|---|---|
| Intrusión (o hackeo / robo o malware, según el tipo de ubicación) | 1,5 · caja fuerte 2,5 · caja del banco 3,5 · hackeo de una nube 1 | Todo lo que hay en la ubicación. El hackeo de una nube es más barato: en remoto, sin riesgo y a escala (phishing, filtraciones, malware que busca semillas en las fotos). En una que está **dentro de otra** hay que entrar también en esa, y solo suma la diferencia (casa 1,5 + caja fuerte 1 = 2,5). |
| Traición | 2,5 | Lo que sabe una persona de confianza (no titular) y los sitios a los que entra. |
| Llave inglesa | 3 · en una caja del banco 4 | Lo que sabe la persona coaccionada y, si se hace allí, la ubicación (obligada a abrir la caja fuerte, también la casa en la que está). En la caja del banco hay que llevarla en horario, identificarse y pasar cámaras: +1. |
| RNG con fallo aún desconocido (por fabricante o de origen desconocido) | 3 | Semillas generadas con ese RNG, salvo que otra fuente buena o una verificación independiente las proteja. |
| Firmware malicioso (por fabricante) | 3 | Semillas que pasan por sus dispositivos (guardadas o cargadas), filtradas en las firmas. **Anti-exfil lo mitiga.** |
| Semilla adivinable por un fallo publicado (por aviso) | 0,5 | Todas las semillas generadas con firmware afectado, a la vez. **128 bits de entropía propia lo mitigan.** |
| Fuerza bruta a la passphrase (por key) | débil 0,5 · frase 3 | La passphrase, **solo si ya tiene la semilla**. Una aleatoria larga no se puede adivinar. |

**PIN de coacción**: si un robo solo funciona porque el coaccionado revela el PIN real de un dispositivo con PIN de coacción configurado, cuesta **+1** (no lo anula: un atacante informado sabe que existe). No afecta a la traición, ni si el PIN también está apuntado en un sitio al alcance. Cada vía muestra su esfuerzo y si vence un PIN de coacción.

Además, **extracción física**: robar un dispositivo con ese aviso (Trezor One/T) da sus semillas aunque tenga PIN. Solo en ataques, nunca como vía de recuperación.

Reglas que protegen: PIN del dispositivo, **passphrase** (sin ella la semilla sola no firma), backups cifrados, y que para gastar un multisig hacen falta las **xpubs de todas las keys** (descriptor o multisig registrado).

**Privacidad**: si un atacante consigue todas las xpubs, ve el saldo y los movimientos aunque no pueda gastar.

## 4. Desgracias (resiliencia)

Desastres por ubicación, pérdida de un objeto, fallecimiento, incapacidad y olvido. Se buscan las combinaciones mínimas que dejan los fondos inaccesibles para siempre.

| Ubicación | Desastres |
|---|---|
| Física (casa, banco) | **Incendio**, **inundación**, **pérdida del acceso** (se pierde todo) |
| Física dentro de otra (caja fuerte de casa) | Ninguno propio: le llegan los de la que la contiene (perder esa es perder también esta). Una caja fuerte propia siempre se puede abrir, así que no se pierde el acceso |
| Dispositivo (portátil, disco) | **Avería** (se pierde todo) |
| Nube | **Pérdida de la cuenta** (se pierde todo) |

Un incendio o una inundación destruyen todo lo que hay en la ubicación (y en lo que está dentro de ella) **salvo los backups de metal o arandelas** (se asume acero). El papel, lo digital, "otro" y todos los dispositivos se pierden. En la simulación, la ubicación lleva la etiqueta del desastre y lo que resiste, "Resiste".

- La **incapacidad** es un **bloqueo temporal** (se resuelve al fallecer: heredan), no una pérdida; resta algo de resiliencia.
- Los accesos "tras el fallecimiento" o "si queda incapacitado o fallece" se activan con esos sucesos.

## 5. Puntuaciones (0–100, parámetros en `packages/engine/src/score.ts`)

- **Seguridad**: esfuerzo del robo más barato, menos una penalización si hay varias vías casi igual de baratas (hasta 0,5 más): −2 por cada vía extra, como mucho −6.
- **Resiliencia**: lo improbable que es perderlo todo. Cada desgracia tiene una **rareza** (órdenes de magnitud de improbabilidad): olvidar 1 · perder un objeto 1 (acero 1,5) · avería de portátil o pérdida de cuenta 1,5 · incendio, inundación, fallecimiento 2 (incendio o inundación en una caja del banco, 3: la cámara acorazada los resiste mucho mejor) · incapacidad 2,5 · pérdida del acceso a un sitio 3. Varias a la vez suman su rareza. La base sale de la pérdida más probable; las demás vías restan (sus probabilidades se suman: rareza equivalente de todas juntas), y el bloqueo temporal más probable resta 5 si su rareza es menor que 3, 2 si es menor que 5. Escala: rareza 1 → 30 · 2 → 60 · 3 → 75 · 4 → 85 · 5 → 95 · 6 → 100.
- **Usabilidad**: cuántas ubicaciones hay que visitar para firmar de forma segura (con dispositivos de firma). Una ubicación y lo que tiene dentro (casa y su caja fuerte) son una sola visita.
- **Herencia**: si los herederos pueden recuperar los fondos tras el fallecimiento de los titulares, y cuántas ubicaciones les cuesta (contadas como visitas, igual que en usabilidad); menos la **fragilidad** de ese camino. El fallecimiento es seguro, así que se da por hecho y se buscan las desgracias que, además, dejarían a los herederos sin los fondos (perder la única copia a su alcance, un incendio, que fallezca o quede incapacitado el heredero…). Su robustez se puntúa como la resiliencia y se resta 0,4 × lo que le falta para 100 (como mucho −40).

Todo resultado lleva su **explicación**: el árbol de por qué se cumple cada paso. Las puntuaciones de seguridad y resiliencia se pueden **desglosar** en base y descuentos, y la usabilidad y la herencia se explican con la firma de los titulares (o de los herederos, tras el fallecimiento de los titulares) yendo solo a las ubicaciones mínimas.

## 6. Interfaz

- **Web** (offline, sin red): mapa de ubicaciones, personas y objetos, y a su izquierda una columna (redimensionable entre 400 y 720 px arrastrando su borde o con las flechas, y plegable a una barra con solo las cuatro puntuaciones; la preferencia se recuerda en este navegador) con:
  - **Tres secciones** en pestañas, que nunca cambian por su cuenta: **Esquema** (arriba, los errores y avisos del modelo, solo si los hay; la política; las keys; un **índice de todo lo que hay**: cada ubicación con sus dispositivos y backups y los secretos que guardan, como en el mapa, y cada persona con su papel, a cuántos sitios entra y qué sabe de memoria; pulsar cualquier fila abre su ficha; y, plegados al final, nombre y descripción. La pestaña muestra cuántos errores o avisos hay), **Análisis** y **Simular** (empezar con un ataque o una desgracia, combinarlos y ver el resultado; la pestaña indica si hay una simulación activa). En un ataque se ve el **esfuerzo** paso a paso y su total; si el robo exige **vencer un PIN de coacción**, se dice de qué dispositivo y por qué cuesta más; y los dispositivos que caen por **firmware malicioso** o **extracción física** se explican aquí y se señalan en el mapa (borde discontinuo e insignia "Firmware malicioso" / "Semilla extraída"). Si la simulación sale de una lista del análisis, las migas dicen "Vía n de N" y ‹ › recorren las demás.
  - **Las cuatro puntuaciones siempre a la vista** (2×2). Pulsar una lleva a *Análisis › esa métrica*, y queda marcada. Cada métrica empieza por su **puntuación desglosada** (la base y lo que se le resta, p. ej. "robo más barato: esfuerzo 3 → 65; 13 vías casi igual de baratas −6") y un plegable **cómo se calcula** con las escalas y pesos reales de `score.ts`. Después: Seguridad, las formas más baratas de robar; Resiliencia, las formas más probables de perderlo todo y los bloqueos temporales (cada lista se despliega para ver **todas** las combinaciones, con su esfuerzo, o con su rareza y cuántos sucesos a la vez); Usabilidad, las ubicaciones mínimas para firmar y el árbol de por qué; Herencia, quiénes heredan (con su papel; los custodios u otras personas solo se nombran, como ayuda, si sin ellos no se recupera), a dónde tienen que ir, el árbol de por qué (o con qué keys se quedan cortos), un botón para simular el fallecimiento de los titulares en el mapa y las formas más probables de quedarse sin herencia (cada una se simula en el mapa junto con el fallecimiento).
  - **Ubicaciones protegidas** en el mapa y en el índice: icono de caja fuerte o de banco y, bajo el nombre, "Caja fuerte · dentro de Casa". En la ficha de una ubicación física se elige la protección (con lo que implica) y dentro de qué otra está; si contiene otras, se listan en su lugar.
  - **Migas de pan con «Volver»** (también Esc): la ficha de un elemento se abre encima de la sección en la que se estaba; abrir otra desde ella (p. ej. un dispositivo desde su ubicación) la apila; pulsar una vía del análisis abre su simulación, y volver regresa a la lista con la simulación aún en el mapa. En la raíz de cada sección, una frase dice qué hay en ella.

  Deshacer/rehacer, guardado cifrado en el navegador, exportación cifrada (`.llave`) o en claro (`.json`).
- **CLI**: `npm run analyze -- fichero.json` imprime puntuaciones, vías más baratas con su porqué, pérdidas y bloqueos.
- **Ejemplos** (`fixtures/`): todo en casa, distribuido 2 de 3, single-sig con passphrase.

## 7. Límites conocidos (simplificaciones actuales)

- La fortaleza de la passphrase son tres niveles aproximados; no se mide su entropía real.
- No se modela el ordenador o móvil con el que se firma: los fallos explotables desde un ordenador con malware solo se avisan.
- El air-gap no cuenta como mitigación (no frena la filtración en las firmas).
- El catálogo no se actualiza solo; una versión completa y posterior a la corregida se da por buena aunque no exista.
- Las rarezas son estimaciones de orden de magnitud, iguales para todos (no dependen de la edad, la zona o el tipo de vivienda), y las desgracias se tratan como independientes. Se buscan combinaciones de hasta 3 a la vez.
- El metal se asume acero: una placa de aluminio o de latón no resistiría un incendio. Un papel en una bolsa estanca o una caja fuerte ignífuga tampoco se distinguen.
- La protección son tres niveles fijos (ninguna, caja fuerte, caja del banco): no distingue la calidad de la caja fuerte ni si está anclada, ni alarmas o vigilancia en casa. Las ubicaciones solo se anidan un nivel.
- Sin timelocks todavía; la política ya es un árbol preparado para ellos.
