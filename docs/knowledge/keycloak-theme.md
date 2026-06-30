# Keycloak Custom Login Theme

## Overview

This document describes the custom Keycloak login theme implementation for CoopData. The theme replaces the default Keycloak login page with a branded split-screen design that matches the frontend application's visual identity.

## Theme Structure

```
keycloak/themes/coopdata/login/
├── theme.properties          # Theme configuration
├── template.ftl              # Base template layout
├── login.ftl                 # Login page template
└── resources/
    ├── css/
    │   └── styles.css        # Theme styles
    ├── js/
    │   └── login.js          # Client-side scripts
    └── img/
        ├── coopdatalogo.png  # Logo for form panel
        └── coopdatalogo.jpg  # Logo for brand panel
```

## Configuration

### theme.properties

```properties
parent=base
import=common/keycloak

styles=css/styles.css
scripts=js/login.js
favicon=img/coopdatalogo.jpg
meta=viewport==width=device-width,initial-scale=1

# Custom properties
kcFormGroupClass=form-group
kcLabelClass=kc-label
kcInputClass=form-control
kcButtonClass=btn
kcButtonPrimaryClass=btn-primary
```

### Realm Configuration

The theme is activated by setting `loginTheme: "coopdata"` in the realm configuration (`keycloak/realm-coopdata.json`).

### Docker Integration

The theme is mounted into the Keycloak container via docker-compose:

```yaml
volumes:
  - ./keycloak:/opt/keycloak/data/import
  - ./keycloak/themes:/opt/keycloak/themes
```

## Design

### Split-Screen Layout

The login page uses a two-column layout on desktop (1024px+):

- **Left Panel (Brand Panel)**: Navy blue background with geometric grid pattern, gradient orbs, CoopData logo, tagline, and feature list
- **Right Panel (Form Panel)**: Clean white background with navigation bar, logo, login form, and social sign-in options

On mobile/tablet, only the form panel is displayed.

### Color Tokens

The theme uses OKLCH color space matching the frontend design system:

```css
:root {
    --primary: oklch(0.22 0.06 258);        /* Navy blue */
    --accent: oklch(0.5 0.17 240);          /* Blue accent */
    --background: oklch(0.985 0.002 250);   /* Light background */
    --foreground: oklch(0.13 0.04 258);     /* Dark text */
    --surface: oklch(1 0 0);                /* White surface */
    --border: oklch(0.91 0.008 255);        /* Light border */
}
```

### Typography

- **Body**: DM Sans (400, 500, 600, 700)
- **Headings**: DM Serif Display

## Customization

### Changing the Logo

Replace the logo files in `keycloak/themes/coopdata/login/resources/img/`:

- `coopdatalogo.png` - Used in the form panel (transparent background recommended)
- `coopdatalogo.jpg` - Used in the brand panel and as favicon

Update references in `login.ftl` and `theme.properties` if filenames change.

### Modifying Colors

Edit the CSS variables in `keycloak/themes/coopdata/login/resources/css/styles.css`:

```css
:root {
    --primary: oklch(0.22 0.06 258);  /* Change this */
    --accent: oklch(0.5 0.17 240);    /* Change this */
}
```

### Adding Social Providers

Social providers are automatically rendered if configured in the Keycloak realm. The template includes:

```ftl
<#if realm.password && social.providers??>
    <div id="kc-social-providers" class="social-providers">
        <ul>
            <#list social.providers as p>
                <li>
                    <a id="social-${p.alias}" href="${p.loginUrl}">
                        ${p.displayName!}
                    </a>
                </li>
            </#list>
        </ul>
    </div>
</#if>
```

## Development

### Hot Reloading

With the volume mount configured, theme changes are reflected immediately after refreshing the browser. No container restart is required for CSS/JS changes.

For template (`.ftl`) changes, a container restart may be needed:

```bash
docker compose restart keycloak
```

### Testing

1. Navigate to `http://localhost:8180/realms/coop-data/protocol/openid-connect/auth`
2. Verify the split-screen layout on desktop
3. Test responsive behavior by resizing the browser
4. Test form submission and error handling
5. Verify dark mode (if system preference is set)

## Troubleshooting

### Theme Not Appearing

1. Verify the volume mount is configured in `docker-compose.yml`
2. Check that `loginTheme: "coopdata"` is set in the realm configuration
3. Restart the Keycloak container: `docker compose restart keycloak`

### Styles Not Loading

1. Check the browser console for 404 errors on CSS files
2. Verify `theme.properties` references the correct CSS file path
3. Ensure the CSS file exists at `keycloak/themes/coopdata/login/resources/css/styles.css`

### Template Errors

1. Check Keycloak logs for FreeMarker parsing errors
2. Verify all `<#if>` blocks are properly closed with `</#if>`
3. Ensure all variables are properly escaped with `${...}`

## Related Documentation

- [Authentication Guide](./frontend/authentication.md)
- [UI Design System](./frontend/ui-design.md)
- [RBAC and Auth System](../RBAC_AND_AUTH_SYSTEM.md)
