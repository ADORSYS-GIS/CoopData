<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=true; section>
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
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </div>
                    <div>
                        <h2>Don't worry — it happens to the best of us.</h2>
                        <p>Enter the email address associated with your account and we'll send you a link to reset your password.</p>
                    </div>
                    <ul class="brand-features">
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Password resets expire after 15 minutes
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Your existing sessions remain active
                        </li>
                    </ul>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} Ministry of Commerce &amp; Cooperative Development</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <a href="${url.loginUrl}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Back to sign in
                    </a>
                </div>

                <div class="form-container">
                    <div class="form-header">
                        <div class="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/20 mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Password reset
                        </div>
                        <h1>Reset your password</h1>
                        <p>Enter your email and we'll send you a reset link.</p>
                    </div>

                    <#if message?has_content && message.type?contains("success")>
                        <div class="alert-success" style="background: oklch(0.52 0.14 155 / 0.08); border: 1px solid oklch(0.52 0.14 155 / 0.3); color: oklch(0.4 0.14 155); border-radius: var(--radius); padding: 0.875rem 1rem; font-size: 0.875rem; margin-bottom: 1.5rem;">
                            ${kcSanitize(message.summary)?no_esc}
                        </div>
                    </#if>

                    <form id="kc-reset-password-form" class="login-form" action="${url.loginAction}" method="post">
                        <div class="form-group">
                            <label for="username">
                                <#if !realm.loginWithEmailAllowed>${msg("username")}
                                <#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}
                                <#else>${msg("email")}
                                </#if>
                            </label>
                            <input tabindex="1" id="username" class="form-control" name="username" value="${(auth.attemptedUsername!'')}" type="text" autofocus autocomplete="username"
                                   aria-invalid="<#if messagesPerField.existsError('username')>true</#if>"
                            />
                            <#if messagesPerField.existsError('username')>
                                <span id="input-error-username" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.getFirstError('username'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="form-actions">
                            <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                            <button tabindex="2" class="btn-primary" name="submit" id="kc-submit" type="submit">
                                Send reset link
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>
                    </form>

                    <p class="form-disclaimer">
                        Remember your password?
                        <a href="${url.loginUrl}" class="forgot-link">Sign in instead</a>
                    </p>
                </div>
            </main>
        </div>
    <#elseif section = "info">
        <#-- Info section is handled inline above for success messages -->
    </#if>
</@layout.registrationLayout>