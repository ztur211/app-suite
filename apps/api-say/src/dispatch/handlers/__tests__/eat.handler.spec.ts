import { EatHandler } from '../eat.handler';

describe('EatHandler', () => {
  it('returns null destinationRef (parks in PENDING_EAT)', async () => {
    const out = await new EatHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { name: 'pasta', kind: 'recipe' },
    });
    expect(out).toEqual({ destinationRef: null });
  });
});
