import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { AuthPort } from '../services/AuthPort';
import { appAuth } from '../services/authInstance';
import { useAuthStore } from '../state/useAuthStore';
import { useSkin } from '../skins/SkinProvider';

interface AccountScreenProps {
  /** Inject an AuthPort (tests); defaults to the shared app singleton. */
  auth?: AuthPort;
}

/**
 * Account screen: sign up, sign in, or continue anonymously — all optional, so
 * anonymous/local play stays first-class. Auth errors render as inline messages
 * (from the store's rejected promises), never crashes. (Chunk K)
 */
export function AccountScreen({ auth = appAuth }: AccountScreenProps = {}) {
  const router = useRouter();
  const skin = useSkin();

  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const signUp = useAuthStore((s) => s.signUp);
  const signIn = useAuthStore((s) => s.signIn);
  const signInAnonymously = useAuthStore((s) => s.signInAnonymously);
  const signOut = useAuthStore((s) => s.signOut);

  // Follow this AuthPort's state for the screen's lifetime.
  useEffect(() => useAuthStore.getState().hydrate(auth), [auth]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: skin.background }]}>
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        >
          <Text style={[styles.back, { color: skin.snakeBody }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: skin.snakeHead }]}>Account</Text>
      </View>

      {error !== null && (
        <Text testID="auth-error" style={styles.error}>
          {error}
        </Text>
      )}

      {user !== null ? (
        <View style={styles.signedIn}>
          <Text style={styles.signedInLabel}>Signed in as</Text>
          <Text
            testID="current-user"
            style={[styles.currentUser, { color: skin.snakeHead }]}
          >
            {user.displayName ?? 'Anonymous'}
          </Text>
          <Pressable
            testID="signout-button"
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryLabel}>Sign Out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            testID="account-email"
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            testID="account-password"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            testID="account-name"
            style={styles.input}
            placeholder="Display name (sign up)"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />

          <Pressable
            testID="signup-button"
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void signUp(email, password, name)}
            style={[styles.primaryButton, { backgroundColor: skin.snakeBody }]}
          >
            <Text style={styles.primaryLabel}>Sign Up</Text>
          </Pressable>

          <Pressable
            testID="signin-button"
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void signIn(email, password)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryLabel}>Sign In</Text>
          </Pressable>

          <Pressable
            testID="anon-button"
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void signInAnonymously()}
            style={styles.anonButton}
          >
            <Text style={styles.anonLabel}>Continue anonymously</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64, paddingHorizontal: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  back: { fontSize: 18 },
  title: { fontSize: 28, fontWeight: '800' },
  error: {
    color: '#e06464',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(224,100,100,0.12)',
  },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#eee',
    fontSize: 16,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryLabel: { color: '#000', fontSize: 17, fontWeight: '700' },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  secondaryLabel: { color: '#ddd', fontSize: 16, fontWeight: '600' },
  anonButton: { paddingVertical: 12, alignItems: 'center' },
  anonLabel: { color: '#888', fontSize: 15 },
  signedIn: { gap: 12, alignItems: 'center', marginTop: 24 },
  signedInLabel: { color: '#888', fontSize: 14 },
  currentUser: { fontSize: 26, fontWeight: '800' },
});
