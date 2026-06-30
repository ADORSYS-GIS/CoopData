/**
 * CoopData Login Theme - JavaScript
 * Handles password visibility toggle and accessibility enhancements.
 */

(function () {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        initPasswordToggle();
        initFormValidation();
        initAutoFocus();
    }

    /**
     * Password visibility toggle
     */
    function initPasswordToggle() {
        const toggleButtons = document.querySelectorAll('[data-password-toggle]');

        toggleButtons.forEach(function (button) {
            const passwordInput = document.getElementById('password');
            if (!passwordInput) return;

            button.addEventListener('click', function () {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';

                // Toggle icons
                const icon = button.querySelector('i');
                if (icon) {
                    const showIcon = button.dataset.iconShow;
                    const hideIcon = button.dataset.iconHide;
                    const showLabel = button.datasetLabelShow;
                    const hideLabel = button.datasetLabelHide;

                    if (isPassword) {
                        icon.className = hideIcon;
                        button.setAttribute('aria-label', hideLabel || 'Hide password');
                    } else {
                        icon.className = showIcon;
                        button.setAttribute('aria-label', showLabel || 'Show password');
                    }
                }
            });
        });
    }

    /**
     * Basic form validation feedback
     */
    function initFormValidation() {
        const form = document.getElementById('kc-form-login');
        if (!form) return;

        const inputs = form.querySelectorAll('input[required], input:not([type="hidden"])');

        inputs.forEach(function (input) {
            input.addEventListener('blur', function () {
                if (this.validity && this.validity.valueMissing && this.value === '') {
                    this.setAttribute('aria-invalid', 'true');
                } else {
                    this.removeAttribute('aria-invalid');
                }
            });

            input.addEventListener('input', function () {
                if (this.getAttribute('aria-invalid') === 'true' && this.value) {
                    this.removeAttribute('aria-invalid');
                }
            });
        });
    }

    /**
     * Auto-focus the first empty input field
     */
    function initAutoFocus() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (usernameInput && !usernameInput.value) {
            usernameInput.focus();
        } else if (passwordInput) {
            passwordInput.focus();
        }
    }
})();
