# 🔧 llave-inglesa

**Pon a prueba la custodia de tus bitcoins antes de que lo haga otro.**

llave-inglesa es un simulador de esquemas de custodia Bitcoin (single-sig, passphrase, multisig).
Describes qué keys, dispositivos y backups tienes, dónde están y quién sabe qué, y la herramienta
calcula:

- **Seguridad**: las formas más baratas de robarte (una intrusión, una llave inglesa, una cuenta
  en la nube hackeada, un RNG con fallo…) y cuánto esfuerzo le cuesta al atacante.
- **Resiliencia**: qué desgracias, solas o combinadas, te dejarían sin fondos (un incendio,
  perder una placa, olvidar la passphrase…) y cuán probables son.
- **Usabilidad**: a cuántos sitios tienes que ir para firmar de forma segura.
- **Herencia**: si tus herederos llegarían a los fondos y qué podría impedirlo.

Cada resultado explica **por qué**, y cualquier combinación se puede **simular en el mapa**.

![llave-inglesa simulando una llave inglesa en casa sobre un multisig 2 de 3 distribuido](docs/img/llave-inglesa.png)

## Privacidad y seguridad

- **Nunca escribas frases semilla, claves privadas ni passphrases reales: no hacen falta.** El
  modelo solo describe *qué* existe, *dónde* está y *quién* lo sabe.
- **Sin red**: la aplicación no puede hacer ninguna petición (política de seguridad del contenido
  con `connect-src 'none'`). Sin cuentas, sin telemetría, sin CDNs; las fuentes van incluidas.
- Aun sin secretos, tu esquema es un **mapa del tesoro**. Por eso se guarda **cifrado**: en el
  navegador o en un fichero `.llave`, con AES-256-GCM y una clave derivada de tu contraseña con
  PBKDF2-SHA256 (600 000 iteraciones). Exportar en claro (`.json`) pide confirmación.

## Cómo usarla

La versión publicada estará enlazada aquí. Mientras tanto, se ejecuta en local:

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

Requiere Node 22 o posterior. Al abrirla por primera vez verás una bienvenida y 15 ejemplos, desde
"papel en el cajón" hasta un multisig 2 de 3 distribuido, cada uno con lo que enseña.

Todo lo que la herramienta modela, y sus límites conocidos, está en
[docs/CAPACIDADES.md](docs/CAPACIDADES.md). Cómo se calibraron las puntuaciones, con la galería
de ejemplos, en [docs/CALIBRACION.md](docs/CALIBRACION.md).

## Para desarrolladores

Monorepo con npm workspaces y TypeScript estricto.

```
packages/domain   Esquema del documento (zod = tipos + validación), integridad y operaciones de edición puras
packages/engine   Motor puro y determinista: inferencia con justificaciones, ataques, desgracias,
                  conjuntos mínimos de corte (árbol de fallos) y puntuaciones (parámetros en score.ts)
packages/text     Todos los textos en español, compartidos por la web y la CLI
packages/vault    Cifrado de documentos (AES-256-GCM + PBKDF2) y lectura de ficheros
apps/web          React + React Flow + zustand; el motor corre en un Web Worker
apps/cli          Informe en terminal
fixtures/         Esquemas de ejemplo y la galería de calibración, usados también como tests
```

El motor no produce texto: devuelve estructuras y cada interfaz decide cómo contarlas. La
política de gasto es un árbol tipo Miniscript, preparada para añadir timelocks.

```sh
npm run check        # typecheck + tests unitarios y de propiedades (fast-check)
npm run e2e          # pruebas en Chromium contra el build de producción
npm run build        # web estática en apps/web/dist
npm run analyze -- fixtures/todo-en-casa.json   # informe en terminal
```

## Licencia

[MIT](LICENSE).
