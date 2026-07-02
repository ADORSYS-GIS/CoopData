<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
        <#-- Header is handled inside the form panel -->
    <#elseif section = "form">
        <div class="split-screen-layout">
            <#-- Left Brand Panel (visible on desktop) -->
            <aside class="brand-panel">
                <#-- Geometric background pattern -->
                <div class="grid-pattern"></div>
                <#-- Gradient orbs -->
                <div class="gradient-orb orb-1"></div>
                <div class="gradient-orb orb-2"></div>

                <#-- Logo -->
                <div class="brand-logo">
                    <img src="${url.resourcesPath}/img/coopdatalogo.png" alt="CoopData Logo" width="180" height="44" />
                </div>

                <#-- Main brand content -->
                <div class="brand-content">
                    <h2>Trusted access for every cooperative stakeholder.</h2>
                    <p>CoopData enforces role-based access and device verification for every ministry official, federation officer, cooperative manager, and regional officer.</p>
                    <ul class="brand-features">
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Role-specific dashboards and permissions
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Secure data submission and validation
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Full audit trail on every action
                        </li>
                    </ul>
                </div>

                <p class="brand-footer">
                    &copy; ${.now?string('yyyy')} Ministry of Commerce & Cooperative Development
                </p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <#-- Top bar -->
                <div class="top-bar">
                    <a href="/" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Back to home
                    </a>
                    <p class="top-bar-help">
                        Need access? <a href="${url.registrationUrl}" class="invitation-link">Request invitation</a>
                    </p>
                </div>

                <#-- Form content -->
                <div class="form-container">
                    <div class="form-header">
                        <div class="form-logo">
                            <img src="${url.resourcesPath}/img/coopdatalogo.png" alt="CoopData Logo" />
                        </div>
                        <h1>Sign in to CoopData</h1>
                        <p>Enter your credentials to access your dashboard.</p>
                    </div>

                    <#if realm.password>
                        <form id="kc-form-login" class="login-form" onsubmit="login.disabled = true;" action="${url.loginAction}" method="post">
                            <#if !usernameHidden??>
                                <div class="form-group">
                                    <label for="username">
                                        <#if !realm.loginWithEmailAllowed>${msg("username")}
                                        <#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}
                                        <#else>${msg("email")}
                                        </#if>
                                    </label>
                                    <input tabindex="1" id="username" class="form-control" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="username"
                                           aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                    />
                                    <#if messagesPerField.existsError('username','password')>
                                        <span id="input-error-username" class="alert-error" aria-live="polite">
                                            ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                                        </span>
                                    </#if>
                                </div>
                            </#if>

                            <div class="form-group">
                                <label for="password">${msg("password")}</label>
                                <div class="password-input-group">
                                    <input tabindex="2" id="password" class="form-control" name="password" type="password" autocomplete="current-password"
                                           aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                                    />
                                    <button class="password-toggle" type="button" aria-label="${msg("showPassword")}"
                                            tabindex="3" data-password-toggle
                                            data-icon-show="fa-eye fas" data-icon-hide="fa-eye-slash fas"
                                            data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>
                                </div>
                                <#if messagesPerField.existsError('password')>
                                    <span id="input-error-password" class="alert-error" aria-live="polite">
                                        ${kcSanitize(messagesPerField.getFirstError('password'))?no_esc}
                                    </span>
                                </#if>
                            </div>

                            <div class="form-options">
                                <#if realm.rememberMe && !usernameHidden??>
                                    <div class="checkbox">
                                        <label for="rememberMe">
                                            <#if login.rememberMe??>
                                                <input tabindex="4" id="rememberMe" name="rememberMe" type="checkbox" checked>
                                            <#else>
                                                <input tabindex="4" id="rememberMe" name="rememberMe" type="checkbox">
                                            </#if>
                                            ${msg("rememberMe")}
                                        </label>
                                    </div>
                                </#if>
                                <#if realm.resetPasswordAllowed>
                                    <a tabindex="5" href="${url.loginResetCredentialsUrl}" class="forgot-link">${msg("doForgotPassword")}</a>
                                </#if>
                            </div>

                            <div class="form-actions">
                                <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                                <button tabindex="6" class="btn-primary" name="login" id="kc-login" type="submit">
                                    Sign in
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            </div>

                            <p class="form-disclaimer">
                                By signing in you acknowledge this is the official CoopData platform for the Ministry of Commerce & Cooperative Development.
                            </p>
                        </form>
                    </#if>

                    <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
                        <div class="registration-link">
                            <span>${msg("noAccount")} <a tabindex="7" href="${url.registrationUrl}">${msg("doRegister")}</a></span>
                        </div>
                    </#if>

                    <#if realm.password && social.providers??>
                        <div id="kc-social-providers" class="social-providers">
                            <ul>
                                <#list social.providers as p>
                                    <li>
                                        <a id="social-${p.alias}" class="kc-social-items-item" href="${p.loginUrl}">
                                            <#if p.iconClasses?has_content>
                                                <i class="${p.iconClasses!}" aria-hidden="true"></i>
                                                <span>${p.displayName!}</span>
                                            <#else>
                                                <span>${p.displayName!}</span>
                                            </#if>
                                        </a>
                                    </li>
                                </#list>
                            </ul>
                        </div>
                    </#if>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>
