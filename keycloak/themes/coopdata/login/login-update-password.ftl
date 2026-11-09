<#import "template.ftl" as layout>

<#-- One row of the live password checklist (see the policy block in the form). -->
<#macro policyRule rule text>
    <li class="password-rule" data-rule="${rule}" data-state="pending">
        <span class="password-rule-icon" aria-hidden="true">
            <svg class="icon-pending" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
            <svg class="icon-met" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>
            <svg class="icon-unmet" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
        </span>
        <span class="password-rule-text">${text}</span>
        <span class="sr-only password-rule-status"></span>
    </li>
</#macro>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('password-new','password-confirm') displayInfo=false; section>
    <#if section = "header">
        <#-- Header handled inside form panel -->
    <#elseif section = "form">
        <div class="split-screen-layout">
            <#-- Left Brand Panel -->
            <aside class="brand-panel">
                <div class="grid-pattern"></div>
                <div class="gradient-orb orb-1"></div>
                <div class="gradient-orb orb-2"></div>

                <div class="brand-logo">
                    <img src="${url.resourcesPath}/img/coopdatalogo.png" alt="CoopData Logo" width="180" height="44" />
                </div>

                <div class="brand-content">
                    <div class="flex size-12 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>
                    <div>
                        <h2>${msg("secureAccountTitle")}</h2>
                        <p>${msg("secureAccountBody")}</p>
                    </div>
                    <ul class="brand-features">
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            ${msg("featureEncrypted")}
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            ${msg("featureResetSessions")}
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            ${msg("featureAuditTrail")}
                        </li>
                    </ul>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} ${msg("ministryName")}</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <#assign appUrl = "/">
                    <#if client?? && client.rootUrl?? && client.rootUrl?has_content && client.rootUrl?starts_with("http") && !client.rootUrl?contains("/account") && !client.rootUrl?contains("/realms/")>
                        <#assign appUrl = client.rootUrl>
                    <#elseif client?? && client.baseUrl?? && client.baseUrl?has_content && client.baseUrl?starts_with("http") && !client.baseUrl?contains("/account") && !client.baseUrl?contains("/realms/")>
                        <#assign appUrl = client.baseUrl>
                    <#elseif url.resourcesPath?? && url.resourcesPath?starts_with("http")>
                        <#assign appUrl = url.resourcesPath?keep_before("/realms/")>
                    <#elseif url.loginUrl?? && url.loginUrl?starts_with("http")>
                        <#assign appUrl = url.loginUrl?keep_before("/realms/")>
                    </#if>
                    <a href="${appUrl}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        ${msg("backToHome")}
                    </a>
                </div>

                <div class="form-container">
                    <div class="form-header">
                        <div class="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/20 mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            ${msg("updatePasswordBadge")}
                        </div>
                        <h1>${msg("updatePasswordTitle")}</h1>
                        <p>${msg("updatePasswordSubtitle")}</p>
                    </div>

                    <form id="kc-passwd-update-form" class="login-form" action="${url.loginAction}" method="post">
                        <div class="form-group">
                            <label for="password-new">${msg("passwordNew")}</label>
                            <div class="password-input-group">
                                <input tabindex="1" id="password-new" class="form-control" name="password-new" type="password" autofocus autocomplete="new-password" aria-describedby="password-policy"
                                       aria-invalid="<#if messagesPerField.existsError('password-new')>true</#if>"
                                />
                                <button class="password-toggle" type="button" aria-label="${msg("showPassword")}" tabindex="3" data-password-toggle>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                    </svg>
                                </button>
                            </div>
                            <#if messagesPerField.existsError('password-new')>
                                <span id="input-error-password-new" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.getFirstError('password-new'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="form-group">
                            <label for="password-confirm">${msg("passwordConfirm")}</label>
                            <div class="password-input-group">
                                <input tabindex="2" id="password-confirm" class="form-control" name="password-confirm" type="password" autocomplete="new-password"
                                       aria-invalid="<#if messagesPerField.existsError('password-confirm')>true</#if>"
                                />
                                <button class="password-toggle" type="button" aria-label="${msg("showPassword")}" tabindex="4" data-password-toggle>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                    </svg>
                                </button>
                            </div>
                            <#if messagesPerField.existsError('password-confirm')>
                                <span id="input-error-password-confirm" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.getFirstError('password-confirm'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <#if logoutOtherSessions??>
                            <div class="checkbox" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: var(--muted); border-radius: var(--radius); margin-top: 0.25rem;">
                                <input tabindex="5" id="logout-sessions" name="logout-sessions" type="checkbox" checked>
                                <label for="logout-sessions" style="font-size: 0.8125rem; text-transform: none; letter-spacing: normal; color: var(--foreground); cursor: pointer;">
                                    ${msg("logoutOtherSessions")}
                                </label>
                            </div>
                        </#if>

                        <#--
                            Live checklist (resources/js/login.js ticks each rule as the user types).
                            Mirrors the realm policy set in keycloak/provision.sh:
                            length(8), upperCase(1), lowerCase(1), digits(1), specialChars(1), notUsername.
                            Keycloak still enforces the policy server-side; this only explains it.
                        -->
                        <div class="password-policy" id="password-policy"
                             data-min-length="8"
                             data-username="${(username)!''}"
                             data-met-label="${msg("passwordRequirementMet")}"
                             data-unmet-label="${msg("passwordRequirementNotMet")}">
                            <p class="password-policy-title" id="password-policy-title">${msg("passwordPolicyTitle")}</p>
                            <ul class="password-policy-list" aria-labelledby="password-policy-title">
                                <@policyRule rule="length" text=msg("passwordPolicyMinLength") />
                                <@policyRule rule="upper" text=msg("passwordPolicyUpper") />
                                <@policyRule rule="lower" text=msg("passwordPolicyLower") />
                                <@policyRule rule="digit" text=msg("passwordPolicyDigit") />
                                <@policyRule rule="special" text=msg("passwordPolicySpecial") />
                                <@policyRule rule="notUsername" text=msg("passwordPolicyNotUsername") />
                                <@policyRule rule="match" text=msg("passwordPolicyMatch") />
                            </ul>
                        </div>

                        <div id="password-policy-error" class="alert-error" role="alert" hidden>
                            ${msg("passwordPolicyNotMet")}
                        </div>

                        <div class="form-actions">
                            <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                            <button tabindex="6" class="btn-primary" name="submit" id="kc-submit" type="submit">
                                ${msg("updatePasswordButton")}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>

                        <p class="form-disclaimer">
                            ${msg("updatePasswordDisclaimer")}
                        </p>
                    </form>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>