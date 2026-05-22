import { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Heading, Button, Card, tokens } from '@things/design-system';
import { useAuth } from '../../store/auth.store';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={{ flex: 1, justifyContent: 'center', padding: tokens.space[6], gap: tokens.space[4] }}
    >
      <Heading level={1}>Do Things</Heading>
      <Card>
        <View style={{ gap: tokens.space[3] }}>
          <Heading level={3}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Heading>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              borderWidth: 1,
              borderColor: tokens.colors.ink[200],
              borderRadius: tokens.radius.md,
              padding: tokens.space[3],
              fontSize: tokens.typography.fontSize.base,
            }}
            testID="login-email"
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: tokens.colors.ink[200],
              borderRadius: tokens.radius.md,
              padding: tokens.space[3],
              fontSize: tokens.typography.fontSize.base,
            }}
            testID="login-password"
          />
          {error && (
            <View
              style={{
                padding: tokens.space[2],
                backgroundColor: tokens.colors.semantic.danger + '20',
                borderRadius: tokens.radius.sm,
              }}
            >
              <Heading level={4}>{error}</Heading>
            </View>
          )}
          <Button
            label={submitting ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            onPress={submit}
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
