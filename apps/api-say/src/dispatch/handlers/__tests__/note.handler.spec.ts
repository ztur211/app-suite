import { NoteHandler } from '../note.handler';

describe('NoteHandler', () => {
  it('returns null destinationRef', async () => {
    const out = await new NoteHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { body: 'x' },
    });
    expect(out).toEqual({ destinationRef: null });
  });
});
