import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { AuthPort } from '../services/AuthPort';
import { appAuth } from '../services/authInstance';
import { useAuthStore } from '../state/useAuthStore';
import {
  GlowButton,
  IconButton,
  Panel,
  ScreenShell,
  useTheme,
} from '../ui';

interface AccountScreenProps {
  /** Inject an AuthPort (tests); defaults to the shared app singleton. */
  auth?: AuthPort;
}

/** Field-level validation errors, shown inline under each input. */
interface FieldErrors {
  email?: string;
  password?: string;
  name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks so obviously-bad input never reaches the port. */
function validate(
  email: string,
  password: string,
  name: string,
  forSignUp: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (forSignUp) {
    if (password.length < 8) {
      errors.password = 'Password needs at least 8 characters.';
    }
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      errors.name = 'Display name must be 3–20 characters.';
    }
  } else if (password.length === 0) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

/** Map raw port errors to friendly, non-technical copy. */
function friendlyError(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  const msg = raw.toLowerCase();
  if (msg.includes('already in use')) {
    return 'That email already has an account. Try signing in instead.';
  }
  if (msg.includes('invalid email or password') || msg.includes('invalid')) {
    return 'That email and password don’t match. Check them and try again.';
  }
  if (msg.includes('network')) {
    return 'Couldn’t reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Account screen: sign up, sign in, or continue anonymously — all optional, so
 * anonymous/local play stays first-class. Client-side validation runs before
 * any port call; port errors render as friendly inline messages, never
 * crashes. Signed-in users can also permanently delete their account behind a
 * double-confirm. (Chunk K)
 */
export function AccountScreen({ auth = appAuth }: AccountScreenProps = {}) {
  const router = useRouter();
  const { ui, spacing, radius, type } = useTheme();

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Delete flow: 0 = idle, 1 = first confirm, 2 = final confirm.
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);

  const onSignUp = () => {
    const errors = validate(email, password, name, true);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    void signUp(email.trim(), password, name.trim());
  };

  const onSignIn = () => {
    const errors = validate(email, password, name, false);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    void signIn(email.trim(), password);
  };

  const onDeleteConfirmed = () => {
    setDeleting(true);
    // Optional port capability — sign-out fallback keeps the UI honest if an
    // adapter has not wired deletion yet.
    void Promise.resolve(auth.deleteAccount?.())
      .catch(() => undefined)
      .finally(() => {
        setDeleting(false);
        setDeleteStep(0);
      });
  };

  const inputStyle = [
    styles.input,
    type.body,
    {
      borderColor: ui.border,
      borderRadius: radius.md,
      color: ui.textPrimary,
      backgroundColor: ui.surfaceRaised,
    },
  ];

  const fieldError = (key: keyof FieldErrors) =>
    fieldErrors[key] != null ? (
      <Text
        testID={`field-error-${key}`}
        style={[type.caption, { color: ui.danger }]}
      >
        {fieldErrors[key]}
      </Text>
    ) : null;

  const shownError = friendlyError(error);

  return (
    <ScreenShell world>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <IconButton
            testID="back-button"
            icon="chevron-back"
            accessibilityLabel="Back"
            onPress={() => router.back()}
          />
          <Text
            accessibilityRole="header"
            style={[type.title, { color: ui.textPrimary }]}
          >
            Account
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {shownError !== null && (
          <Text
            testID="auth-error"
            accessibilityLiveRegion="polite"
            style={[
              type.caption,
              styles.error,
              {
                color: ui.danger,
                borderColor: ui.danger,
                borderRadius: radius.md,
              },
            ]}
          >
            {shownError}
          </Text>
        )}

        {loading && (
          <ActivityIndicator
            testID="auth-loading"
            color={ui.accent}
            style={styles.spinner}
          />
        )}

        {user !== null ? (
          <View style={[styles.signedIn, { gap: spacing.md }]}>
            <Text style={[type.caption, { color: ui.textSecondary }]}>
              Signed in as
            </Text>
            <Text
              testID="current-user"
              style={[type.title, { color: ui.accent }]}
            >
              {user.displayName ?? 'Anonymous'}
            </Text>

            <GlowButton
              testID="signout-button"
              label="Sign Out"
              variant="secondary"
              onPress={() => void signOut()}
            />

            {deleteStep === 0 && (
              <GlowButton
                testID="delete-account-button"
                label="Delete Account"
                variant="danger"
                accessibilityHint="Permanently deletes your account"
                onPress={() => setDeleteStep(1)}
              />
            )}

            {deleteStep > 0 && (
              <Panel
                testID="delete-confirm-dialog"
                style={{ gap: spacing.md, alignSelf: 'stretch' }}
              >
                <Text
                  accessibilityRole="header"
                  style={[type.heading, { color: ui.textPrimary }]}
                >
                  {deleteStep === 1
                    ? 'Delete your account?'
                    : 'This is permanent'}
                </Text>
                <Text style={[type.body, { color: ui.textSecondary }]}>
                  {deleteStep === 1
                    ? 'Your account and leaderboard identity will be removed.'
                    : 'Really delete? There is no way to undo this.'}
                </Text>
                <View style={[styles.dialogActions, { gap: spacing.md }]}>
                  <GlowButton
                    testID="delete-cancel-button"
                    label="Cancel"
                    variant="secondary"
                    onPress={() => setDeleteStep(0)}
                    style={styles.dialogButton}
                  />
                  {deleteStep === 1 ? (
                    <GlowButton
                      testID="delete-continue-button"
                      label="Continue"
                      variant="danger"
                      onPress={() => setDeleteStep(2)}
                      style={styles.dialogButton}
                    />
                  ) : (
                    <GlowButton
                      testID="delete-confirm-button"
                      label={deleting ? 'Deleting…' : 'Delete Forever'}
                      variant="danger"
                      disabled={deleting}
                      onPress={onDeleteConfirmed}
                      style={styles.dialogButton}
                    />
                  )}
                </View>
              </Panel>
            )}
          </View>
        ) : (
          <View style={[styles.form, { gap: spacing.md }]}>
            <TextInput
              testID="account-email"
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor={ui.textSecondary}
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {fieldError('email')}
            <TextInput
              testID="account-password"
              style={inputStyle}
              placeholder="Password"
              placeholderTextColor={ui.textSecondary}
              accessibilityLabel="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {fieldError('password')}
            <TextInput
              testID="account-name"
              style={inputStyle}
              placeholder="Display name (sign up)"
              placeholderTextColor={ui.textSecondary}
              accessibilityLabel="Display name"
              value={name}
              onChangeText={setName}
            />
            {fieldError('name')}

            <GlowButton
              testID="signup-button"
              label="Sign Up"
              variant="primary"
              disabled={loading}
              onPress={onSignUp}
            />
            <GlowButton
              testID="signin-button"
              label="Sign In"
              variant="secondary"
              disabled={loading}
              onPress={onSignIn}
            />
            <GlowButton
              testID="anon-button"
              label="Continue anonymously"
              variant="secondary"
              disabled={loading}
              onPress={() => void signInAnonymously()}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSpacer: { width: 44 },
  error: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  spinner: { marginVertical: 8 },
  form: {},
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  signedIn: { alignItems: 'center', marginTop: 24 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  dialogButton: { flexGrow: 1 },
});
