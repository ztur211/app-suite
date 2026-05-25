import { BuyHandler } from '../buy.handler';

describe('BuyHandler', () => {
  it('returns null destinationRef (parks in PENDING_BUY)', async () => {
    const out = await new BuyHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { item: 'milk', quantity: 1 },
    });
    expect(out).toEqual({ destinationRef: null });
  });
});
