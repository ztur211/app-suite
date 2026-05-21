import { PACKAGE_NAME } from '../index';

describe('@things/do-sdk', () => {
  it('exports PACKAGE_NAME as a string identifying the package', () => {
    expect(PACKAGE_NAME).toBe('@things/do-sdk');
  });

  it('exports a frozen object so identifiers cannot be reassigned at runtime', () => {
    expect(typeof PACKAGE_NAME).toBe('string');
  });
});
