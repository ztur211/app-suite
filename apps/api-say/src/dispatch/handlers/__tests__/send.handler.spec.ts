import { SendHandler } from '../send.handler';

describe('SendHandler', () => {
  it('renders email text and returns it', async () => {
    const out = await new SendHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { subject: 'Hi', body: 'How are you?', recipientHint: 'Sarah' },
    });
    expect(out.destinationRef).toBeNull();
    expect(out.renderedEmail).toContain('Subject: Hi');
    expect(out.renderedEmail).toContain('How are you?');
    expect(out.renderedEmail).toContain('Sarah');
  });

  it('omits recipient line when null', async () => {
    const out = await new SendHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { subject: 'Hi', body: 'Body', recipientHint: null },
    });
    expect(out.renderedEmail).not.toContain('To:');
  });
});
