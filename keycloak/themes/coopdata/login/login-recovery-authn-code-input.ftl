<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('recoveryCodeInput'); section>
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
                    <h2>${msg("recoveryCodesBrandTitle")}</h2>
                    <p>${msg("recoveryCodesBrandBody")}</p>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} ${msg("ministryName")}</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <a href="${url.loginUrl}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        ${msg("backToHome")}
                    </a>
                </div>

                <div class="form-container">
                    <div class="form-header">
                        <div class="form-logo">
                            <img src="${url.resourcesPath}/img/coopdatalogo.png" alt="CoopData Logo" />
                        </div>
                        <h1>${msg("recoveryCodeInputTitle")}</h1>
                        <p>${msg("recoveryCodeInputSubtitle")}</p>
                    </div>

                    <form id="kc-recovery-code-login-form" class="login-form" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                        <div class="form-group">
                            <label for="recoveryCodeInput">${msg("auth-recovery-code-prompt", recoveryAuthnCodesInputBean.codeNumber?c)}</label>
                            <input tabindex="1" id="recoveryCodeInput"
                                   name="recoveryCodeInput"
                                   aria-invalid="<#if messagesPerField.existsError('recoveryCodeInput')>true</#if>"
                                   autocomplete="one-time-code"
                                   type="text"
                                   class="form-control recovery-code-input"
                                   inputmode="numeric"
                                   autofocus
                                   dir="ltr"
                                   placeholder="XXXX-XXXX-XXXX" />

                            <#if messagesPerField.existsError('recoveryCodeInput')>
                                <span id="input-error" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.get('recoveryCodeInput'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="form-actions">
                            <button class="btn-primary" name="login" id="kc-login" type="submit">
                                ${msg("doLogIn")}
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
