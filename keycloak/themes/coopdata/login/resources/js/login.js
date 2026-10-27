/**
 * CoopData Keycloak Login Theme - JavaScript
 * Defensive implementation — all DOM operations are null-checked.
 */
(function () {
    'use strict';

    function init() {
        initPasswordToggle();
        initAutoFocus();
        initPasswordChecklist();
    }

    /**
     * Live password checklist on the update-password page.
     * Ticks each rule as the user types and, if they submit with rules still
     * missing, blocks the submit and marks those rules red. Mirrors the realm
     * policy (keycloak/provision.sh); Keycloak still validates server-side.
     */
    function initPasswordChecklist() {
        var policy = document.getElementById('password-policy');
        var form = document.getElementById('kc-passwd-update-form');
        var newPassword = document.getElementById('password-new');
        var confirmPassword = document.getElementById('password-confirm');
        if (!policy || !form || !newPassword || !confirmPassword) return;

        var errorBox = document.getElementById('password-policy-error');
        var minLength = parseInt(policy.getAttribute('data-min-length'), 10) || 8;
        var username = (policy.getAttribute('data-username') || '').toLowerCase();
        var metLabel = policy.getAttribute('data-met-label') || '';
        var unmetLabel = policy.getAttribute('data-unmet-label') || '';
        var rows = policy.querySelectorAll('[data-rule]');
        var attempted = false;

        // Same character classes Keycloak counts: Unicode upper/lower case,
        // digits, and "special" = anything that is not a letter or a digit.
        var unicode = true;
        try { new RegExp('\\p{Lu}', 'u'); } catch (e) { unicode = false; }
        var re = unicode ? {
            upper: new RegExp('\\p{Lu}', 'u'),
            lower: new RegExp('\\p{Ll}', 'u'),
            digit: new RegExp('\\p{Nd}', 'u'),
            special: new RegExp('[^\\p{L}\\p{N}]', 'u')
        } : {
            upper: /[A-Z]/,
            lower: /[a-z]/,
            digit: /[0-9]/,
            special: /[^A-Za-z0-9]/
        };

        function check(rule, value, confirmValue) {
            switch (rule) {
                case 'length': return value.length >= minLength;
                case 'upper': return re.upper.test(value);
                case 'lower': return re.lower.test(value);
                case 'digit': return re.digit.test(value);
                case 'special': return re.special.test(value);
                case 'notUsername': return value.length > 0 && (!username || value.toLowerCase() !== username);
                case 'match': return value.length > 0 && value === confirmValue;
                default: return true;
            }
        }

        // pending = not judged yet (grey), met = green tick, unmet = red cross.
        // Rules only turn red after a submit attempt, except "match", which turns
        // red as soon as the confirmation stops being a prefix of the password.
        function stateFor(rule, ok, value, confirmValue) {
            if (ok) return 'met';
            if (attempted) return 'unmet';
            if (rule === 'match' && confirmValue.length > 0 && value.indexOf(confirmValue) !== 0) return 'unmet';
            return 'pending';
        }

        function update() {
            var value = newPassword.value;
            var confirmValue = confirmPassword.value;
            var allMet = true;
            for (var i = 0; i < rows.length; i++) {
                var rule = rows[i].getAttribute('data-rule');
                var ok = check(rule, value, confirmValue);
                if (!ok) allMet = false;
                var state = stateFor(rule, ok, value, confirmValue);
                rows[i].setAttribute('data-state', state);
                var status = rows[i].querySelector('.password-rule-status');
                if (status) status.textContent = state === 'met' ? metLabel : (state === 'unmet' ? unmetLabel : '');
            }
            if (errorBox && allMet) errorBox.hidden = true;
            return allMet;
        }

        newPassword.addEventListener('input', update);
        confirmPassword.addEventListener('input', update);

        form.addEventListener('submit', function (event) {
            attempted = true;
            if (update()) return;
            event.preventDefault();
            if (errorBox) errorBox.hidden = false;
            try { newPassword.focus(); } catch (e) {}
        });

        update();
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
