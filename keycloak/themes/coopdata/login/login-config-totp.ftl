<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp','userLabel'); section>
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
                    <h2>Add an extra layer of security.</h2>
                    <p>Two-factor authentication protects your account even if your password is compromised. Scan the QR code with your authenticator app to get started.</p>
                    <ul class="brand-features">
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Protects against password theft
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Required for destructive actions
                        </li>
                        <li>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Works with Google Authenticator, FreeOTP
                        </li>
                    </ul>
                </div>

                <p class="brand-footer">&copy; ${.now?string('yyyy')} Ministry of Commerce &amp; Cooperative Development</p>
            </aside>

            <#-- Right Form Panel -->
            <main class="form-panel">
                <div class="top-bar">
                    <a href="${url.loginAction!'/'}" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        Back
                    </a>
                </div>

                <div class="form-container">
                    <div class="form-header">
                        <div class="form-logo">
                            <img src="${url.resourcesPath}/img/coopdatalogo.png" alt="CoopData Logo" />
                        </div>
                        <h1>Set Up Two-Factor Authentication</h1>
                        <p>Scan the QR code with your authenticator app, then enter the 6-digit code to verify.</p>
                    </div>

                    <form id="kc-totp-settings-form" class="login-form" action="${url.loginAction}" method="post">
                        <input type="hidden" name="totpSecret" value="${totp.totpSecret}" />
                        <#if mode??><input type="hidden" name="mode" value="${mode}" /></#if>

                        <#-- Display error/global messages if any -->
                        <#if message?has_content && message.type = "error">
                            <div class="alert-error" aria-live="polite">
                                ${kcSanitize(message.summary)?no_esc}
                            </div>
                        </#if>

                        <#-- QR Code / Manual Entry Section -->
                        <div class="totp-setup-section">
                            <#if mode?? && mode = "manual">
                                <#-- Manual entry mode -->
                                <div class="totp-manual-container">
                                    <div class="totp-manual-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                    </div>
                                    <h3>Enter this key manually</h3>
                                    <div class="totp-secret-display">
                                        <code>${totp.totpSecretEncoded}</code>
                                    </div>
                                    <a href="${totp.qrUrl}" class="totp-mode-switch">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <rect x="7" y="7" width="3" height="3"/>
                                            <rect x="14" y="7" width="3" height="3"/>
                                            <rect x="7" y="14" width="3" height="3"/>
                                            <rect x="14" y="14" width="3" height="3"/>
                                        </svg>
                                        Show QR code instead
                                    </a>
                                </div>
                            <#else>
                                <#-- QR code mode -->
                                <div class="totp-qr-container">
                                    <div class="totp-qr-wrapper">
                                        <img id="kc-totp-secret-qr-code"
                                             src="data:image/png;base64, ${totp.totpSecretQrCode}"
                                             alt="${msg("loginTotpScanBarcode")}" />
                                    </div>
                                    <a href="${totp.manualUrl}" class="totp-mode-switch">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        Can't scan? Enter key manually
                                    </a>
                                </div>
                            </#if>
                        </div>

                        <#-- OTP configuration info -->
                        <div class="totp-config-info">
                            <div class="totp-config-item">
                                <span class="totp-config-label">${msg("loginTotpType")}</span>
                                <span class="totp-config-value">${totp.policy.type}</span>
                            </div>
                            <div class="totp-config-item">
                                <span class="totp-config-label">${msg("loginTotpAlgorithm")}</span>
                                <span class="totp-config-value">${totp.policy.getAlgorithmKey()?cap_first}</span>
                            </div>
                            <div class="totp-config-item">
                                <span class="totp-config-label">${msg("loginTotpDigits")}</span>
                                <span class="totp-config-value">${totp.policy.digits}</span>
                            </div>
                            <div class="totp-config-item">
                                <span class="totp-config-label">${msg("loginTotpInterval")}</span>
                                <span class="totp-config-value">${totp.policy.period}s</span>
                            </div>
                        </div>

                        <#-- Verification code input -->
                        <div class="form-group">
                            <label for="totp">${msg("authenticatorCode")}</label>
                            <input id="totp" name="totp" autocomplete="one-time-code" type="text"
                                   class="form-control otp-input"
                                   autofocus
                                   aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"
                                   dir="ltr"
                                   inputmode="numeric"
                                   pattern="[0-9]*"
                                   maxlength="${totp.policy.digits}"
                                   placeholder="000000" />
                            <#if messagesPerField.existsError('totp')>
                                <span id="input-error-totp-code" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <#-- Device name input -->
                        <div class="form-group">
                            <label for="userLabel">${msg("loginTotpDeviceName")}</label>
                            <input id="userLabel" name="userLabel" type="text"
                                   class="form-control"
                                   maxlength="32"
                                   placeholder="e.g. iPhone 15 or Work Laptop" />
                            <#if messagesPerField.existsError('userLabel')>
                                <span id="input-error-otp-device-name" class="alert-error" aria-live="polite">
                                    ${kcSanitize(messagesPerField.get('userLabel'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <div class="form-actions">
                            <button class="btn-primary" name="submit" id="kc-totp-submit" type="submit"
                                    onsubmit="this.disabled = true;">
                                Verify &amp; Activate
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>

                            <#if isAppInitiatedAction??>
                                <a href="${url.loginAction}" class="btn-secondary" id="kc-cancel-aia">
                                    ${msg("doCancel")}
                                </a>
                            </#if>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    </#if>
</@layout.registrationLayout>