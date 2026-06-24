# Internationalization (i18n) Guide

> **Goal**: Support multiple languages in the application.
> **Rule**: No hardcoded text. Every visible string must use `t('key')`.

## File Structure

```
frontend/src/i18n/
├── index.ts           # i18n configuration
└── locales/
    ├── en.json        # English translations
    ├── es.json        # Spanish translations
    └── fr.json        # French translations
```

---

## Step 1: Install Dependencies

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

---

## Step 2: Configure i18n

**File**: `frontend/src/i18n/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
```

---

## Step 3: Create Translation Files

**File**: `frontend/src/i18n/locales/en.json`

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading..."
  },
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "emailPlaceholder": "Enter your email"
  },
  "users": {
    "title": "Users",
    "createUser": "Create User",
    "editUser": "Edit User",
    "deleteConfirm": "Are you sure you want to delete this user?",
    "userCreated": "User created successfully",
    "userDeleted": "User deleted successfully"
  }
}
```

**File**: `frontend/src/i18n/locales/es.json`

```json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "loading": "Cargando..."
  },
  "auth": {
    "login": "Iniciar sesión",
    "logout": "Cerrar sesión",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "emailPlaceholder": "Ingrese su correo"
  },
  "users": {
    "title": "Usuarios",
    "createUser": "Crear Usuario",
    "editUser": "Editar Usuario",
    "deleteConfirm": "¿Está seguro de que desea eliminar este usuario?",
    "userCreated": "Usuario creado exitosamente",
    "userDeleted": "Usuario eliminado exitosamente"
  }
}
```

---

## Step 4: Initialize in App

**File**: `frontend/src/main.tsx`

```typescript
import './i18n'; // Import before App

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
```

---

## Step 5: Use in Components

### Basic Usage

```typescript
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('auth.login')}</h1>
      <input placeholder={t('auth.emailPlaceholder')} />
      <button>{t('common.save')}</button>
    </div>
  );
};
```

### With Variables

**Translation**:
```json
{
  "users": {
    "greeting": "Hello, {{name}}!",
    "itemCount": "You have {{count}} items"
  }
}
```

**Usage**:
```typescript
const { t } = useTranslation();

<p>{t('users.greeting', { name: user.name })}</p>
<p>{t('users.itemCount', { count: items.length })}</p>
```

### Pluralization

**Translation**:
```json
{
  "users": {
    "itemCount_one": "{{count}} item",
    "itemCount_other": "{{count}} items"
  }
}
```

**Usage**:
```typescript
<p>{t('users.itemCount', { count: items.length })}</p>
```

---

## Step 6: Language Switcher

**File**: `frontend/src/components/shared/LanguageSwitcher.tsx`

```typescript
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
];

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <Select value={i18n.language} onValueChange={(lang) => i18n.changeLanguage(lang)}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

---

## Best Practices

1. **Nested Keys**: Group by feature (`auth.login`, `users.title`)
2. **No Hardcoded Text**: Every visible string must use `t()`
3. **Consistent Naming**: Use camelCase for keys
4. **Variables**: Use `{{variable}}` syntax
5. **Pluralization**: Use `_one`, `_other` suffixes

---

## Checklist

- [ ] i18next installed and configured
- [ ] Translation files created for each language
- [ ] i18n imported in `main.tsx`
- [ ] All text uses `t()` function
- [ ] Language switcher component created
- [ ] No hardcoded strings in components
