import type { GUIA as es } from '../es/guia.ts';
import type { Metrica, Trozo } from '../tipos.ts';

/**
 * The user guide, as data. Same chapters, blocks, examples, scenarios and cited figures as es/guia.ts (a test checks
 * it); only the text changes. Button and menu names are the ones the English interface shows.
 */

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

export const GUIA: typeof es = [
  {
    id: 'que-es',
    titulo: 'What it is and what it is not',
    resumen: 'A simulator of your custody: what it does, what it does not, and why it never needs your secrets.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'llave-inglesa is a ',
          n('simulator'),
          '. You describe how you keep your bitcoin (which keys there are, on which devices and backups, where everything is and who knows what) and the tool methodically searches for every way it could go wrong.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          [n('Theft'), ': break-ins, the wrench attack, a betrayal, a hacked cloud account, a flaw in a vendor’s random number generator…'],
          [n('Loss'), ': a fire, a flood, losing a plate, forgetting a passphrase, dying or becoming incapacitated…'],
          [n('Day to day'), ': how many places you have to visit to sign.'],
          [n('Inheritance'), ': whether your heirs would reach the funds, and what could stop them.'],
        ],
      },
      {
        tipo: 'nota',
        texto: [
          n('Never type in real seed phrases, private keys, or passphrases.'),
          ' They are not needed: the model only says that a plate holds the seed phrase of K1, never what it is.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Everything happens in your browser: the app cannot make any network request, and there are no accounts and no telemetry. Even without secrets, your setup is a ',
          n('treasure map'),
          ' (where every copy is and who knows each PIN), so keep it encrypted (',
          n('File → Save in this browser'),
          ' or ',
          n('Export encrypted'),
          '), or use it as a training tool without entering your real plan and without saving anything.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('What it is not'),
          ': it is not a wallet, it does not touch the Bitcoin network or your funds, and it does not replace your judgment. It is a model: the scores compare setups with each other and explain their weak points, but the real odds depend on your life. What the engine does not take into account is in ',
          cap('limites', 'Known limits'),
          '.',
        ],
      },
    ],
  },
  {
    id: 'primeros-pasos',
    titulo: 'Getting started',
    resumen: 'Five minutes with an example: the four scores, the map, and your first simulation.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Start with a ready-made setup: a 2-of-3 multisig with almost everything at home. It is convenient, and that is exactly why it has weak points that show right away.',
        ],
      },
      { tipo: 'ejemplo', ejemplo: CASA, texto: 'Open “Everything at hand at home”' },
      {
        tipo: 'parrafo',
        texto: [n('The four scores'), ', at the top of this column, sum up the setup from 0 to 100:'],
      },
      {
        tipo: 'lista',
        items: [
          [n('Security'), ' (', cifra(CASA, 'security'), '): what it costs an attacker to rob you by the cheapest route.'],
          [n('Resilience'), ' (', cifra(CASA, 'resilience'), '): how unlikely it is to lose everything through loss events (a fire, losing a plate, forgetting something…).'],
          [n('Usability'), ' (', cifra(CASA, 'usability'), '): how many places you have to go to in order to sign.'],
          [n('Inheritance'), ' (', cifra(CASA, 'inheritance'), '): whether your heirs would reach the funds, and how fragile that path is.'],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Later, outside the guide, you can click any score to see where it comes from: the base, what is subtracted and, folded away, how it is calculated. If you leave, ',
          n('File → User guide'),
          ' brings you back to this same point.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('The map'),
          ' shows the locations at the top, with what is in each one (devices and backups) and the keys they hold (K1, K2, K3). At the bottom, the people, with what they know by heart. The lines say who can get in where; dashed ones, only after a death.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [n('Your first simulation'), ': what is the cheapest way to steal from this setup?'],
      },
      {
        tipo: 'simular',
        ejemplo: CASA,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'Simulate a wrench attack on Me at Home',
      },
      {
        tipo: 'parrafo',
        texto: [
          'In red, what the attacker uses: forced to give the PIN, Me unlocks the Coldcard (K1), and the K2 plate is in the same place. Two of three: they can spend. It is a single action, which is why security stays at ',
          cifra(CASA, 'security'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'The ',
          n('Simulate'),
          ' tab always explains ',
          n('why'),
          ': each signature, each secret, and where the attacker gets it from.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: ['Now a loss event: a fire at home.'],
      },
      {
        tipo: 'simular',
        ejemplo: CASA,
        escenario: { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }] },
        texto: 'Simulate a fire at Home',
      },
      {
        tipo: 'parrafo',
        texto: [
          'The K2 steel plate survives and, with the K1 one at the bank, everything is recovered. Click ',
          n('What if it does not survive?'),
          ' next to the plate to see what would happen if it were lost too.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'You have seen the essentials. From here you can change anything in the setup and watch the scores move, or build your own from ',
          n('File → New setup'),
          '.',
        ],
      },
    ],
  },
  {
    id: 'notas',
    titulo: 'How to read the scores',
    resumen: 'What each of the four scores measures, with examples that go from one end to the other.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Each score goes from 0 to 100 and is read in five bands: ',
          n('very poor'),
          ' (under 25), ',
          n('weak'),
          ' (up to 50), ',
          n('fair'),
          ' (up to 70), ',
          n('good'),
          ' (up to 85), and ',
          n('excellent'),
          '. The exact weights of each calculation are in the analysis of each score, under “How it is calculated”.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Security'),
          ': what the cheapest theft route costs the attacker. Each attack has an effort (breaking into a house costs little; the wrench attack, quite a bit more) and a route can combine several. If there are other routes almost as cheap, it subtracts a little: more doors for the thief.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: PAPEL,
        escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] },
        texto: 'Paper in the drawer: breaking into the house is enough',
      },
      {
        tipo: 'parrafo',
        texto: ['With the seed phrase on paper at home, any burglar takes it: security ', cifra(PAPEL, 'security'), '.'],
      },
      {
        tipo: 'simular',
        ejemplo: SOLO_MEMORIA,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'Passphrase only in memory: it takes a wrench attack',
      },
      {
        tipo: 'parrafo',
        texto: [
          'If besides the plate it takes a passphrase that only you know, breaking in is no longer enough: they have to force you to talk. Security ',
          cifra(SOLO_MEMORIA, 'security'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Resilience'),
          ': how unlikely it is to lose everything forever. Each loss event has a rarity (forgetting something is common; a fire, much less so) and those that have to coincide add up. The most likely loss sets the score; the others subtract a little.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: SOLO_MEMORIA,
        escenario: { kind: 'loss', events: [{ type: 'forget', person: 'yo' }] },
        texto: 'The same setup, if you forget the passphrase',
      },
      {
        tipo: 'parrafo',
        texto: [
          'The passphrase that protected you from the thief is also your weak point: forgetting it loses everything. Resilience ',
          cifra(SOLO_MEMORIA, 'resilience'),
          '. With two steel plates, one at home and another at the bank, it rises to ',
          cifra(ACERO_BANCO, 'resilience'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Usability'),
          ': how many places you have to go to in order to sign safely, with your devices. A location and what is inside it (home and its safe) count as one visit.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          ['2 of 3 with all three devices at home: one visit, usability ', cifra(DISTRIBUIDO, 'usability'), '.'],
          [
            '2 of 3 with a single SeedSigner and no devices that store keys: to sign you have to go fetch the plates, including the one at the bank. Usability ',
            cifra(SEEDSIGNER, 'usability'),
            '.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('Inheritance'),
          ': whether, after your death, your heirs can recover the funds and how many places they would have to go to; minus how fragile that path is (losing the only copy within their reach, the heir dying too…).',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: SIN_HERENCIA,
        escenario: { kind: 'loss', events: [{ type: 'death', person: 'yo' }] },
        texto: '2 of 3 without an inheritance plan: your death',
      },
      {
        tipo: 'parrafo',
        texto: [
          'A multisig that is flawless for you can be useless for your family: if your partner can get into neither the bank nor your parents’ house, they would inherit nothing. Inheritance ',
          cifra(SIN_HERENCIA, 'inheritance'),
          '. The same setup, with your partner able to get into the bank and your parents’ house after your death: ',
          cifra(DISTRIBUIDO, 'inheritance'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          n('There is no 100 in everything.'),
          ' Signing in a single place clashes with the wrench attack; making it easy for your heirs clashes with making it easy for a thief; every extra copy is another door. Aim to be good at everything and choose where to give in a little: nothing should be sacrificed completely.',
        ],
      },
    ],
  },
  {
    id: 'simular',
    titulo: 'Simulate',
    resumen: 'Try attacks and loss events, combine them, and read on the map what would happen and why.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'The ',
          n('Simulate'),
          ' tab tries any event on the map: start with an attack or a loss event and add others with ',
          n('Add another event at the same time'),
          '. In red, what the attacker uses; in green, what your people use to recover the funds. What is only within reach, without being needed, stays in a soft tone.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Loss events usually do harm ',
          n('combined'),
          '. With two plates and the device, no single loss is enough; these three together are:',
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
        texto: 'Forget the PIN and lose both plates',
      },
      {
        tipo: 'parrafo',
        texto: [
          'The Trezor is still at home, but without its PIN it does not sign; and without either of the two plates there is no copy left. Try removing an event (✕ on the panel) and watch it become recoverable again.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Not every theft needs a person. In a 2 of 3 where all three seed phrases go through the same SeedSigner, the cheapest route is to slip it malicious firmware (a fake update that arrives by phishing, a compromised vendor…), which would leak the seeds while signing:',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: SEEDSIGNER,
        escenario: { kind: 'attack', atoms: [{ type: 'malicious-firmware', vendor: 'SeedSigner' }] },
        texto: 'Simulate malicious firmware on the SeedSigner',
      },
      {
        tipo: 'parrafo',
        texto: [
          'That is why it is worth having each key go through different devices, or having devices with ',
          n('anti-exfil'),
          ', which prevents that leak. The security of this setup stays at ',
          cifra(SEEDSIGNER, 'security'),
          '.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          [n('From the analysis'), ': you can click each route in the lists to simulate it, and ‹ › go through the others.'],
          [n('What if it is lost?'), ': when simulating a loss event, whatever the recovery uses has this shortcut to add its loss too.'],
          [n('Why'), ': below the result, the tree of each signature and each secret, and where it comes from.'],
          [n('Privacy'), ': if the attacker gets all the xpubs (from the descriptor, for example), you are warned that they would see your balance and your transactions even if they cannot spend.'],
        ],
      },
      {
        tipo: 'nota',
        texto: ['To remove the simulation from the map, click the ✕ on its box.'],
      },
    ],
  },
  {
    id: 'casos',
    titulo: 'Guided cases',
    resumen: 'From the seed phrase on paper to a distributed multisig: what fails at each step and what fixes it.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Twelve typical setups, from the most common to the most careful. They are all in the selector at the top, in the gallery. Each step fixes something from the previous one… and almost always makes something else worse. None of them is meant to be anyone’s setup: they are examples to discover all the variables that can affect a plan. Work on yours.',
        ],
      },
      { tipo: 'parrafo', texto: [n('1. Paper in the drawer.'), ' A Trezor at home and the seed phrase on paper, in the same place.'] },
      {
        tipo: 'simular',
        ejemplo: PAPEL,
        escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] },
        texto: 'A break-in at home',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Whoever gets in takes the paper, and everything with it: security ',
          cifra(PAPEL, 'security'),
          '. And a fire burns the paper and the Trezor at once: resilience ',
          cifra(PAPEL, 'resilience'),
          '.',
        ],
      },
      { tipo: 'parrafo', texto: [n('2. Photo in the cloud.'), ' Instead of paper, an unencrypted photo of the seed phrase in iCloud. The classic mistake.'] },
      {
        tipo: 'simular',
        ejemplo: FOTO,
        escenario: { kind: 'attack', atoms: [{ type: 'burglary', location: 'nueva-ubicacion' }] },
        texto: 'A hack of the iCloud account',
      },
      {
        tipo: 'parrafo',
        texto: [
          'They do not even need to come to your house: it is done remotely and at scale. Security ',
          cifra(FOTO, 'security'),
          '; and since your partner neither gets into your iCloud nor knows the PIN, inheritance ',
          cifra(FOTO, 'inheritance'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [n('3. Steel in the safe.'), ' The seed phrase on a steel plate, inside the home safe.'],
      },
      {
        tipo: 'simular',
        ejemplo: ACERO,
        escenario: { kind: 'attack', atoms: [{ type: 'insider', person: 'nueva-persona' }] },
        texto: 'A betrayal by someone who can open the safe',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Steel survives fire and the safe slows the thief down, but whoever knows the safe (your partner, here) can open it, and forcing it is not impossible either. Security ',
          cifra(ACERO, 'security'),
          ', resilience ',
          cifra(ACERO, 'resilience'),
          '.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('4. A second plate at the bank.'),
          ' Now a single loss event is no longer enough: resilience ',
          cifra(ACERO_BANCO, 'resilience'),
          ' and inheritance ',
          cifra(ACERO_BANCO, 'inheritance'),
          '. Security does not change (',
          cifra(ACERO_BANCO, 'security'),
          '): the cheapest theft is still at home.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('5. A passphrase.'),
          ' With it, the seed phrase alone is no longer useful: they have to force you to say it, or find its copy too. With the passphrase written down at your parents’ house, security ',
          cifra(COPIA_APARTE, 'security'),
          ', but resilience ',
          cifra(COPIA_APARTE, 'resilience'),
          ': now there are two things you cannot lose. If only you know it, resilience drops to ',
          cifra(SOLO_MEMORIA, 'resilience'),
          ' and inheritance to ',
          cifra(SOLO_MEMORIA, 'inheritance'),
          '.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: COPIA_APARTE,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'With a passphrase: the cheapest is now the wrench attack',
      },
      {
        tipo: 'parrafo',
        texto: [
          n('6. An affected Coldcard.'),
          ' Like step 3, but the seed phrase was generated without dice on a Coldcard Q with the firmware of the 2026 entropy flaw: it can be guessed from anywhere.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: COLDCARD,
        escenario: { kind: 'attack', atoms: [{ type: 'known-weak-entropy', advisory: 'coldcard-rng-2026' }] },
        texto: 'Guess the seed through the published flaw',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Security ',
          cifra(COLDCARD, 'security'),
          ': it does not matter how well it is kept. Updating the firmware does not fix it; you have to create a new wallet, with good entropy, and move the funds to it. Dice prevent it (enough rolls, mixed in when generating it), and so does a passphrase.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'Mixing dice with the device’s generator protects you from its flaws, but it usually cannot be verified: the device’s part is secret. To be able to verify, generate the seed phrase with your entropy alone (dice or a coin) and recompute it in another tool.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('7. 2-of-3 multisig, all at home.'),
          ' Three devices and three plates, but all in the same place: whoever gets into the house (or your partner) has everything. Security ',
          cifra(TODO_EN_CASA, 'security'),
          ', resilience ',
          cifra(TODO_EN_CASA, 'resilience'),
          '. A multisig that is not distributed is very much like a single-sig.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('8. 2 of 3 distributed.'),
          ' The devices at home and each plate in a different place (home safe, bank and your parents’ house), with its descriptor. No location is enough on its own anymore, and the cheapest option is to force you to sign at home.',
        ],
      },
      {
        tipo: 'simular',
        ejemplo: DISTRIBUIDO,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'The cheapest theft of the distributed 2 of 3',
      },
      {
        tipo: 'parrafo',
        texto: [
          'Security ',
          cifra(DISTRIBUIDO, 'security'),
          ', resilience ',
          cifra(DISTRIBUIDO, 'resilience'),
          ', usability ',
          cifra(DISTRIBUIDO, 'usability'),
          ', inheritance ',
          cifra(DISTRIBUIDO, 'inheritance'),
          ': good at everything, without standing out at anything. It is a reasonable starting point, not a recipe: you may want to give up some usability to gain security, for example by keeping only one of the devices at home, so that signing requires going somewhere else and a wrench attack at home is no longer enough.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('9. No inheritance plan.'),
          ' The same one, but your partner can get into neither the bank nor your parents’ house: inheritance ',
          cifra(SIN_HERENCIA, 'inheritance'),
          '. Making sure the heirs can get there is part of the design, not an add-on.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('10. With a custodian.'),
          ' A lawyer keeps the third plate in their office. With a single key they cannot steal, and their copy pushes loss events further away: resilience ',
          cifra(CUSTODIO, 'resilience'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'None of this is “the answer”: it is a map of trade-offs. Open the one that looks most like yours, change one thing at a time, and see which score goes up and which goes down.',
        ],
      },
    ],
  },
  {
    id: 'montar',
    titulo: 'Building your setup',
    resumen: 'From a blank setup to yours: keys, locations, devices, backups, people, and saving it encrypted.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Start with ',
          n('File → New setup'),
          ' or, better, open the example that looks most like yours and change it. Everything is edited in the ',
          n('Setup'),
          ' tab or by clicking any item on the map; Ctrl+Z undoes.',
        ],
      },
      {
        tipo: 'lista',
        items: [
          [
            n('Policy'),
            ': how many keys it takes to spend (1 of 1, 2 of 3…). ',
            n('+ Key'),
            ' adds another one. On each key: whether it has a passphrase and what it is like (never what it is), and its origin: with what entropy and on which device it was generated. That is where published entropy flaws are detected.',
          ],
          [
            n('Locations'),
            ': home, a bank, a cloud, a laptop… Physical ones can be a home safe or a bank box, and be inside another one (the safe inside the house). For each one, who can get in: always, only after someone’s death, or if they become incapacitated.',
          ],
          [
            n('Devices and backups'),
            ': with the + of each location. For devices, the model (from the catalog: it fills in what it knows and warns about known flaws), the firmware, which keys it stores, which keys it signs with (if the seed phrase is loaded onto it), the PIN, and whether it has a duress PIN. For backups, the medium (paper, steel…) and what they contain: the seed phrase of a key, a passphrase, a PIN, the descriptor…',
          ],
          [
            n('People'),
            ': owner, heir, custodian… and what they know by heart (a PIN, a passphrase). What someone knows they can reveal under coercion, and it is lost if they forget it, die, or become incapacitated.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: ['Once the setup is the way you want it, you can put it in writing. None of this contains secrets, and it is optional:'],
      },
      {
        tipo: 'lista',
        items: [
          [
            n('Wallet descriptor'),
            ' (Setup, below the keys): ',
            n('Import'),
            ' and paste the descriptor you already have (Sparrow, Nunchuk, Coldcard…), or paste the xpub on the panel of each key. It gives you the descriptor and the first receive address: compare it with the one in your wallet and, if it matches, it is right. With the xpubs, the document reveals your balance: keep it encrypted.',
          ],
          [
            n('Print or save as PDF'),
            ': a sheet with the descriptor, its QR code, the keys, and the first addresses. When you print it, add it to the setup where you are going to keep it: it is one more backup. In a multisig, having no copy of the descriptor subtracts resilience, and the heirs not reaching any copy subtracts a lot of inheritance.',
          ],
          [
            n('Letter for the heirs'),
            ' (Analysis › Inheritance): what to gather and where, whom to turn to, and the steps, in plain words and with only what they need. Real names and a personal message are typed in on the fly and not saved. Print it on a printer of your own that is offline, never at a print shop.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'At the top of the Setup tab you will see the ',
          n('warnings'),
          ': things you probably do not want, such as a device with a PIN nobody knows (it could not be used to sign) or a passphrase without saying what it is like (it is treated as weak).',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          n('Keep it encrypted.'),
          ' Ctrl+S saves it in this browser with a password; ',
          n('Export encrypted'),
          ' downloads it as a .llave file. Exporting unencrypted (.json) is only for working with it: delete it afterwards. Then again, you do not need to save anything: you can just tinker, learn, and discover gaps you had not foreseen. If you do not want to save anything, do not save it.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'It does not have to be perfect the first time: build the essentials, look at the scores, and try variations (moving a plate to the bank, adding a passphrase, changing who gets in where). The scores are recalculated instantly.',
        ],
      },
    ],
  },
  {
    id: 'conceptos',
    titulo: 'Concepts',
    resumen: 'The words the tool uses, one line each.',
    bloques: [
      {
        tipo: 'lista',
        items: [
          [n('Key'), ': each of the keys that can sign (K1, K2…). Its ', n('seed phrase'), ' is the words that recover it.'],
          [n('Passphrase'), ': an extra word or phrase that, together with the seed phrase, gives a different key. Without it, the seed phrase alone does not sign.'],
          [n('k-of-n threshold'), ': it takes k signatures from n keys (a 2-of-3 multisig, for example; in 1 of 1, single-sig, one is enough). Spending also needs the ', n('xpubs'), ' of all the keys, which usually go together in the ', n('descriptor'), '.'],
          [n('Stateful device'), ': it stores the key inside (Coldcard, Trezor…). ', n('Stateless'), ': it stores nothing; the seed phrase is loaded onto it for each signature (SeedSigner…).'],
          [n('Duress PIN'), ': a second PIN that, under threat, opens a decoy wallet or wipes the device. It makes the wrench attack more expensive, but does not prevent it.'],
          [n('Anti-exfil'), ': a protection on some devices that stops malicious firmware from leaking the seed inside the signatures.'],
          [n('Wrench attack'), ': forcing someone to sign or to reveal what they know. The tool is named after it (llave inglesa is Spanish for wrench).'],
          [n('Effort'), ': what an attack costs the attacker (risk, time, money). Those on the same route add up.'],
          [n('Rarity'), ': how unlikely a loss event is, in orders of magnitude. Those that have to coincide add up.'],
          [n('Temporary lockout'), ': the funds are frozen while someone is incapacitated, but are recovered when the heirs inherit.'],
          [n('Custodian'), ': someone trusted who keeps something (a plate, a descriptor) without being an owner or an heir.'],
          [n('Entropy'), ': the randomness with which the seed phrase is generated (the device’s generator, dice, a coin…). ', n('Verifying'), ' means recomputing it in another tool to check that it comes from that randomness.'],
        ],
      },
    ],
  },
  {
    id: 'limites',
    titulo: 'Known limits',
    resumen: 'What the engine simplifies or does not take into account, so you can read the scores with judgment.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: ['A model always simplifies. These are the deliberate shortcuts of llave-inglesa:'],
      },
      {
        tipo: 'lista',
        items: [
          ['Rarities and efforts are order-of-magnitude estimates, the same for everyone: they do not depend on your age, your area, or your house. Loss events are treated as independent.'],
          ['It searches combinations of up to three attacks or loss events at once.'],
          ['Security looks at the cheapest theft and those almost as cheap: hardening a more expensive route does not move the score.'],
          ['Passphrase strength is three rough levels (weak, phrase, long random); its entropy is not measured.'],
          ['Metal is assumed to be steel: an aluminum or brass plate would not survive a fire. Nor are a waterproof bag or a fireproof safe told apart.'],
          ['Protection is three levels (none, home safe, bank box), without telling apart the quality of the safe or alarms. Locations nest only one level deep.'],
          ['It does not know where each person lives: the wrench attack can happen anywhere the victim has access to. Coercing two people at once counts as two attacks.'],
          ['The computer or phone used to sign is not modeled: flaws exploitable from a computer with malware are only warned about.'],
          ['The catalog of devices and their known flaws does not update itself: each version ships its own, with its date.'],
          ['There are no timelocks yet (inheritance with a waiting period, delayed recovery keys).'],
          ['With many devices and locations the analysis takes a few seconds: it is exhaustive.'],
        ],
      },
    ],
  },
  {
    id: 'verificar',
    titulo: 'Privacy and verification',
    resumen: 'What leaves your computer (nothing), how your setup is stored, and how to check that the app is what it claims to be.',
    bloques: [
      {
        tipo: 'lista',
        items: [
          [n('No network'), ': the page’s content security policy forbids any request. There are no accounts, no analytics, and no third-party resources.'],
          [
            n('Encryption'),
            ': your setup is stored in the browser or in a .llave file encrypted with AES-256-GCM and a key derived from your password (PBKDF2). Without the password there is no way to open it, not even for you.',
          ],
          [n('Offline'), ': each version is also published as a zip to use on your computer without internet.'],
          [
            n('Verifiable'),
            ': the code is open and the build is reproducible. Rebuilding a version gives exactly the same files that are published, and they can be compared with the website file by file.',
          ],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'How to do it, step by step: ',
          { enlace: `${REPO}/blob/main/docs/VERIFICAR.md`, texto: 'Verifying llave-inglesa' },
          ' (in Spanish). The code and the releases: ',
          { enlace: REPO, texto: 'GitHub' },
          '.',
        ],
      },
    ],
  },
];
