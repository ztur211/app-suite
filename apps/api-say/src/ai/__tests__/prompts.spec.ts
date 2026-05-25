import { INTENT_CLASSIFY_PROMPT } from '../prompts/intent-classify-prompt';
import { RESHAPE_PROMPT_BY_INTENT } from '../prompts/reshape-prompts';

describe('AI prompts', () => {
  it('intent-classify prompt is stable (cacheability)', () => {
    expect(INTENT_CLASSIFY_PROMPT).toMatchSnapshot();
  });

  it('reshape prompts cover all 5 intents', () => {
    for (const intent of ['DO', 'NOTE', 'SEND', 'BUY', 'EAT'] as const) {
      expect(RESHAPE_PROMPT_BY_INTENT[intent]).toBeTruthy();
      expect(RESHAPE_PROMPT_BY_INTENT[intent].length).toBeGreaterThan(20);
    }
  });
});
