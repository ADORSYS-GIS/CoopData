<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false; section>
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
                        <h1>${msg("loginChooseAuthenticator")}</h1>
                        <p>Select an alternative method to verify your identity and continue.</p>
                    </div>

                    <form id="kc-select-credential-form" class="login-form" action="${url.loginAction}" method="post">
                        <div class="authenticator-list">
                            <#list auth.authenticationSelections as authenticationSelection>
                                <button class="authenticator-item" type="submit" name="authenticationExecution" value="${authenticationSelection.authExecId}">
                                    <span class="authenticator-item-icon">
                                        <i class="${authenticationSelection.iconCssClass}"></i>
                                    </span>
                                    <span class="authenticator-item-body">
                                        <span class="authenticator-item-heading">${msg('${authenticationSelection.displayName}')}</span>
                                        <span class="authenticator-item-description">${msg('${authenticationSelection.helpText}')}</span>
                                    </span>
                                    <span class="authenticator-item-arrow">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M9 18l6-6-6-6"/>
                                        </svg>
                                    </span>
                                </button>
                            </#list>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>
