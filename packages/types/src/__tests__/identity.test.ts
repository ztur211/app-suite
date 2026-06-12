import type { User } from '../identity';

describe('@things/types User', () => {
  it('models an identity row: id, email, and a nullable display name', () => {
    const user: User = { id: 'usr_1', email: 'a@b.com', name: 'Ada' };
    const anonymous: User = { id: 'usr_2', email: 'c@d.com', name: null };

    expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name']);
    expect(anonymous.name).toBeNull();
  });
});
