<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<@layout.registrationLayout displayMessage=true; section>
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
                    <ul class="brand-features">
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            ${msg("recoveryCodesFeatureSingleUse")}
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            ${msg("recoveryCodesFeatureBackup")}
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            ${msg("recoveryCodesFeaturePrivate")}
                        </li>
                    </ul>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} ${msg("ministryName")}</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <a href="${url.loginAction!'/'}" class="back-link">
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
                        <h1>${msg("recovery-code-config-header")}</h1>
                        <p>${msg("recoveryCodesSubtitle")}</p>
                    </div>

                    <#-- Warning alert -->
                    <div class="recovery-warning" role="alert">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <div>
                            <strong>${msg("recovery-code-config-warning-title")}</strong>
                            <p>${msg("recovery-code-config-warning-message")}</p>
                        </div>
                    </div>

                    <#-- Recovery codes list -->
                    <div class="recovery-codes-card">
                        <ol id="kc-recovery-codes-list" class="recovery-codes-list">
                            <#list recoveryAuthnCodesConfigBean.generatedRecoveryAuthnCodesList as code>
                                <li><span>${code?counter}</span><code>${code[0..3]}-${code[4..7]}-${code[8..]}</code></li>
                            </#list>
                        </ol>

                        <#-- Actions: print / download / copy -->
                        <div class="recovery-actions">
                            <button id="printRecoveryCodes" class="recovery-action-btn" type="button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 6 2 18 2 18 9"/>
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                    <rect x="6" y="14" width="12" height="8"/>
                                </svg>
                                ${msg("recovery-codes-print")}
                            </button>
                            <button id="downloadRecoveryCodes" class="recovery-action-btn" type="button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                ${msg("recovery-codes-download")}
                            </button>
                            <button id="copyRecoveryCodes" class="recovery-action-btn" type="button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                                ${msg("recovery-codes-copy")}
                            </button>
                        </div>
                    </div>

                    <#-- Confirmation checkbox -->
                    <div class="recovery-confirmation">
                        <input type="checkbox" id="kcRecoveryCodesConfirmationCheck" name="kcRecoveryCodesConfirmationCheck"
                               onchange="document.getElementById('saveRecoveryAuthnCodesBtn').disabled = !this.checked;" />
                        <label for="kcRecoveryCodesConfirmationCheck">${msg("recovery-codes-confirmation-message")}</label>
                    </div>

                    <#-- Save form -->
                    <form action="${url.loginAction}" class="login-form" id="kc-recovery-codes-settings-form" method="post">
                        <input type="hidden" name="generatedRecoveryAuthnCodes" value="${recoveryAuthnCodesConfigBean.generatedRecoveryAuthnCodesAsString}" />
                        <input type="hidden" name="generatedAt" value="${recoveryAuthnCodesConfigBean.generatedAt?c}" />
                        <input type="hidden" id="userLabel" name="userLabel" value="${msg("recovery-codes-label-default")}" />
                        <@passwordCommons.logoutOtherSessions/>

                        <div class="form-actions">
                            <button class="btn-primary" type="submit" id="saveRecoveryAuthnCodesBtn" disabled>
                                ${msg("recovery-codes-action-complete")}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
                            <#if isAppInitiatedAction??>
                                <button class="btn-secondary" type="submit" id="cancelRecoveryAuthnCodesBtn" name="cancel-aia" value="true">
                                    ${msg("recovery-codes-action-cancel")}
                                </button>
                            </#if>
                        </div>
                    </form>
                </div>
            </main>
        </div>

        <script>
            /* copy recovery codes */
            function copyRecoveryCodes() {
                var tmpTextarea = document.createElement("textarea");
                var codes = document.querySelectorAll("#kc-recovery-codes-list li");
                for (i = 0; i < codes.length; i++) {
                    tmpTextarea.value = tmpTextarea.value + codes[i].innerText + "\n";
                }
                document.body.appendChild(tmpTextarea);
                tmpTextarea.select();
                document.execCommand("copy");
                document.body.removeChild(tmpTextarea);
            }
            var copyButton = document.getElementById("copyRecoveryCodes");
            copyButton && copyButton.addEventListener("click", function () {
                copyRecoveryCodes();
            });
            /* download recovery codes */
            function formatCurrentDateTime() {
                var dt = new Date();
                var options = {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'short'
                };
                return dt.toLocaleString('en-US', options);
            }
            function parseRecoveryCodeList() {
                var recoveryCodes = document.querySelectorAll("#kc-recovery-codes-list li");
                var recoveryCodeList = "";
                for (var i = 0; i < recoveryCodes.length; i++) {
                    var recoveryCodeLiElement = recoveryCodes[i].innerText;
                    recoveryCodeList += recoveryCodeLiElement + "\r\n";
                }
                return recoveryCodeList;
            }
            function buildDownloadContent() {
                var recoveryCodeList = parseRecoveryCodeList();
                var dt = new Date();
                var options = {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'short'
                };
                return fileBodyContent =
                    "${msg("recovery-codes-download-file-header")}\n\n" +
                    recoveryCodeList + "\n" +
                    "${msg("recovery-codes-download-file-description")}\n\n" +
                    "${msg("recovery-codes-download-file-date")} " + formatCurrentDateTime();
            }
            function setUpDownloadLinkAndDownload(filename, text) {
                var el = document.createElement('a');
                el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
                el.setAttribute('download', filename);
                el.style.display = 'none';
                document.body.appendChild(el);
                el.click();
                document.body.removeChild(el);
            }
            function downloadRecoveryCodes() {
                setUpDownloadLinkAndDownload('kc-download-recovery-codes.txt', buildDownloadContent());
            }
            var downloadButton = document.getElementById("downloadRecoveryCodes");
            downloadButton && downloadButton.addEventListener("click", downloadRecoveryCodes);
            /* print recovery codes */
            function buildPrintContent() {
                var recoveryCodeListHTML = document.getElementById('kc-recovery-codes-list').innerHTML;
                var styles =
                    `@page { size: auto; margin-top: 0; }
                    body { width: 480px; }
                    div { list-style-type: none; font-family: monospace }
                    p:first-of-type { margin-top: 48px }`;
                return printFileContent =
                    "<html><style>" + styles + "</style><body>" +
                    "<title>kc-download-recovery-codes</title>" +
                    "<p>${msg("recovery-codes-download-file-header")}</p>" +
                    "<div>" + recoveryCodeListHTML + "</div>" +
                    "<p>${msg("recovery-codes-download-file-description")}</p>" +
                    "<p>${msg("recovery-codes-download-file-date")} " + formatCurrentDateTime() + "</p>" +
                    "</body></html>";
            }
            function printRecoveryCodes() {
                var w = window.open();
                w.document.write(buildPrintContent());
                w.print();
                w.close();
            }
            var printButton = document.getElementById("printRecoveryCodes");
            printButton && printButton.addEventListener("click", printRecoveryCodes);
        </script>
    </#if>
</@layout.registrationLayout>
