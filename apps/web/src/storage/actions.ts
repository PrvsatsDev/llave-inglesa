import { blankModel, tidyIds, type CustodyModel, type ParseResult } from '@llave-inglesa/domain';
import {
  createKey,
  isEnvelope,
  readDocument,
  sealModel,
  serializeModel,
  unsealModel,
  WrongPasswordError,
  type Envelope,
  type VaultKey,
} from '@llave-inglesa/vault';
import { alertDialog, askPassword, confirmDialog, welcomeDialog } from '../store/dialog.ts';
import { useLayout } from '../store/layout.ts';
import { hasUnsavedChanges, useDocument, type DocumentOrigin } from '../store/document.ts';
import { useScenario } from '../store/scenario.ts';
import { useSelection } from '../store/selection.ts';

/**
 * Guardar, abrir, importar y exportar. Nada sale del navegador: el guardado local va
 * cifrado en localStorage y los ficheros se descargan o se leen desde el disco.
 */

const STORAGE_KEY = 'llave-inglesa:documento:v1';

/** Clave de la sesión: tras la primera vez, Ctrl+S guarda sin volver a pedir la contraseña. */
let sessionKey: VaultKey | null = null;

// ---------- almacenamiento del navegador (siempre defensivo) ----------

function readStored(): Envelope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(envelope: Envelope): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export const hasLocalDocument = () => readStored() !== null;

// ---------- utilidades ----------

function slug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'esquema'
  );
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openDocument(model: CustodyModel, origin: DocumentOrigin, saved = false) {
  useSelection.getState().select(null);
  useScenario.getState().set(null);
  useDocument.getState().open(model, origin, saved);
}

/** Si hay cambios sin guardar, pide confirmación antes de descartarlos. */
export async function confirmDiscard(): Promise<boolean> {
  if (!hasUnsavedChanges(useDocument.getState())) return true;
  return confirmDialog('Cambios sin guardar', 'Si continúas, se perderán los cambios que no has guardado.', 'Descartar cambios', true);
}

function reportInvalid(result: Extract<ParseResult, { ok: false }>) {
  return alertDialog('El documento no es válido', [
    'No se ha podido abrir porque tiene errores:',
    ...result.issues.slice(0, 5).map((i) => `• ${i.path.join('.') || 'documento'}: ${i.detail ?? i.code}`),
  ]);
}

/** Pide la contraseña hasta acertar o cancelar. */
async function unlock(envelope: Envelope, title: string, message: string): Promise<{ result: ParseResult; vault: VaultKey } | null> {
  let error: string | undefined;
  for (;;) {
    const password = await askPassword('unlock', title, message, error);
    if (password === null) return null;
    try {
      return await unsealModel(envelope, password);
    } catch (e) {
      if (!(e instanceof WrongPasswordError)) throw e;
      error = 'Contraseña incorrecta.';
    }
  }
}

// ---------- acciones ----------

export async function newDocument() {
  if (await confirmDiscard()) openDocument(blankModel(), { kind: 'new' });
}

export async function loadExample(id: string) {
  if (!(await confirmDiscard())) return false;
  useSelection.getState().select(null);
  useScenario.getState().set(null);
  useDocument.getState().loadExample(id);
  return true;
}

/** Guarda cifrado en este navegador. La primera vez en la sesión pide la contraseña. */
export async function saveLocal(): Promise<boolean> {
  // Hay un solo hueco de guardado: no sustituir en silencio otro esquema guardado.
  if (sessionKey && useDocument.getState().origin.kind !== 'local' && hasLocalDocument()) {
    const ok = await confirmDialog(
      'Sustituir el esquema guardado',
      'En este navegador ya hay un esquema guardado. Si continúas, se sustituirá por el que tienes abierto.',
      'Sustituir',
      true,
    );
    if (!ok) return false;
  }
  if (!sessionKey) {
    const replacing = hasLocalDocument();
    const password = await askPassword(
      'create',
      'Guardar en este navegador',
      replacing
        ? 'Ya hay un esquema guardado en este navegador y se sustituirá. Elige la contraseña con la que se cifrará.'
        : 'El esquema se guardará cifrado en este navegador. Nadie podrá leerlo sin esta contraseña.',
    );
    if (password === null) return false;
    sessionKey = await createKey(password);
  }
  const ok = writeStored(await sealModel(useDocument.getState().model, sessionKey));
  if (!ok) {
    await alertDialog('No se ha podido guardar', [
      'Este navegador no permite guardar datos (modo privado o almacenamiento bloqueado).',
      'Usa "Exportar cifrado" para guardarlo como fichero.',
    ]);
    return false;
  }
  useDocument.getState().markSaved();
  return true;
}

/** Abre el esquema guardado en este navegador. */
export async function openLocal(): Promise<boolean> {
  const envelope = readStored();
  if (!envelope) return false;
  if (!(await confirmDiscard())) return false;
  const opened = await unlock(envelope, 'Abrir tu esquema', 'Hay un esquema guardado y cifrado en este navegador. Introduce su contraseña.');
  if (!opened) return false;
  if (!opened.result.ok) {
    await reportInvalid(opened.result);
    return false;
  }
  sessionKey = opened.vault;
  openDocument(opened.result.model, { kind: 'local' }, true);
  return true;
}

export async function forgetLocal() {
  const ok = await confirmDialog(
    'Borrar el guardado de este navegador',
    'Se eliminará el esquema cifrado guardado aquí. No se puede deshacer. Exporta antes una copia si la quieres conservar.',
    'Borrar',
    true,
  );
  if (!ok) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que borrar
  }
  sessionKey = null;
  const { origin } = useDocument.getState();
  if (origin.kind === 'local') useDocument.setState({ saved: null, origin: { kind: 'new' } });
}

/** El documento tal como sale en un fichero: con los ids por defecto cambiados por los de su nombre. */
const exportable = () => tidyIds(useDocument.getState().model);

export async function exportEncrypted() {
  const password = await askPassword(
    'create',
    'Exportar cifrado',
    'Se descargará un fichero .llave cifrado. Para abrirlo hará falta esta contraseña (puede ser distinta de la del navegador).',
  );
  if (password === null) return;
  const model = exportable();
  const envelope = await sealModel(model, await createKey(password));
  download(`${slug(model.name)}.llave`, JSON.stringify(envelope, null, 2), 'application/json');
}

export async function exportPlain() {
  const ok = await confirmDialog(
    'Exportar sin cifrar',
    'El fichero JSON no va cifrado: cualquiera que lo lea sabrá dónde están tus backups, quién sabe qué y cómo atacarte. Úsalo solo para trabajar con él y bórralo después.',
    'Exportar de todos modos',
    true,
  );
  if (!ok) return;
  const model = exportable();
  download(`${slug(model.name)}.json`, serializeModel(model), 'application/json');
}

/** Abre un fichero .llave (cifrado) o .json (en claro). */
export async function importFile(file: File) {
  if (!(await confirmDiscard())) return;
  const read = readDocument(await file.text());
  if (read.kind === 'invalid') {
    await alertDialog('No se puede abrir', [
      read.reason === 'not-json' ? 'El fichero no es JSON.' : 'El fichero no es un esquema de llave-inglesa.',
    ]);
    return;
  }
  let result: ParseResult;
  if (read.kind === 'encrypted') {
    const opened = await unlock(read.envelope, `Abrir ${file.name}`, 'Este fichero está cifrado. Introduce su contraseña.');
    if (!opened) return;
    result = opened.result;
  } else {
    result = read.result;
  }
  if (!result.ok) {
    await reportInvalid(result);
    return;
  }
  openDocument(result.model, { kind: 'file', name: file.name });
}

/** La bienvenida: qué es y por dónde empezar. Cerrarla o elegir "ver un ejemplo" deja el ejemplo abierto. */
export async function showWelcome() {
  const choice = await welcomeDialog();
  useLayout.getState().markWelcomeSeen();
  if (choice?.kind === 'new') await newDocument();
  else if (choice?.kind === 'open') await importFile(choice.file);
}
