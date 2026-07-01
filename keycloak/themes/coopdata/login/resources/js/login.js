/**
 * CoopData Keycloak Login Theme - JavaScript
 * Defensive implementation — all DOM operations are null-checked.
 */
(function () {
    'use strict';

    function init() {
        initPasswordToggle();
        initAutoFocus();
    }

    function initPasswordToggle() {
        var buttons = document.querySelectorAll('[data-password-toggle]');
        if (!buttons || !buttons.length) return;

        for (var i = 0; i < buttons.length; i++) {
            (function (btn) {
                var group = btn.closest ? btn.closest('.password-input-group') : null;
                if (!group) return;
                var input = group.querySelector('input');
                if (!input) return;
                btn.addEventListener('click', function () {
                    input.type = input.type === 'password' ? 'text' : 'password';
                });
            })(buttons[i]);
        }
    }

    function initAutoFocus() {
        var username = document.getElementById('username');
        if (username && !username.value) {
            try { username.focus(); } catch (e) {}
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Defer slightly so Keycloak's own scripts finish first
        setTimeout(init, 0);
    }
})();
