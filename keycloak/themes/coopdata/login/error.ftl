<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=false; section>
    <#if section = "header">
        <#-- Header handled inside form panel -->
    <#elseif section = "form">
        <#setting url_escaping_charset='UTF-8'>
        <#-- Safe fallback for application URL (avoids Keycloak internal account management /realms/.../account/) -->
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

        <#assign logoutRedirect = appUrl>
        <#if !logoutRedirect?ends_with("/")>
            <#assign logoutRedirect = logoutRedirect + "/">
        </#if>

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
                    <a href="${appUrl}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Back to application
                    </a>
                </div>

                <div class="form-container">
                    <div class="status-container">
                        <#-- Error status icon -->
                        <div class="status-icon-wrapper error">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                        </div>

                        <h1 class="status-title">
                            ${kcSanitize(msg("errorTitle"))?no_esc}
                        </h1>

                        <p class="status-description">
                            ${message.summary?no_esc}
                        </p>

                        <#if !skipLink??>
                            <a href="${appUrl}" class="btn-primary status-action-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                                ${kcSanitize(msg("backToApplication"))?no_esc}
                            </a>
                        </#if>
                    </div>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>
