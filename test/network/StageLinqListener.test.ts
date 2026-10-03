import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  errorHandler: null as ((error: Error) => void) | null,
  close: vi.fn(),
}));

vi.mock('dgram', () => ({
  createSocket: () => ({
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === 'error') state.errorHandler = handler as (error: Error) => void;
    },
    bind: vi.fn(),
    close: state.close,
  }),
}));

import { StageLinqListener } from '../../network/StageLinqListener';

describe('StageLinqListener socket errors', () => {
  afterEach(() => {
    state.errorHandler = null;
    state.close.mockReset();
  });

  it('forwards bind errors instead of leaving an unhandled socket error', () => {
    const listener = new StageLinqListener();
    const errors: Error[] = [];
    listener.on('error', (error) => errors.push(error));

    listener.listenForDevices(() => {});
    const error = Object.assign(new Error('bind EACCES'), { code: 'EACCES' });
    state.errorHandler?.(error);

    expect(errors).toEqual([error]);
  });

  it('closes the listener socket during teardown', () => {
    const listener = new StageLinqListener();
    listener.listenForDevices(() => {});

    listener.stop();

    expect(state.close).toHaveBeenCalledOnce();
  });
});
