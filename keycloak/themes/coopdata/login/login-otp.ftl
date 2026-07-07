<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp'); section>
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
                    <h2>Secure and reliable access.</h2>
                    <p>CoopData provides a unified platform for all cooperative stakeholders to manage data with integrity and transparency.</p>
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
                        <div class="form-logo">
                            <img src="${url.resourcesPath}/img/coopdatalogo.png" alt="CoopData Logo" />
                        </div>
                        <h1>Two-Factor Authentication</h1>
                        <p>Enter the 6-digit code from your authenticator app to continue.</p>
                    </div>

                    <form id="kc-otp-login-form" class="login-form" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                        <#if otpLogin.userOtpCredentials?size gt 1>
                            <div class="form-group">
                                <#list otpLogin.userOtpCredentials as otpCredential>
                                    <div class="otp-credential-option">
                                        <input id="kc-otp-credential-${otpCredential?index}" type="radio" name="selectedCredentialId" value="${otpCredential.id}" <#if otpCredential.id == otpLogin.selectedCredentialId>checked="checked"</#if>>
                                        <label for="kc-otp-credential-${otpCredential?index}">
                                            ${otpCredential.userLabel}
                                        </label>
                                    </div>
                                </#list>
                            </div>
                        </#if>

                        <div class="form-group">
                            <label for="otp">${msg("loginOtpOneTime")}</label>
                            <input id="otp" name="otp" autocomplete="one-time-code" type="text"
                                   class="form-control otp-input"
                                   autofocus
                                   aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"
                                   dir="ltr"
                                   inputmode="numeric"
                                   pattern="[0-9]*"
                                   maxlength="6"
                                   placeholder="000000" />

                            <#if messagesPerField.existsError('totp')>
                                <span id="input-error-otp-code" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="form-actions">
                            <button class="btn-primary" name="login" id="kc-login" type="submit">
                                Verify &amp; Continue
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>