import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heading, Button, Card, TextInput, tokens } from '@things/design-system';
import { useAuth } from '../../store/auth.store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
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
      <Heading level={1}>Do Things</Heading>
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
