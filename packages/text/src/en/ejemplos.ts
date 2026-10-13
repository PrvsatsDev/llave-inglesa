import type { EJEMPLOS as es } from '../es/ejemplos.ts';

/**
 * The examples (`fixtures/`) in English, by their Spanish text: setup name and description, and names of people,
 * locations and backups. Device names (products) and key labels stay as they are.
 */
export const EJEMPLOS: typeof es = {
  // ---------- Setups ----------
  'Todo a mano en casa': 'Everything at hand at home',
  'Multisig 2 de 3. En casa: Keystone 3 Pro con K1 en memoria + placa de metal con K2 + SeedSigner. Muy cómodo para firmar desde un solo sitio… y para un atacante con una llave inglesa.':
    'Multisig 2 of 3. At home: a Keystone 3 Pro holding K1 + a metal plate with K2 + a SeedSigner. Very convenient for signing from a single place… and for an attacker with a wrench.',
  'Distribuido 2 de 3': 'Distributed 2 of 3',
  'Multisig 2 de 3 con cada semilla en un sitio distinto y firma con SeedSigner. Menos cómodo, pero ninguna ubicación ni persona aislada basta para robar.':
    'Multisig 2 of 3 with each seed in a different place, signing with a SeedSigner. Less convenient, but no single location or person is enough to steal.',
  'Single-sig + passphrase': 'Single-sig + passphrase',
  'Un Trezor en casa, semilla en metal en el banco y passphrase memorizada con copia en papel en casa de los padres.':
    'A Trezor at home, the seed on metal at the bank, and a memorized passphrase with a paper copy at the parents’ house.',

  'Papel en el cajón': 'Paper in the drawer',
  'Trezor en casa y la frase semilla en papel en un cajón. Lo más habitual al empezar: quien entre en casa se la lleva, y un incendio la destruye.':
    'A Trezor at home and the seed phrase on paper in a drawer. The most common way to start: whoever gets into the house takes it, and a fire destroys it.',
  'Foto en la nube': 'Photo in the cloud',
  'Trezor en casa y una foto de la frase semilla en iCloud, sin cifrar. El error clásico: basta con hackear la cuenta.':
    'A Trezor at home and an unencrypted photo of the seed phrase in iCloud. The classic mistake: hacking the account is enough.',
  'Acero en la caja fuerte': 'Steel in the safe',
  'Como el papel en el cajón, pero la frase semilla en una placa de acero dentro de la caja fuerte. Un single-sig hecho con cuidado.':
    'Like the paper in the drawer, but with the seed phrase on a steel plate inside the home safe. A carefully done single-sig.',
  'Acero en casa y copia en el banco': 'Steel at home and a copy at the bank',
  'La placa de la caja fuerte y una segunda en la caja del banco. Redundancia geográfica: un incendio ya no lo pierde todo.':
    'The plate in the home safe and a second one in the bank box. Geographic redundancy: a fire no longer loses everything.',
  'Passphrase con copia aparte': 'Passphrase with a separate copy',
  'La placa en la caja fuerte y una passphrase (una frase) que el titular sabe de memoria y tiene apuntada en casa de sus padres. La frase semilla sola ya no basta para robar.':
    'The plate in the home safe and a passphrase (a phrase) that the owner knows by heart and has written down at their parents’ house. The seed phrase alone is no longer enough to steal.',
  'Passphrase solo en la memoria': 'Passphrase only in memory',
  'La placa en la caja fuerte y una passphrase aleatoria larga que solo sabe el titular. Muy seguro y muy frágil: si la olvida o fallece, se pierde todo.':
    'The plate in the home safe and a long random passphrase that only the owner knows. Very secure and very fragile: if they forget it or die, everything is lost.',
  'Coldcard afectada': 'Affected Coldcard',
  'Como el acero en la caja fuerte, pero la frase semilla se generó sin dados en una Coldcard Q con el firmware del fallo de entropía de 2026: se puede adivinar en remoto.':
    'Like the steel in the safe, but the seed phrase was generated without dice on a Coldcard Q with the firmware of the 2026 entropy flaw: it can be guessed remotely.',
  '2 de 3 todo en casa': '2 of 3 all at home',
  'Tres dispositivos y sus tres placas, todo en casa. Multisig sin distribuir: quien llegue a casa lo tiene todo.':
    'Three devices and their three plates, all at home. Multisig without distribution: whoever gets into the house has everything.',
  '2 de 3 distribuido': '2 of 3 distributed',
  'Los dispositivos en casa y cada placa, con su descriptor, en un sitio distinto: caja fuerte, banco y casa de los padres. El esquema «de manual».':
    'The devices at home and each plate, with its descriptor, in a different place: home safe, bank and parents’ house. The “textbook” setup.',
  '2 de 3 con custodio': '2 of 3 with a custodian',
  'Como el distribuido, pero la tercera placa la guarda un abogado en su despacho. Un tercero de confianza en lugar de la familia. Del abogado no se indica dónde vive (en el despacho no vive, pero trabaja allí): se le puede coaccionar en él sin recargo.':
    'Like the distributed one, but a lawyer keeps the third plate at their office. A trusted third party instead of the family. Where the lawyer lives is not set (they do not live at the office, but they work there): they can be coerced there at no extra cost.',
  '2 de 3 sin plan de herencia': '2 of 3 without an inheritance plan',
  'Como el distribuido, pero la pareja no puede entrar ni en el banco ni en casa de los padres. Seguro para el titular, inútil para los herederos.':
    'Like the distributed one, but the partner can get into neither the bank nor the parents’ house. Secure for the owner, useless for the heirs.',
  '2 de 3 con una SeedSigner': '2 of 3 with one SeedSigner',
  'Sin dispositivos que guarden keys: una sola SeedSigner con la que se firma cargando cada frase semilla. Todo pasa por el mismo aparato, y para firmar hay que ir a buscar las placas.':
    'No devices that store keys: a single SeedSigner that signs by loading each seed phrase. Everything goes through the same device, and signing means fetching the plates.',

  'Key de recuperación de la heredera': 'Heir’s recovery key',
  'Single-sig para el día a día, más una segunda key en casa de la hija que solo vale si las monedas pasan 6 meses sin moverse. El titular las mueve cada 3 meses. Si pierde su key, o fallece, la hija recupera los fondos esperando.':
    'Single-sig for everyday use, plus a second key at the daughter’s house that only works if the coins go 6 months without moving. The owner moves them every 3 months. If they lose their key, or die, the daughter recovers the funds by waiting.',
  '2 de 3 que se relaja con el tiempo': '2 of 3 that relaxes over time',
  'Como el 2 de 3 distribuido, pero si las monedas pasan un año sin moverse basta una sola key. El titular las mueve cada 6 meses. Perder dos keys ya no lo pierde todo: se recupera esperando.':
    'Like the distributed 2 of 3, but if the coins go a year without moving a single key is enough. The owner moves them every 6 months. Losing two keys no longer loses everything: it is recovered by waiting.',
  '2 de 3 que se amplía con el tiempo': '2 of 3 that expands over time',
  'Como el 2 de 3 distribuido, más una cuarta key en el despacho del abogado que solo vale pasado un año sin mover las monedas, y siempre junto a otra: sigue siendo multifirma. El titular las mueve cada 6 meses.':
    'Like the distributed 2 of 3, plus a fourth key at the lawyer’s office that only works after a year without moving the coins, and always together with another one: it is still multisig. The owner moves them every 6 months.',

  // ---------- People ----------
  Yo: 'Me',
  Pareja: 'Partner',
  Hermano: 'Brother',
  Abogado: 'Lawyer',
  Hija: 'Daughter',

  // ---------- Locations ----------
  Casa: 'Home',
  'Caja fuerte': 'Home safe',
  'Caja del banco': 'Bank box',
  'Caja en banco': 'Bank box',
  'Casa de mi hermano': 'My brother’s house',
  'Casa de mis padres': 'My parents’ house',
  'Casa padres': 'Parents’ house',
  'Despacho de abogado': 'Law office',
  'Casa de la hija': 'Daughter’s house',

  // ---------- Backups ----------
  'Backup K1': 'K1 backup',
  'Backup K2': 'K2 backup',
  'Backup K3': 'K3 backup',
  'Backup K4': 'K4 backup',
  'Backup Passphrase': 'Passphrase backup',
  'Placa de metal K1': 'Metal plate K1',
  'Placa de metal K2': 'Metal plate K2',
  'Arandelas K3': 'Washers K3',
  'Passphrase en papel': 'Passphrase on paper',
  'Descriptor impreso': 'Printed descriptor',
  'Descriptor cf': 'Descriptor (safe)',
  'Descriptor cb': 'Descriptor (bank)',
  'Descriptor hija': 'Descriptor (daughter)',
  'Descriptor abogado': 'Descriptor (lawyer)',
};
