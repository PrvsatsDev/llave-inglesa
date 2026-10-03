# Guía de uso

<!-- Generado por scripts/guia.ts desde packages/text/src/guia.ts: no editar a mano. -->

Esta guía también está dentro de la aplicación (https://llave-inglesa.vualt.net, menú *Archivo → Guía de uso*), donde es
interactiva: sus botones abren los ejemplos y simulan en el mapa. Las cifras son las que calcula el motor
en esta versión.

1. [Qué es y qué no es](#que-es): Un simulador de tu custodia: qué hace, qué no hace y por qué nunca necesita tus secretos.
2. [Primeros pasos](#primeros-pasos): Cinco minutos con un ejemplo: las cuatro notas, el mapa y tu primera simulación.
3. [Cómo se leen las notas](#notas): Qué mide cada una de las cuatro puntuaciones, con ejemplos que se mueven de un extremo a otro.
4. [Simular](#simular): Probar ataques y desgracias, combinarlos y leer en el mapa qué pasaría y por qué.
5. [Casos guiados](#casos): De la frase semilla en un papel a un multisig distribuido: qué falla en cada paso y qué lo arregla.
6. [Montar tu esquema](#montar): De un esquema en blanco al tuyo: keys, ubicaciones, dispositivos, backups, personas y guardarlo cifrado.
7. [Conceptos](#conceptos): Las palabras que usa la herramienta, en una línea cada una.
8. [Límites conocidos](#limites): Lo que el motor simplifica o no tiene en cuenta, para leer las notas con criterio.
9. [Privacidad y verificación](#verificar): Qué sale de tu equipo (nada), cómo se guarda tu esquema y cómo comprobar que la app es la que dice ser.

<a id="que-es"></a>

## 1. Qué es y qué no es

llave-inglesa es un **simulador**. Describes cómo guardas tus bitcoins (qué keys hay, en qué dispositivos y backups, dónde está cada cosa y quién sabe qué) y la herramienta busca, con método, todas las formas en que eso puede salir mal.

- **Robos**: intrusiones, la llave inglesa, una traición, una cuenta en la nube hackeada, un fallo en el generador de números aleatorios de un fabricante…
- **Pérdidas**: un incendio, una inundación, perder una placa, olvidar una passphrase, fallecer o quedar incapacitado…
- **El día a día**: cuántos sitios tienes que visitar para firmar.
- **La herencia**: si tus herederos llegarían a los fondos, y qué podría impedirlo.

> 💡 **Nunca escribas frases semilla, claves privadas ni passphrases reales.** No hacen falta: el modelo solo dice que una placa contiene la frase semilla de K1, nunca cuál es.

Todo ocurre en tu navegador: la aplicación no puede hacer ninguna petición de red, no hay cuentas ni telemetría. Aun sin secretos, tu esquema es un **mapa del tesoro** (dónde está cada copia y quién sabe cada PIN), así que guárdalo cifrado (**Archivo → Guardar en este navegador** o **Exportar cifrado**).

**Lo que no es**: no es una cartera, no toca la red de Bitcoin ni tus fondos, y no sustituye a tu criterio. Es un modelo: las notas comparan esquemas entre sí y explican sus puntos débiles, pero las probabilidades reales dependen de tu vida. Lo que el motor no tiene en cuenta está en [Límites conocidos](#limites).

<a id="primeros-pasos"></a>

## 2. Primeros pasos

Empieza con un esquema ya montado: un multisig 2 de 3 en el que casi todo está en casa. Es cómodo, y justo por eso tiene puntos débiles que se ven enseguida.

> ▶ En la app: abre el ejemplo «Todo a mano en casa».

**Las cuatro notas**, arriba en esta columna, resumen el esquema de 0 a 100:

- **Seguridad** (**69** (aceptable)): lo que le cuesta a un atacante robarte por la vía más barata.
- **Resiliencia** (**66** (aceptable)): lo improbable que es perderlo todo por desgracias (un incendio, perder una placa, olvidar algo…).
- **Usabilidad** (**100** (excelente)): a cuántos sitios tienes que ir para firmar.
- **Herencia** (**77** (bueno)): si tus herederos llegarían a los fondos, y lo frágil que es ese camino.

Más adelante, fuera de la guía, puedes pulsar cualquier nota para ver de dónde sale: la base, lo que se le resta y, plegado, cómo se calcula. Si sales, **Archivo → Guía de uso** te devuelve a este mismo punto.

**El mapa** tiene arriba las ubicaciones, con lo que hay en cada una (dispositivos y backups) y las keys que guardan (K1, K2, K3). Abajo, las personas con lo que saben de memoria. Las líneas dicen quién puede entrar dónde; las discontinuas, solo tras un fallecimiento.

**Tu primera simulación**: ¿cuál es la forma más barata de robar este esquema?

> ▶ En la app, con el ejemplo «Todo a mano en casa»: *Simular una llave inglesa a Yo en Casa*.

En rojo, lo que usa el atacante: obligado a dar el PIN, Yo desbloquea la Coldcard (K1), y la placa de K2 está en el mismo sitio. Dos de tres: puede gastar. Es una sola acción, y por eso la seguridad se queda en **69** (aceptable).

> 💡 La pestaña **Simular** explica siempre **por qué**: cada firma, cada secreto y de dónde lo saca el atacante.

Ahora una desgracia: un incendio en casa.

> ▶ En la app, con el ejemplo «Todo a mano en casa»: *Simular un incendio en Casa*.

La placa de acero de K2 resiste y, con la de K1 del banco, se recupera todo. Pulsa **¿Y si no resiste?** junto a la placa para ver qué pasaría si también se perdiera.

Ya has visto lo esencial. A partir de aquí puedes cambiar cualquier cosa del esquema y ver cómo se mueven las notas, o montar el tuyo desde **Archivo → Nuevo esquema**.

<a id="notas"></a>

## 3. Cómo se leen las notas

Cada nota va de 0 a 100 y se lee en cinco bandas: **muy mal** (menos de 25), **flojo** (hasta 50), **aceptable** (hasta 70), **bueno** (hasta 85) y **excelente**. Los pesos exactos de cada cálculo están en el análisis de cada nota, en «Cómo se calcula».

**Seguridad**: lo que le cuesta al atacante la vía de robo más barata. Cada ataque tiene un esfuerzo (entrar en una casa cuesta poco; la llave inglesa, bastante más) y una vía puede combinar varios. Si hay otras vías casi igual de baratas, resta un poco: más puertas para el ladrón.

> ▶ En la app, con el ejemplo «Papel en el cajón»: *Papel en el cajón: basta con entrar en casa*.

Con la frase semilla en un papel en casa, un ladrón cualquiera se la lleva: seguridad **35** (flojo).

> ▶ En la app, con el ejemplo «Passphrase solo en la memoria»: *Passphrase solo en la memoria: hace falta la llave inglesa*.

Si además de la placa hace falta una passphrase que solo sabes tú, ya no basta con entrar: hay que obligarte a hablar. Seguridad **73** (bueno).

**Resiliencia**: lo improbable que es perderlo todo para siempre. Cada desgracia tiene una rareza (olvidar algo es corriente; un incendio, mucho menos) y las que tienen que coincidir se suman. Manda la pérdida más probable; las demás restan algo.

> ▶ En la app, con el ejemplo «Passphrase solo en la memoria»: *El mismo esquema, si olvidas la passphrase*.

La passphrase que te protegía del ladrón es también tu punto débil: olvidarla lo pierde todo. Resiliencia **28** (flojo). Con dos placas de acero, una en casa y otra en el banco, sube a **77** (bueno).

**Usabilidad**: a cuántos sitios tienes que ir para firmar de forma segura, con tus dispositivos. Un sitio y lo que tiene dentro (casa y su caja fuerte) cuentan como una visita.

- 2 de 3 con los tres dispositivos en casa: una visita, usabilidad **100** (excelente).
- 2 de 3 con una sola SeedSigner y sin dispositivos que guarden keys: para firmar hay que ir a buscar las placas, también al banco. Usabilidad **75** (bueno).

**Herencia**: si, tras tu fallecimiento, tus herederos pueden recuperar los fondos y a cuántos sitios tendrían que ir; menos lo frágil que es ese camino (que se pierda la única copia a su alcance, que fallezca también el heredero…).

> ▶ En la app, con el ejemplo «2 de 3 sin plan de herencia»: *2 de 3 sin plan de herencia: tu fallecimiento*.

Un multisig impecable para ti puede ser inútil para tu familia: si tu pareja no puede entrar ni en el banco ni en casa de tus padres, no heredaría nada. Herencia **0** (muy mal). El mismo esquema, con tu pareja pudiendo entrar en el banco y en casa de tus padres tras tu fallecimiento: **77** (bueno).

> 💡 **No existe el 100 en todo.** Firmar en un solo sitio choca con la llave inglesa; que tus herederos lo tengan fácil choca con que lo tenga fácil un ladrón; cada copia de más es otra puerta. Busca ser bueno en todo y elige qué sacrificas.

<a id="simular"></a>

## 4. Simular

La pestaña **Simular** prueba cualquier suceso sobre el mapa: empieza con un ataque o una desgracia y añade otros con **Añadir otro suceso a la vez**. En rojo, lo que usa el atacante; en verde, lo que usan los tuyos para recuperar los fondos. Lo que solo está al alcance, sin hacer falta, queda en tono suave.

Las desgracias suelen hacer daño **combinadas**. Con dos placas y el dispositivo, ninguna pérdida suelta basta; estas tres juntas, sí:

> ▶ En la app, con el ejemplo «Acero en casa y copia en el banco»: *Olvidar el PIN y perder las dos placas*.

El Trezor sigue en casa, pero sin su PIN no firma; y sin ninguna de las dos placas no queda copia. Prueba a quitar un suceso (✕ en el panel) y mira cómo vuelve a ser recuperable.

No todos los robos necesitan a una persona. En un 2 de 3 en el que las tres frases semilla pasan por la misma SeedSigner, la vía más barata es un firmware malicioso de su fabricante, que filtraría las semillas al firmar:

> ▶ En la app, con el ejemplo «2 de 3 con una SeedSigner»: *Simular un firmware malicioso en la SeedSigner*.

Por eso conviene que cada key pase por dispositivos distintos, o que tengan **anti-exfil**, que impide esa filtración. La seguridad de este esquema se queda en **65** (aceptable).

- **Desde el análisis**: cada vía de las listas se puede pulsar para simularla, y ‹ › recorren las demás.
- **¿Y si se pierde?**: al simular una desgracia, lo que usa la recuperación lleva este atajo para añadir también su pérdida.
- **Por qué**: debajo del resultado, el árbol de cada firma y cada secreto, y de dónde sale.
- **Privacidad**: si el atacante consigue todas las xpubs (por ejemplo, del descriptor), se avisa de que vería tu saldo y tus movimientos aunque no pueda gastar.

> 💡 Para quitar la simulación del mapa, pulsa la ✕ de su recuadro.

<a id="casos"></a>

## 5. Casos guiados

Doce esquemas típicos, de lo más habitual a lo más cuidado. Están todos en el selector de arriba, en la galería. Cada paso arregla algo del anterior… y casi siempre empeora otra cosa.

**1. Papel en el cajón.** Un Trezor en casa y la frase semilla en un papel, en el mismo sitio.

> ▶ En la app, con el ejemplo «Papel en el cajón»: *Una intrusión en casa*.

Quien entre se lleva el papel, y con él todo: seguridad **35** (flojo). Y un incendio quema a la vez el papel y el Trezor: resiliencia **41** (flojo).

**2. Foto en la nube.** En vez de papel, una foto de la frase semilla en iCloud, sin cifrar. El error clásico.

> ▶ En la app, con el ejemplo «Foto en la nube»: *Un hackeo de la cuenta de iCloud*.

Ni siquiera hace falta ir a tu casa: se hace en remoto y a escala. Seguridad **23** (muy mal); y como tu pareja ni entra en tu iCloud ni sabe el PIN, herencia **0** (muy mal).

**3. Acero en la caja fuerte.** La frase semilla en una placa de acero, dentro de la caja fuerte de casa.

> ▶ En la app, con el ejemplo «Acero en la caja fuerte»: *Una traición de quien entra en la caja fuerte*.

El acero resiste el fuego y la caja fuerte frena al ladrón, pero quien conoce la caja (tu pareja, aquí) puede abrirla, y forzarla tampoco es imposible. Seguridad **49** (flojo), resiliencia **61** (aceptable).

**4. Una segunda placa en el banco.** Ahora una sola desgracia ya no basta: resiliencia **77** (bueno) y herencia **82** (bueno). La seguridad no cambia (**49** (flojo)): el robo más barato sigue estando en casa.

**5. Una passphrase.** Con ella, la frase semilla sola ya no sirve: hay que obligarte a decirla, o encontrar también su copia. Con la passphrase apuntada en casa de tus padres, seguridad **71** (bueno), pero resiliencia **45** (flojo): ahora hay dos cosas que no puedes perder. Si solo la sabes tú, la resiliencia cae a **28** (flojo) y la herencia a **0** (muy mal).

> ▶ En la app, con el ejemplo «Passphrase con copia aparte»: *Con passphrase: lo más barato ya es la llave inglesa*.

**6. Una Coldcard afectada.** Como el paso 3, pero la frase semilla se generó sin dados en una Coldcard Q con el firmware del fallo de entropía de 2026: se puede adivinar desde cualquier parte.

> ▶ En la app, con el ejemplo «Coldcard afectada»: *Adivinar la semilla por el fallo publicado*.

Seguridad **12** (muy mal): da igual lo bien guardada que esté. Actualizar el firmware no la arregla; hay que mover los fondos a una frase semilla nueva. Lo evitan los dados (tiradas suficientes, mezcladas al generarla) o una passphrase.

> 💡 Mezclar dados con el generador del dispositivo protege de sus fallos, pero normalmente no se puede verificar: la parte del dispositivo es secreta. Para poder verificar, genera la frase semilla solo con tu entropía (dados o moneda) y recalcúlala en otra herramienta.

**7. Multisig 2 de 3, todo en casa.** Tres dispositivos y tres placas, pero todo en el mismo sitio: quien llega a casa (o tu pareja) lo tiene todo. Seguridad **53** (aceptable), resiliencia **65** (aceptable). Un multisig sin distribuir se parece mucho a un single-sig.

**8. 2 de 3 distribuido.** Los dispositivos en casa y cada placa en un sitio distinto (caja fuerte, banco y casa de tus padres), con su descriptor. Ya ningún sitio basta por sí solo, y lo más barato es obligarte a ti a firmar en casa.

> ▶ En la app, con el ejemplo «2 de 3 distribuido»: *El robo más barato del 2 de 3 distribuido*.

Seguridad **71** (bueno), resiliencia **72** (bueno), usabilidad **100** (excelente), herencia **77** (bueno): bueno en todo. Es el esquema «de manual».

**9. Sin plan de herencia.** El mismo, pero tu pareja no puede entrar ni en el banco ni en casa de tus padres: herencia **0** (muy mal). Que los herederos puedan llegar es parte del diseño, no un añadido.

**10. Con custodio.** La tercera placa la guarda un abogado en su despacho. Con una sola key no puede robar, y su copia aleja más las desgracias: resiliencia **75** (bueno).

> 💡 Nada de esto es «la respuesta»: es un mapa de compromisos. Abre el que se parezca al tuyo, cambia una cosa cada vez y mira qué nota sube y cuál baja.

<a id="montar"></a>

## 6. Montar tu esquema

Empieza con **Archivo → Nuevo esquema** o, mejor, abre el ejemplo que más se parezca al tuyo y cámbialo. Todo se edita en la pestaña **Esquema** o pulsando cualquier elemento del mapa; Ctrl+Z deshace.

- **Política**: cuántas keys hacen falta para gastar (1 de 1, 2 de 3…). **+ Key** añade otra. En cada key: si lleva passphrase y cómo es (nunca cuál), y su procedencia: con qué entropía y en qué dispositivo se generó. Ahí se detectan los fallos de entropía publicados.
- **Ubicaciones**: casa, banco, una nube, un portátil… Las físicas pueden ser caja fuerte o caja del banco, y estar dentro de otra (la caja fuerte dentro de casa). En cada una, quién puede entrar: siempre, solo tras el fallecimiento de alguien, o si queda incapacitado.
- **Dispositivos y backups**: con el + de cada ubicación. En los dispositivos, el modelo (del catálogo: rellena lo que sabe y avisa de fallos conocidos), el firmware, qué keys guarda, el PIN y si tiene PIN de coacción. En los backups, el soporte (papel, acero…) y qué contienen: la frase semilla de una key, una passphrase, un PIN, el descriptor…
- **Personas**: titular, heredero, custodio… y qué saben de memoria (un PIN, una passphrase). Lo que sabe alguien puede revelarlo bajo coacción, y se pierde si lo olvida, fallece o queda incapacitado.

Arriba de la pestaña Esquema aparecen los **avisos**: cosas que probablemente no quieres, como un dispositivo con un PIN que nadie sabe (no serviría para firmar) o una passphrase sin indicar cómo es (se trata como débil).

> 💡 **Guárdalo cifrado.** Ctrl+S lo guarda en este navegador con una contraseña; **Exportar cifrado** lo descarga como fichero .llave. Exportar sin cifrar (.json) es solo para trabajar con él: bórralo después.

No hace falta que sea perfecto a la primera: monta lo esencial, mira las notas y prueba variantes (mover una placa al banco, añadir una passphrase, cambiar quién entra dónde). Las notas se recalculan al momento.

<a id="conceptos"></a>

## 7. Conceptos

- **Key**: cada una de las claves que pueden firmar (K1, K2…). Su **frase semilla** son las palabras que la recuperan.
- **Passphrase**: una palabra o frase extra que, junto a la frase semilla, da otra key. Sin ella, la frase semilla sola no firma.
- **Multisig k de n**: hacen falta k firmas de n keys. Para gastar también hacen falta las **xpubs** de todas las keys, que suelen ir juntas en el **descriptor**.
- **Dispositivo stateful**: guarda la key dentro (Coldcard, Trezor…). **Stateless**: no guarda nada; se le carga la frase semilla para cada firma (SeedSigner…).
- **PIN de coacción**: un segundo PIN que, bajo amenaza, abre una cartera señuelo o borra el dispositivo. Encarece la llave inglesa, pero no la evita.
- **Anti-exfil**: protección de algunos dispositivos que impide que un firmware malicioso filtre la semilla dentro de las firmas.
- **Llave inglesa**: obligar a alguien por la fuerza a firmar o a revelar lo que sabe. Da nombre a la herramienta.
- **Esfuerzo**: lo que le cuesta un ataque al atacante (riesgo, tiempo, dinero). Los de una misma vía se suman.
- **Rareza**: lo improbable que es una desgracia, en órdenes de magnitud. Las que tienen que coincidir se suman.
- **Bloqueo temporal**: los fondos quedan inmovilizados mientras alguien está incapacitado, pero se recuperan cuando heredan.
- **Custodio**: alguien de confianza que guarda algo (una placa, un descriptor) sin ser titular ni heredero.
- **Entropía**: el azar con el que se genera la frase semilla (el generador del dispositivo, dados, una moneda…). **Verificar** es recalcularla en otra herramienta para comprobar que sale de ese azar.

<a id="limites"></a>

## 8. Límites conocidos

Un modelo siempre simplifica. Estos son los atajos conscientes de llave-inglesa:

- Las rarezas y los esfuerzos son estimaciones de orden de magnitud, iguales para todos: no dependen de tu edad, tu zona o tu casa. Las desgracias se tratan como independientes.
- Se buscan combinaciones de hasta tres ataques o desgracias a la vez.
- La seguridad mira el robo más barato y los casi igual de baratos: endurecer una vía más cara no mueve la nota.
- La fortaleza de una passphrase son tres niveles aproximados (débil, frase, aleatoria larga); no se mide su entropía.
- El metal se supone acero: una placa de aluminio o latón no resistiría un incendio. Tampoco se distinguen una bolsa estanca o una caja fuerte ignífuga.
- La protección son tres niveles (ninguna, caja fuerte, caja del banco), sin distinguir la calidad de la caja ni alarmas. Las ubicaciones se anidan un solo nivel.
- No se sabe dónde vive cada persona: la llave inglesa puede hacerse en cualquier sitio al que la víctima tenga acceso. Coaccionar a dos personas a la vez cuenta como dos ataques.
- No se modela el ordenador o el móvil con el que se firma: los fallos explotables desde un ordenador con malware solo se avisan.
- El catálogo de dispositivos y sus fallos conocidos no se actualiza solo: cada versión lleva el suyo, con su fecha.
- Todavía no hay timelocks (herencia con espera, claves de recuperación con retraso).
- Con muchos dispositivos y ubicaciones el análisis tarda unos segundos: es exhaustivo.

<a id="verificar"></a>

## 9. Privacidad y verificación

- **Sin red**: la política de seguridad del contenido de la página prohíbe cualquier petición. No hay cuentas, ni analítica, ni recursos de terceros.
- **Cifrado**: tu esquema se guarda en el navegador o en un fichero .llave cifrado con AES-256-GCM y una clave que sale de tu contraseña (PBKDF2). Sin la contraseña no hay forma de abrirlo, ni para ti.
- **Sin conexión**: cada versión se publica también como zip para usarla en tu equipo sin internet.
- **Verificable**: el código es abierto y el build es reproducible. Recompilando una versión se obtienen exactamente los mismos ficheros que se publican, y se puede comparar con la web fichero a fichero.

Cómo hacerlo, paso a paso: [Verificar llave-inglesa](https://github.com/PrvsatsDev/llave-inglesa/blob/main/docs/VERIFICAR.md). El código y las versiones: [GitHub](https://github.com/PrvsatsDev/llave-inglesa).
