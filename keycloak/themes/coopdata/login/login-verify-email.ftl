<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true displayMessage=false; section>
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
                    <div class="status-container">
                        <#-- Email icon -->
                        <div class="status-icon-wrapper info">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                        </div>

                        <h1 class="status-title">${msg("emailVerifyTitle")}</h1>

                        <p class="status-description">
                            <#if verifyEmail??>
                                ${msg("emailVerifyInstruction1", verifyEmail)}
                            <#else>
                                ${msg("emailVerifyInstruction4", user.email)}
                            </#if>
                        </p>

                        <#if isAppInitiatedAction??>
                            <form id="kc-verify-email-form" action="${url.loginAction}" method="post">
                                <#if verifyEmail??>
                                    <button class="btn-primary status-action-button" type="submit">
                                        ${msg("emailVerifyResend")}
                                    </button>
                                <#else>
                                    <button class="btn-primary status-action-button" type="submit">
                                        ${msg("emailVerifySend")}
                                    </button>
                                </#if>
                            </form>
                        </#if>
                    </div>
                </div>
            </main>
        </div>
    <#elseif section = "info">
        <#-- Info section not rendered in custom layout -->
    </#if>
</@layout.registrationLayout>
