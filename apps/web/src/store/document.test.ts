import { blankModel, updateMeta } from '@llave-inglesa/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setIdioma } from '../lib/text.ts';
import { hasUnsavedChanges, useDocument } from './document.ts';

const state = () => useDocument.getState();
const dirty = () => hasUnsavedChanges(state());

describe('documento: historial y cambios sin guardar', () => {
  beforeEach(() => state().loadExample('todo-en-casa'));

  it('un ejemplo sin tocar no tiene cambios; editarlo sí, y deshacer los quita', () => {
    expect(dirty()).toBe(false);
    state().apply((m) => updateMeta(m, { name: 'otro' }));
    expect(dirty()).toBe(true);
    state().undo();
    expect(dirty()).toBe(false);
  });

  it('un documento nuevo cuenta como sin guardar hasta guardarlo', () => {
    state().open(blankModel(), { kind: 'new' });
    expect(dirty()).toBe(true);
    state().markSaved();
    expect(dirty()).toBe(false);
    expect(state().origin).toEqual({ kind: 'local' });
    state().apply((m) => updateMeta(m, { name: 'cambio' }));
    expect(dirty()).toBe(true);
  });

  it('las pulsaciones en el mismo campo son un solo paso de deshacer', () => {
    for (const name of ['a', 'ab', 'abc']) state().apply((m) => updateMeta(m, { name }), 'meta:name');
    expect(state().past).toHaveLength(1);
    state().undo();
    expect(state().model.name).toBe('Todo a mano en casa');
  });

  it('abrir un documento reinicia el historial y remonta el lienzo', () => {
    const before = state().generation;
    state().apply((m) => updateMeta(m, { name: 'x' }));
    state().open(blankModel(), { kind: 'new' });
    expect(state().past).toEqual([]);
    expect(state().generation).toBe(before + 1);
  });
});

describe('documento: cambio de idioma', () => {
  afterEach(() => setIdioma('es'));

  it('un ejemplo sin tocar se vuelve a cargar traducido; uno editado se conserva', () => {
    state().loadExample('todo-en-casa');
    setIdioma('en');
    state().relocalize();
    expect(state().model.name).toBe('Everything at hand at home');
    expect(dirty()).toBe(false);

    setIdioma('es');
    state().relocalize();
    state().apply((m) => updateMeta(m, { name: 'mío' }));
    setIdioma('en');
    state().relocalize();
    expect(state().model.name).toBe('mío');
    expect(state().model.people[0]!.name).toBe('Yo');
  });
});
