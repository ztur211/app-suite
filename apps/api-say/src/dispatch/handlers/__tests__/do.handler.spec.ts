import { DoHandler } from '../do.handler';

describe('DoHandler', () => {
  it('calls do-sdk tasks.create() and returns destinationRef', async () => {
    const sdk = {
      tasks: {
        create: jest.fn().mockResolvedValue({ id: 't1' }),
        delete: jest.fn(),
      },
    };
    const handler = new DoHandler(sdk as never);
    const out = await handler.dispatch({
      dictationId: 'd1',
      userId: 'u1',
      payload: { title: 'Email Jamie', dueAt: null },
    });
    expect(sdk.tasks.create).toHaveBeenCalledWith({
      userId: 'u1',
      title: 'Email Jamie',
      dueAt: null,
      notes: undefined,
      source: { app: 'say-things', dictationId: 'd1' },
    });
    expect(out).toEqual({ destinationRef: 't1' });
  });

  it('undo() deletes the task using the SDK with userId', async () => {
    const sdk = {
      tasks: {
        create: jest.fn(),
        delete: jest.fn().mockResolvedValue({ ok: true }),
      },
    };
    const handler = new DoHandler(sdk as never);
    await handler.undo({ userId: 'u1', destinationRef: 't1' });
    expect(sdk.tasks.delete).toHaveBeenCalledWith({ userId: 'u1', taskId: 't1' });
  });
});
