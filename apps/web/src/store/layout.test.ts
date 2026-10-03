import { describe, expect, it } from 'vitest';
import { clampWidth, PANEL_DEFAULT, PANEL_MAX, PANEL_MIN, useLayout } from './layout.ts';

describe('disposición de la columna', () => {
  it('el ancho nunca sale de sus límites', () => {
    expect(clampWidth(0)).toBe(PANEL_MIN);
    expect(clampWidth(10_000)).toBe(PANEL_MAX);
    expect(clampWidth(500.4)).toBe(500);
  });

  it('sin almacenamiento arranca desplegada y con el ancho por defecto', () => {
    expect(useLayout.getState().width).toBe(PANEL_DEFAULT);
    expect(useLayout.getState().collapsed).toBe(false);
    expect(useLayout.getState().mobileNoticeDismissed).toBe(false);
    expect(useLayout.getState().welcomeSeen).toBe(false);
  });

  it('la bienvenida queda vista aunque no se pueda guardar', () => {
    useLayout.getState().markWelcomeSeen();
    expect(useLayout.getState().welcomeSeen).toBe(true);
  });

  it('el aviso de móvil se cierra aunque no se pueda guardar', () => {
    useLayout.getState().dismissMobileNotice();
    expect(useLayout.getState().mobileNoticeDismissed).toBe(true);
  });

  it('cambiar el ancho lo limita, aunque no se pueda guardar', () => {
    useLayout.getState().setWidth(50);
    expect(useLayout.getState().width).toBe(PANEL_MIN);
  });
});
