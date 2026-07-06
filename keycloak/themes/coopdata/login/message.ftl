<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false displayInfo=false; section>
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

                <p class="brand-footer">&copy; ${.now?string('yyyy')} Ministry of Commerce & Cooperative Development</p>
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
                        <#-- Icon Selection based on message type -->
                        <div class="status-icon-wrapper <#if message?has_content && message.type?contains('error')>error<#elseif message?has_content && message.type?contains('success')>success<#else>info</#if>">
                            <#if message?has_content && message.type?contains('error')>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <#elseif message?has_content && message.type?contains('success')>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <#else>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </#if>
                        </div>

                        <h1 class="status-title">${message.summary!msg("error")}</h1>
                        <p class="status-description">${message.formatted?no_esc!"Please try again or contact support if the issue persists."}</p>

                        <#if url.loginUrl??>
                            <a href="${url.loginUrl}" class="btn-primary status-action-button">
                                Back to Login
                            </a>
                        </#if>
                    </div>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>
