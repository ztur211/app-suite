# Web-kit Extraction — PR 3: shared `LoginScreen` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the login screen — identical across all 5 apps except its title — into `@things/web-kit` as `LoginScreen({ appName })`, reducing each app's `app/(auth)/login.tsx` to a ~4-line wrapper and consolidating the duplicated login tests into one web-kit test.

**Architecture:** Add `LoginScreen` (the existing 111-line screen, parameterized by an `appName` prop) to `@things/web-kit`; it imports `useAuth` from the package's own `./auth-store` and primitives from `@things/design-system`. web-kit gains the UI runtime deps (`@things/design-system`, `react-hook-form`, `@hookform/resolvers`, `zod`; `react-native` peer) and a `react-native-reanimated` jest mock (design-system primitives use it). Each app renders `<LoginScreen appName="X Things" />`. No behavior change.

**Tech Stack:** React 19 + React Native 0.85, react-hook-form + Zod, `@things/design-system` primitives, Jest 29 + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-06-12-web-app-dedup-design.md` — PR 3 section.

---

## Preconditions & gotchas

- Branch `refactor/web-kit-login` (off `main` after PR #11 merged). web-kit already exports `apiRequest`/`authApi`/`useAuth`.
- **No `expo-router`** in the screen — it performs no navigation; post-auth redirects stay in the apps' layout guards (which already watch `useAuth().user`).
- **`react-native-reanimated` mock needed now:** `LoginScreen` renders design-system's `Button`, which uses `usePressFeedback` → reanimated. web-kit's `src/jest.setup.ts` (a no-op since PR 2) gains the same mock design-system uses, and `react-native-reanimated` becomes a web-kit devDep.
- **The app `login.test.tsx` would break and is removed:** after PR 2 it mocks `@things/web-kit` to `{ useAuth }` and renders the inline screen; once `login.tsx` renders `<LoginScreen>` (also from web-kit), that mock would null out `LoginScreen`. Its 11 cases port into web-kit's `LoginScreen.test.tsx` (which mocks `./auth-store`). web-say has no `login.test.tsx`.

## File Structure

| File                                                  | Change     | Responsibility                                                    |
| ----------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| `packages/web-kit/package.json`                       | modify     | Add UI deps + `react-native` peer + RN-testing/reanimated devDeps |
| `packages/web-kit/src/jest.setup.ts`                  | modify     | Add the `react-native-reanimated` mock                            |
| `packages/web-kit/src/LoginScreen.tsx`                | **create** | Shared login screen, `{ appName }` prop                           |
| `packages/web-kit/src/__tests__/LoginScreen.test.tsx` | **create** | Ported login behavior tests                                       |
| `packages/web-kit/src/index.ts`                       | modify     | Export `LoginScreen`                                              |
| `apps/web-*/app/(auth)/login.tsx`                     | modify     | Reduce to `<LoginScreen appName="X Things" />`                    |
| `apps/web-{do,buy,eat,send}/__tests__/login.test.tsx` | **delete** | Consolidated into web-kit                                         |

---

## Task 1: web-kit gains the UI deps + reanimated mock

**Files:** modify `packages/web-kit/package.json`, `packages/web-kit/src/jest.setup.ts`.

- [ ] **Step 1: Add deps to `packages/web-kit/package.json`**

Set `dependencies`, `peerDependencies`, and `devDependencies` to:

```json
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@things/design-system": "*",
    "@things/types": "*",
    "react-hook-form": "^7.76.1",
    "zod": "^3.25.76"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-native": ">=0.72.0",
    "zustand": ">=5.0.0"
  },
  "devDependencies": {
    "@react-native/jest-preset": "0.85.3",
    "@testing-library/react-native": "^13.3.3",
    "@types/jest": "^29.5.13",
    "@types/react": "~19.1.1",
    "jest": "^29.7.0",
    "jest-expo": "~55.0.0",
    "react": "19.2.6",
    "react-native": "0.85.3",
    "react-native-reanimated": "~3.16.7",
    "react-test-renderer": "19.2.6",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2",
    "zustand": "^5.0.0"
  }
```

- [ ] **Step 2: Add the reanimated mock** — replace `packages/web-kit/src/jest.setup.ts` with:

```ts
// Mock react-native-reanimated for unit tests — the real library needs native
// modules unavailable in Jest. LoginScreen pulls it in via @things/design-system.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
```

- [ ] **Step 3: Install + confirm existing web-kit tests still pass**

Run:

```bash
npm install
npm run test:unit -w @things/web-kit
```

Expected: install clean; the existing 4 suites / 16 tests still PASS (the reanimated mock is inert until a component imports it).

- [ ] **Step 4: Commit**

```bash
git add packages/web-kit/package.json packages/web-kit/src/jest.setup.ts package-lock.json
git commit -m "chore(web-kit): add UI deps + reanimated mock for LoginScreen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `LoginScreen` component

**Files:** create `packages/web-kit/src/LoginScreen.tsx`, `packages/web-kit/src/__tests__/LoginScreen.test.tsx`.

- [ ] **Step 1: Write the failing test** — `packages/web-kit/src/__tests__/LoginScreen.test.tsx`:

```tsx
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';
import { useAuth } from '../auth-store';

jest.mock('../auth-store', () => ({
  useAuth: jest.fn(),
}));

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as unknown as jest.Mock).mockReturnValue({
    signIn: mockSignIn,
    signUp: mockSignUp,
  });
});

describe('LoginScreen', () => {
  it('renders email and password inputs', () => {
    const { getByTestId } = render(<LoginScreen appName="Do Things" />);
    expect(getByTestId('login-email')).toBeTruthy();
    expect(getByTestId('login-password')).toBeTruthy();
  });

  it('renders the provided appName as the wordmark', () => {
    const { getByText } = render(<LoginScreen appName="Buy Things" />);
    expect(getByText('Buy Things')).toBeTruthy();
  });

  it('renders the Sign in heading by default', () => {
    const { getAllByText } = render(<LoginScreen appName="Do Things" />);
    expect(getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles to Create account mode on toggle press', () => {
    const { getByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.press(getByText("Don't have an account? Sign up"));
    expect(getByText('Create account')).toBeTruthy();
    expect(getByText('Have an account? Sign in')).toBeTruthy();
  });

  it('calls signIn with email and password on submit', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'test@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('calls signUp in signup mode', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const { getByTestId, getByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.press(getByText("Don't have an account? Sign up"));
    fireEvent.changeText(getByTestId('login-email'), 'new@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'secret123');
  });

  it('shows the error message on sign in failure', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { getByTestId, findByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'bad@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'wrongpass1');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    await waitFor(async () => {
      expect(await findByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('blocks submit and shows an inline error for an invalid email', async () => {
    const { getByTestId, findByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'not-an-email');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(await findByText('Enter a valid email')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an inline error for a short password', async () => {
    const { getByTestId, findByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'ok@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'short');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(await findByText('Password must be at least 8 characters')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module '../LoginScreen'`)

Run: `npm run test:unit -w @things/web-kit -- LoginScreen.test`

- [ ] **Step 3: Implement `packages/web-kit/src/LoginScreen.tsx`**

```tsx
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from './auth-store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export function LoginScreen({ appName }: { appName: string }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  });

  return (
    <View
      style={{ flex: 1, justifyContent: 'center', padding: tokens.space[6], gap: tokens.space[4] }}
    >
      <Heading level={1}>{appName}</Heading>
      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Heading level={3}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Heading>

          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                error={fieldState.error?.message}
                testID="login-email"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextInput
                placeholder="Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry
                error={fieldState.error?.message}
                testID="login-password"
              />
            )}
          />

          {submitError ? (
            <View
              testID="login-submit-error"
              style={{
                padding: tokens.space[2],
                backgroundColor: tokens.colors.semantic.danger + '20',
                borderRadius: tokens.radius.sm,
              }}
            >
              <Heading level={4}>{submitError}</Heading>
            </View>
          ) : null}

          <Button
            label={isSubmitting ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            onPress={onSubmit}
            variant="primary"
            testID="login-submit"
          />

          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Heading level={4}>
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Have an account? Sign in'}
            </Heading>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}
```

- [ ] **Step 4: Run it — expect PASS** (9 tests)

Run: `npm run test:unit -w @things/web-kit -- LoginScreen.test`

- [ ] **Step 5: Commit**

```bash
git add packages/web-kit/src/LoginScreen.tsx packages/web-kit/src/__tests__/LoginScreen.test.tsx
git commit -m "feat(web-kit): shared LoginScreen({ appName })

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Export `LoginScreen` + full web-kit gate

**Files:** modify `packages/web-kit/src/index.ts`.

- [ ] **Step 1: Add the export** — append to `packages/web-kit/src/index.ts`:

```ts
export { LoginScreen } from './LoginScreen';
```

- [ ] **Step 2: Build + typecheck + lint + test**

Run:

```bash
npm run build -w @things/web-kit
npm run typecheck -w @things/web-kit
npm run lint -w @things/web-kit
npm run test:unit -w @things/web-kit
```

Expected: all PASS — 5 suites / 25 tests (smoke 1, request 3, auth-api 5, auth-store 7, LoginScreen 9).

- [ ] **Step 3: Commit**

```bash
git add packages/web-kit/src/index.ts
git commit -m "feat(web-kit): export LoginScreen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Reduce the 5 app login screens to wrappers

**Files:** rewrite `apps/web-{do,say,buy,eat,send}/app/(auth)/login.tsx`; delete `apps/web-{do,buy,eat,send}/__tests__/login.test.tsx`.

- [ ] **Step 1: Rewrite each `app/(auth)/login.tsx`** to the wrapper. Per app, the file becomes (with the per-app title):

`apps/web-do/app/(auth)/login.tsx`:

```tsx
import { LoginScreen } from '@things/web-kit';

export default function Login() {
  return <LoginScreen appName="Do Things" />;
}
```

Same shape for the others, changing only the title:

- `apps/web-say/...` → `appName="Say Things"`
- `apps/web-buy/...` → `appName="Buy Things"`
- `apps/web-eat/...` → `appName="Eat Things"`
- `apps/web-send/...` → `appName="Send Things"`

- [ ] **Step 2: Delete the consolidated app login tests**

```bash
git rm apps/web-do/__tests__/login.test.tsx \
       apps/web-buy/__tests__/login.test.tsx \
       apps/web-eat/__tests__/login.test.tsx \
       apps/web-send/__tests__/login.test.tsx
```

- [ ] **Step 3: Verify each app**

Run:

```bash
for app in web-do web-say web-buy web-eat web-send; do
  echo "== $app =="
  npm run typecheck -w @things/$app 2>&1 | tail -1
  npm run test:unit -w @things/$app 2>&1 | grep -E "Tests:|FAIL"
done
```

Expected: every app typechecks; suites pass (login behavior now covered once in web-kit).

- [ ] **Step 4: Commit**

```bash
git add apps/web-do apps/web-say apps/web-buy apps/web-eat apps/web-send
git commit -m "refactor(web): render shared LoginScreen in all 5 apps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Workspace gate + PR

- [ ] **Step 1: Confirm the login screens are wrappers**

```bash
for app in web-do web-say web-buy web-eat web-send; do echo "$app: $(wc -l < apps/$app/app/\(auth\)/login.tsx) lines"; done
grep -rn "Heading level={1}" apps/web-*/app || echo "no inline wordmark headings remain in apps"
```

Expected: each `login.tsx` ~5 lines; no app renders the `level={1}` wordmark directly.

- [ ] **Step 2: Run the CI gate**

```bash
npm run build:packages
npm run typecheck
npm run lint
npm run test:unit
```

Expected: all PASS across the workspace; `@things/web-kit` now 5 suites / 25 tests.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin refactor/web-kit-login
gh pr create --base main --title "refactor(web): shared LoginScreen in @things/web-kit (web-kit PR 3)" \
  --body "PR 3 (final) of the web-app duplication extraction (spec: docs/superpowers/specs/2026-06-12-web-app-dedup-design.md). Moves the login screen into @things/web-kit as LoginScreen({ appName }); each app's login.tsx is now a ~4-line wrapper. The duplicated login tests consolidate into web-kit. Behavior unchanged."
```

---

## Self-review (plan vs. spec PR 3)

- **Spec coverage:** `LoginScreen({ appName })` added to web-kit with line-44 → `{appName}` (Task 2); web-kit gains design-system/rhf/resolvers/zod deps + react-native peer (Task 1); each `login.tsx` becomes the ~4-line wrapper (Task 4); the `@testing-library/react-native` test covers appName/toggle/submit/error (Task 2). Covered, plus the test-consolidation from the spec's implementation notes (delete 4 app `login.test.tsx`).
- **Placeholder scan:** none — full component + full test + exact per-app wrappers + exact `git rm` list.
- **Naming/type consistency:** prop is `appName: string` everywhere; `LoginScreen` named export; imports `useAuth` from `./auth-store` (internal) and primitives from `@things/design-system`; mock target is `../auth-store` (matches the component's import).
- **Reanimated:** the jest.setup mock + devDep are added in Task 1, before the component that needs them (Task 2) — ordering safe.
