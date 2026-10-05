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
                    <h2>${msg("generalBrandTitle")}</h2>
                    <p>${msg("generalBrandBody")}</p>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} ${msg("ministryName")}</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <a href="${appUrl}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        ${msg("backToApplication")}
                    </a>
                </div>

                <div class="form-container">
                    <div class="status-container">
                        <#-- Expired status icon -->
                        <div class="status-icon-wrapper info">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </div>

                        <h1 class="status-title">
                            ${msg("pageExpiredTitle")}
                        </h1>

                        <p class="status-description">
                            ${msg("pageExpiredMsg1")}
                        </p>

                        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 16px;">
                            <#if url.loginRestartFlowUrl??>
                                <a id="stl-start-restart-flow" href="${url.loginRestartFlowUrl}" class="btn-primary status-action-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                    </svg>
                                    ${msg("pageExpiredRestartFlowAction")}
                                </a>
                            </#if>

                            <#if url.loginAction??>
                                <a id="stl-continue-login" href="${url.loginAction}" class="btn-primary status-action-button" style="background-color: #475569; border-color: #475569;">
                                    ${msg("pageExpiredContinueAction")}
                                </a>
                            </#if>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>
