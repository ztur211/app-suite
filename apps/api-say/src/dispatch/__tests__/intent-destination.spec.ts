import { intentToDestination } from '../intent-destination';

describe('intentToDestination', () => {
  it('routes each intent to its destination (SEND parks in PENDING_SEND)', () => {
    expect(intentToDestination).toEqual({
      DO: 'DO_THINGS',
      NOTE: 'SAY_LIBRARY',
      SEND: 'PENDING_SEND',
      BUY: 'PENDING_BUY',
      EAT: 'PENDING_EAT',
    });
  });
});
