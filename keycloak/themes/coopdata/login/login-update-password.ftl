<#import "template.ftl" as layout>
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
                        <h2>Secure your account with a new password.</h2>
                        <p>CoopData enforces strong password policies and device verification to keep your data safe.</p>
                    </div>
                    <ul class="brand-features">
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Encrypted at rest and in transit
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Reset sessions across all devices
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Full audit trail on every action
                        </li>
                    </ul>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} Ministry of Commerce &amp; Cooperative Development</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <a href="/" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Back to home
                    </a>
                </div>

                <div class="form-container">
                    <div class="form-header">
                        <div class="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/20 mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Update password
                        </div>
                        <h1>Update your password</h1>
                        <p>Create a new password to secure your account.</p>
                    </div>

                    <form id="kc-passwd-update-form" class="login-form" action="${url.loginAction}" method="post">
                        <div class="form-group">
                            <label for="password-new">${msg("passwordNew")}</label>
                            <div class="password-input-group">
                                <input tabindex="1" id="password-new" class="form-control" name="password-new" type="password" autofocus autocomplete="new-password"
                                       aria-invalid="<#if messagesPerField.existsError('password-new')>true</#if>"
                                />
                                <button class="password-toggle" type="button" aria-label="Show password" tabindex="3" data-password-toggle>
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
                                <button class="password-toggle" type="button" aria-label="Show password" tabindex="4" data-password-toggle>
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

                        <div class="form-actions">
                            <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                            <button tabindex="6" class="btn-primary" name="submit" id="kc-submit" type="submit">
                                Update password
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>

                        <p class="form-disclaimer">
                            By updating your password you acknowledge this is the official CoopData platform for the Ministry
                            of Commerce &amp; Cooperative Development.
                        </p>
                    </form>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>