export type PasswordRuleKey =
  "minLength" | "uppercase" | "lowercase" | "digit" | "special" | "notUsername";

export interface PasswordRuleResult {
  key: PasswordRuleKey;
  met: boolean;
}

export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  notUsername: true,
} as const;

const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const DIGIT_RE = /\d/;
const SPECIAL_RE = /[^A-Za-z0-9]/;

export function validatePassword(password: string, username?: string): PasswordRuleResult[] {
  return [
    { key: "minLength", met: password.length >= PASSWORD_POLICY.minLength },
    { key: "uppercase", met: UPPERCASE_RE.test(password) },
    { key: "lowercase", met: LOWERCASE_RE.test(password) },
    { key: "digit", met: DIGIT_RE.test(password) },
    { key: "special", met: SPECIAL_RE.test(password) },
    {
      key: "notUsername",
      met: !username || password.toLowerCase() !== username.toLowerCase(),
    },
  ];
}

export function isPasswordValid(password: string, username?: string): boolean {
  return validatePassword(password, username).every((rule) => rule.met);
}
