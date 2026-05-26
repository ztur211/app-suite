// Root index is now a redirect to /(app); substantive rendering tested in login.test, messages.test, and message-detail.test.
describe('web-send routing stub', () => {
  it('passes trivially — screen tests live in login.test, messages.test, and message-detail.test', () => {
    expect(true).toBe(true);
  });
});
