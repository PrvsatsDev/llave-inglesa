import { beforeEach, describe, expect, it } from 'vitest';
import type { Scenario } from '../scenario/view.ts';
import { goBack, routePosition, useNavigation } from './navigation.ts';
import { useScenario } from './scenario.ts';
import { useSelection } from './selection.ts';

const theft: Scenario = { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] };
const casa = { kind: 'location', id: 'casa' } as const;
const ccq = { kind: 'device', id: 'ccq' } as const;
const k1 = { kind: 'key', id: 'k1' } as const;

beforeEach(() => {
  useSelection.getState().select(null);
  useScenario.getState().set(null);
  useNavigation.setState({ section: 'schema', metric: 'security', simulatedFrom: null, routes: [] });
});

describe('migas de pan de las fichas', () => {
  it('abrir desde una ficha apila; volver desapila', () => {
    const s = useSelection.getState();
    s.select(casa);
    s.open(ccq);
    s.open(k1);
    expect(useSelection.getState().trail).toEqual([casa, ccq, k1]);
    s.back();
    expect(useSelection.getState().selected).toEqual(ccq);
    s.backTo(0);
    expect(useSelection.getState().trail).toEqual([casa]);
  });

  it('volver a abrir una ficha que ya está en el camino regresa a ella, sin repetirla', () => {
    const s = useSelection.getState();
    s.select(casa);
    s.open(ccq);
    s.open(casa);
    expect(useSelection.getState().trail).toEqual([casa]);
  });

  it('abrir desde el mapa empieza un camino nuevo', () => {
    const s = useSelection.getState();
    s.select(casa);
    s.open(ccq);
    s.select(k1);
    expect(useSelection.getState().trail).toEqual([k1]);
  });
});

describe('secciones y volver', () => {
  it('pulsar una tarjeta lleva a su análisis y cierra la ficha', () => {
    useSelection.getState().select(casa);
    useNavigation.getState().goMetric('resilience');
    expect(useNavigation.getState()).toMatchObject({ section: 'analysis', metric: 'resilience' });
    expect(useSelection.getState().selected).toBeNull();
  });

  it('volver va de lo más profundo a lo más general: ficha, lista de origen, salir de la simulación', () => {
    useNavigation.getState().simulate(theft, 'security');
    useSelection.getState().select(casa);
    useSelection.getState().open(ccq);

    expect(goBack()).toBe(true);
    expect(useSelection.getState().selected).toEqual(casa);
    expect(goBack()).toBe(true);
    expect(useSelection.getState().selected).toBeNull();
    expect(useNavigation.getState().section).toBe('simulate');

    // De la simulación a la lista de la que salió; la simulación sigue en el mapa.
    expect(goBack()).toBe(true);
    expect(useNavigation.getState()).toMatchObject({ section: 'analysis', metric: 'security' });
    expect(useScenario.getState().active).toEqual(theft);

    expect(goBack()).toBe(true);
    expect(useScenario.getState().active).toBeNull();
    expect(goBack()).toBe(false);
  });

  it('una simulación lanzada desde Simular no tiene lista a la que volver', () => {
    useNavigation.getState().simulate(theft);
    expect(goBack()).toBe(true);
    expect(useNavigation.getState().section).toBe('simulate');
    expect(useScenario.getState().active).toBeNull();
  });
});

describe('recorrer las vías con ‹ ›', () => {
  const other: Scenario = { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] };

  it('la simulación recuerda la lista de la que salió y su posición', () => {
    useNavigation.getState().simulate(other, 'security', [theft, other]);
    expect(routePosition(useNavigation.getState().routes, useScenario.getState().active)).toBe(1);
  });

  it('si se modifica el escenario, ya no es ninguna vía de la lista', () => {
    useNavigation.getState().simulate(theft, 'security', [theft, other]);
    useScenario.getState().set({ kind: 'attack', atoms: [...(theft as Extract<Scenario, { kind: 'attack' }>).atoms, { type: 'burglary', location: 'banco' }] });
    expect(routePosition(useNavigation.getState().routes, useScenario.getState().active)).toBe(-1);
  });

  it('sin métrica de origen no hay lista, y volver o cambiar de sección la olvida', () => {
    useNavigation.getState().simulate(theft, undefined, [theft, other]);
    expect(useNavigation.getState().routes).toEqual([]);
    useNavigation.getState().simulate(theft, 'security', [theft, other]);
    goBack();
    expect(useNavigation.getState().routes).toEqual([]);
  });
});
