import { DispatchService } from '../dispatch.service';
import type { DoHandler } from '../handlers/do.handler';
import type { NoteHandler } from '../handlers/note.handler';
import type { SendHandler } from '../handlers/send.handler';
import type { BuyHandler } from '../handlers/buy.handler';
import type { EatHandler } from '../handlers/eat.handler';

function makeHandlers() {
  return {
    doH: {
      dispatch: jest.fn().mockResolvedValue({ destinationRef: 't1' }),
      undo: jest.fn().mockResolvedValue(undefined),
    } as unknown as DoHandler,
    noteH: {
      dispatch: jest.fn().mockResolvedValue({ destinationRef: null }),
      undo: jest.fn(),
    } as unknown as NoteHandler,
    sendH: {
      dispatch: jest.fn().mockResolvedValue({ destinationRef: null, renderedEmail: 'X' }),
      undo: jest.fn(),
    } as unknown as SendHandler,
    buyH: {
      dispatch: jest.fn().mockResolvedValue({ destinationRef: null }),
      undo: jest.fn(),
    } as unknown as BuyHandler,
    eatH: {
      dispatch: jest.fn().mockResolvedValue({ destinationRef: null }),
      undo: jest.fn(),
    } as unknown as EatHandler,
  };
}

describe('DispatchService', () => {
  it('routes DO to DoHandler.dispatch and returns destinationRef', async () => {
    const h = makeHandlers();
    const svc = new DispatchService(h.doH, h.noteH, h.sendH, h.buyH, h.eatH);
    const r = await svc.dispatch({
      intent: 'DO',
      dictationId: 'd',
      userId: 'u',
      payload: { title: 'X', dueAt: null },
    });
    expect(h.doH.dispatch).toHaveBeenCalled();
    expect(r.destinationRef).toBe('t1');
  });

  it('routes SEND and includes renderedEmail', async () => {
    const h = makeHandlers();
    const svc = new DispatchService(h.doH, h.noteH, h.sendH, h.buyH, h.eatH);
    const r = await svc.dispatch({
      intent: 'SEND',
      dictationId: 'd',
      userId: 'u',
      payload: { subject: 'X', body: 'Y', recipientHint: null },
    });
    expect(h.sendH.dispatch).toHaveBeenCalled();
    expect(r.renderedEmail).toBe('X');
  });

  it('routes NOTE/BUY/EAT through their handlers', async () => {
    const h = makeHandlers();
    const svc = new DispatchService(h.doH, h.noteH, h.sendH, h.buyH, h.eatH);
    await svc.dispatch({
      intent: 'NOTE',
      dictationId: 'd',
      userId: 'u',
      payload: { body: 'n' },
    });
    await svc.dispatch({
      intent: 'BUY',
      dictationId: 'd',
      userId: 'u',
      payload: { item: 'milk', quantity: null },
    });
    await svc.dispatch({
      intent: 'EAT',
      dictationId: 'd',
      userId: 'u',
      payload: { name: 'pasta', kind: 'recipe' },
    });
    expect(h.noteH.dispatch).toHaveBeenCalled();
    expect(h.buyH.dispatch).toHaveBeenCalled();
    expect(h.eatH.dispatch).toHaveBeenCalled();
  });

  it('undo() routes to the right handler when destinationRef is present', async () => {
    const h = makeHandlers();
    const svc = new DispatchService(h.doH, h.noteH, h.sendH, h.buyH, h.eatH);
    await svc.undo({ intent: 'DO', userId: 'u', destinationRef: 't1' });
    expect(h.doH.undo).toHaveBeenCalledWith({ userId: 'u', destinationRef: 't1' });
  });

  it('undo() is a no-op when destinationRef is null', async () => {
    const h = makeHandlers();
    const svc = new DispatchService(h.doH, h.noteH, h.sendH, h.buyH, h.eatH);
    await svc.undo({ intent: 'DO', userId: 'u', destinationRef: null });
    expect(h.doH.undo).not.toHaveBeenCalled();
  });
});
