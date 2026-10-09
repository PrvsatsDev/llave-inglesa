/** Quién hace llave-inglesa y cómo apoyarlo. Enlaces normales: la app no hace ninguna petición por su cuenta. */
export const AUTOR = {
  nombre: 'Psats', // texto-ok: seudónimo
  x: 'https://x.com/prvSats',
  nostr: 'https://primal.net/p/npub1prv54tsy2tae3a5mn2ev8gvkuylwmwqcx3uj3zja0gm3ed5vzrys9cj2d0',
  lightning: 'unluckyhand034@walletofsatoshi.com',
  /** Silent payments (BIP 352): on-chain sin reutilizar direcciones. */
  silentPayment: 'sp1qqdlemcyjr48vrc20gd2vnm7gffv3hr9q0xjn3pv7gla2euyanmjtuqlwhnqp05clsnse3jn42ccpueqdjafkrrxym84e37jqgs257w3eu5uvul77',
  repo: 'https://github.com/PrvsatsDev/llave-inglesa',
} as const;
