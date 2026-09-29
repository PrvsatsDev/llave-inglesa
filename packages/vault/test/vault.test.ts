import { readFileSync } from 'node:fs';
import { parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { createKey, readDocument, seal, sealModel, serializeModel, unseal, unsealModel, WrongPasswordError, type Envelope } from '../src/index.ts';

// Pocas iteraciones en los tests para que sean rápidos; en la app se usa DEFAULT_ITERATIONS.
const FAST = 1_000;

function fixture(): CustodyModel {
  const r = parseModel(JSON.parse(readFileSync(new URL('../../../fixtures/todo-en-casa.json', import.meta.url), 'utf8')));
  if (!r.ok) throw new Error('fixture');
  return r.model;
}

describe('cifrado', () => {
  it('ida y vuelta con la contraseña correcta (normalizada NFKC)', async () => {
    const vault = await createKey('contraseña', FAST);
    const env = await seal('hola', vault);
    expect((await unseal(env, 'contraseña')).plaintext).toBe('hola');
    // "ñ" compuesta vs. descompuesta: misma contraseña para el usuario.
    expect((await unseal(env, 'contraseña')).plaintext).toBe('hola');
  });

  it('contraseña incorrecta', async () => {
    const env = await seal('hola', await createKey('buena', FAST));
    await expect(unseal(env, 'mala')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('cada guardado usa un IV nuevo', async () => {
    const vault = await createKey('x', FAST);
    const [a, b] = [await seal('hola', vault), await seal('hola', vault)];
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('manipular los datos o la cabecera hace fallar el descifrado', async () => {
    const env = await seal('hola', await createKey('x', FAST));
    const flipped = env.data.startsWith('A') ? 'B' + env.data.slice(1) : 'A' + env.data.slice(1);
    await expect(unseal({ ...env, data: flipped }, 'x')).rejects.toBeInstanceOf(WrongPasswordError);
    // Cambiar un parámetro autenticado (aunque la clave derivada resultara igual) se detecta.
    const tampered: Envelope = { ...env, version: 1, kdf: { ...env.kdf }, cipher: { ...env.cipher, iv: env.cipher.iv } };
    tampered.kdf.iterations = FAST + 1;
    await expect(unseal(tampered, 'x')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('rechaza iteraciones absurdas sin intentar derivar', async () => {
    const env = await seal('hola', await createKey('x', FAST));
    await expect(unseal({ ...env, kdf: { ...env.kdf, iterations: 1e12 } }, 'x')).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe('documentos', () => {
  const model = fixture();

  it('detecta modelo en claro, cifrado o formato desconocido', async () => {
    expect(readDocument(serializeModel(model))).toMatchObject({ kind: 'plain', result: { ok: true } });
    const env = await sealModel(model, await createKey('x', FAST));
    expect(readDocument(JSON.stringify(env)).kind).toBe('encrypted');
    expect(readDocument('no es json')).toEqual({ kind: 'invalid', reason: 'not-json' });
    expect(readDocument('{"hola": 1}')).toEqual({ kind: 'invalid', reason: 'unknown-format' });
  });

  it('el texto cifrado no revela nada del modelo', async () => {
    const env = await sealModel(model, await createKey('x', FAST));
    const text = JSON.stringify(env);
    // Frases con espacios: nunca pueden aparecer por casualidad en base64.
    for (const leak of ['Coldcard Q', 'Caja del banco', 'Placa de metal K2']) expect(text).not.toContain(leak);
    expect(text).not.toContain(serializeModel(model).slice(0, 40));
  });

  it('ida y vuelta de un modelo completo', async () => {
    const env = await sealModel(model, await createKey('secreto', FAST));
    const { result } = await unsealModel(env, 'secreto');
    expect(result.ok && result.model).toEqual(model);
  });
});
