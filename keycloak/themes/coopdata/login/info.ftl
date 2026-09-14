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
                    <a href="${url.loginUrl}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        ${msg("backToSignIn")}
                    </a>
                </div>

                <div class="form-container">
                    <div class="status-container">
                        <#-- Organisation / invitation icon -->
                        <div class="status-icon-wrapper info">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <line x1="19" y1="8" x2="19" y2="14"/>
                                <line x1="22" y1="11" x2="16" y2="11"/>
                            </svg>
                        </div>

                        <h1 class="status-title">
                            <#if messageHeader??>
                                ${kcSanitize(msg("${messageHeader}"))?no_esc}
                            <#else>
                                ${message.summary}
                            </#if>
                        </h1>

                        <p class="status-description">
                            ${message.summary}<#if requiredActions??><#list requiredActions>: <b><#items as reqActionItem>${kcSanitize(msg("requiredAction.${reqActionItem}"))?no_esc}<#sep>, </#items></b></#list></#if>
                        </p>

                        <#if !skipLink??>
                            <#if pageRedirectUri?has_content>
                                <a href="${pageRedirectUri}" class="btn-primary status-action-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                    ${kcSanitize(msg("backToApplication"))?no_esc}
                                </a>
                            <#elseif actionUri?has_content>
                                <a href="${actionUri}" class="btn-primary status-action-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                    ${kcSanitize(msg("proceedWithAction"))?no_esc}
                                </a>
                            <#else>
                                <a href="${appUrl}" class="btn-primary status-action-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                    ${kcSanitize(msg("backToApplication"))?no_esc}
                                </a>
                            </#if>
                        </#if>
                    </div>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>
