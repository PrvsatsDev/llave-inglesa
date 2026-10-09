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
import { UI } from '../lib/text.ts';
import { alertDialog, askPassword, confirmDialog, welcomeDialog } from '../store/dialog.ts';
import { useLayout } from '../store/layout.ts';
import { useNavigation } from '../store/navigation.ts';
import { hasUnsavedChanges, useDocument, type DocumentOrigin } from '../store/document.ts';
import { useScenario } from '../store/scenario.ts';
import { useSelection } from '../store/selection.ts';

/**
 * Guardar, abrir, importar y exportar. Nada sale del navegador: el guardado local va
 * cifrado en localStorage y los ficheros se descargan o se leen desde el disco.
 */

const T = UI.ficheros;

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
      .replace(/^-+|-+$/g, '') || T.nombrePorDefecto
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
  return confirmDialog(T.descartar.titulo, T.descartar.mensaje, T.descartar.confirmar, true);
}

function reportInvalid(result: Extract<ParseResult, { ok: false }>) {
  return alertDialog(T.invalido.titulo, [
    T.invalido.intro,
    ...result.issues.slice(0, 5).map((i) => `• ${i.path.join('.') || T.invalido.raiz}: ${i.detail ?? i.code}`),
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
      error = T.contrasenaIncorrecta;
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
    const ok = await confirmDialog(T.sustituir.titulo, T.sustituir.mensaje, T.sustituir.confirmar, true);
    if (!ok) return false;
  }
  if (!sessionKey) {
    const replacing = hasLocalDocument();
    const password = await askPassword('create', T.guardar.titulo, replacing ? T.guardar.mensajeSustituye : T.guardar.mensaje);
    if (password === null) return false;
    sessionKey = await createKey(password);
  }
  const ok = writeStored(await sealModel(useDocument.getState().model, sessionKey));
  if (!ok) {
    await alertDialog(T.noGuardado.titulo, [...T.noGuardado.lineas]);
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
  const opened = await unlock(envelope, T.abrirLocal.titulo, T.abrirLocal.mensaje);
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
  const ok = await confirmDialog(T.borrarLocal.titulo, T.borrarLocal.mensaje, T.borrarLocal.confirmar, true);
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
  const password = await askPassword('create', T.exportarCifrado.titulo, T.exportarCifrado.mensaje);
  if (password === null) return;
  const model = exportable();
  const envelope = await sealModel(model, await createKey(password));
  download(`${slug(model.name)}.llave`, JSON.stringify(envelope, null, 2), 'application/json');
}

export async function exportPlain() {
  const ok = await confirmDialog(T.exportarPlano.titulo, T.exportarPlano.mensaje, T.exportarPlano.confirmar, true);
  if (!ok) return;
  const model = exportable();
  download(`${slug(model.name)}.json`, serializeModel(model), 'application/json');
}

/**
 * Descarga el documento en claro sin preguntar nada: solo para la pantalla de fallo, cuando la
 * interfaz (y sus diálogos) ya no responden y es la única forma de no perder los cambios.
 */
export function rescueDownload() {
  const model = exportable();
  download(`${slug(model.name)}-${T.sufijoRescate}.json`, serializeModel(model), 'application/json');
}

/** Abre un fichero .llave (cifrado) o .json (en claro). */
export async function importFile(file: File) {
  if (!(await confirmDiscard())) return;
  const read = readDocument(await file.text());
  if (read.kind === 'invalid') {
    await alertDialog(T.noSePuedeAbrir.titulo, [read.reason === 'not-json' ? T.noSePuedeAbrir.noJson : T.noSePuedeAbrir.noEsquema]);
    return;
  }
  let result: ParseResult;
  if (read.kind === 'encrypted') {
    const opened = await unlock(read.envelope, T.abrirCifrado.titulo(file.name), T.abrirCifrado.mensaje);
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
  else if (choice?.kind === 'guide') useNavigation.getState().openGuide('primeros-pasos');
}
