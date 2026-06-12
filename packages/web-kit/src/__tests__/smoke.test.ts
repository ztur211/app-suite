import { PACKAGE_NAME } from '../index';

describe('@things/web-kit', () => {
  it('exports PACKAGE_NAME identifying the package', () => {
    expect(PACKAGE_NAME).toBe('@things/web-kit');
  });
});
