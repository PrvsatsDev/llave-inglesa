import { create } from 'zustand';

export type DialogRequest =
  | {
      kind: 'password';
      /** create: elegir una contraseña nueva (con confirmación). unlock: introducir una existente. */
      mode: 'create' | 'unlock';
      title: string;
      message: string;
      error?: string;
      resolve(password: string | null): void;
    }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; resolve(ok: boolean): void }
  | { kind: 'alert'; title: string; lines: string[]; resolve(): void }
  /** Qué es la herramienta y por dónde empezar. null: cerrada sin elegir (se queda en el ejemplo). */
  | { kind: 'welcome'; resolve(choice: WelcomeChoice | null): void }
  /** Qué es, quién la hace y cómo apoyarlo. */
  | { kind: 'about'; resolve(): void };

export type WelcomeChoice = { kind: 'example' } | { kind: 'new' } | { kind: 'open'; file: File };

interface DialogState {
  current: DialogRequest | null;
}

/** Un único diálogo modal a la vez. La lógica lo pide con promesas (askPassword, confirm…). */
export const useDialog = create<DialogState>()(() => ({ current: null }));

type Distribute<T> = T extends unknown ? Omit<T, 'resolve'> : never;

function show<T>(request: Distribute<DialogRequest>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    useDialog.getState().current?.resolve(fallback as never);
    useDialog.setState({
      current: {
        ...request,
        resolve: (value: unknown) => {
          useDialog.setState({ current: null });
          resolve((value ?? fallback) as T);
        },
      } as DialogRequest,
    });
  });
}

export const askPassword = (mode: 'create' | 'unlock', title: string, message: string, error?: string) =>
  show<string | null>({ kind: 'password', mode, title, message, ...(error ? { error } : {}) }, null);

export const confirmDialog = (title: string, message: string, confirmLabel: string, danger = false) =>
  show<boolean>({ kind: 'confirm', title, message, confirmLabel, danger }, false);

export const alertDialog = (title: string, lines: string[]) => show<void>({ kind: 'alert', title, lines }, undefined);

export const welcomeDialog = () => show<WelcomeChoice | null>({ kind: 'welcome' }, null);
export const aboutDialog = () => show<void>({ kind: 'about' }, undefined);
