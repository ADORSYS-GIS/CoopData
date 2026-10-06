# Security & Data Protection Statement

**Proposed effective date:** 1 October 2026

## 1. Purpose

This statement summarizes the security controls applied to CoopData. It is intentionally written at a level suitable for users and customers and does not disclose sensitive implementation details that could increase security risk.

## 2. Access control

- Role-based access and least-privilege principles.
- Unique user accounts and controlled administrative privileges.
- Authentication controls and, where available, multi-factor authentication for privileged or sensitive access.
- Periodic review of access rights and removal of access when no longer required.

## 3. Encryption

- TLS or equivalent secure transport is used for supported communications in transit.
- Data at rest should be encrypted using industry-accepted controls, with AES-256 or equivalent where technically applicable.
- Secrets, passwords and cryptographic keys are stored and managed using appropriate secure mechanisms rather than plain text.

## 4. Logging and monitoring

Security-relevant events such as authentication, authorization changes, administrative actions and system errors may be logged for security, troubleshooting and audit purposes. Logs are access-controlled and retained according to the Retention & Erasure Schedule.

## 5. Backup and recovery

- Regular backups are maintained according to the approved recovery plan.
- Backups are access-controlled and protected against unauthorized modification.
- Recovery procedures should be tested periodically.
- Backup retention follows the approved retention schedule.

## 6. Vulnerability and change management

The Engineering Team should apply controlled deployment, dependency management, vulnerability remediation, code review and testing proportionate to the risk of the Platform. Security-sensitive changes should be documented and reviewed before production release.

## 7. Incident response

CoopData maintains an incident-response process for suspected unauthorized access, loss, disclosure, corruption or unavailability of data. Incidents are assessed, contained, investigated, remediated and documented. Where required by law or contract, affected Customers, regulators or individuals will be notified within the applicable timeframe.

## 8. Third-party providers

Cloud hosting, authentication, communications, analytics and other providers may process information on behalf of CoopData. Relevant providers should be assessed for security, confidentiality, access controls and data-processing obligations, and maintained in an internal subprocessor/vendor register.

## 9. Security limitations

No service connected to the internet can guarantee absolute security. Users must protect credentials, use supported devices and promptly report suspected compromise.

## 10. Contact

- **Security/privacy contact:** eswatini@dgrv.coop
- **Organization:** DGRV German Cooperative and Raiffeisen Confederation
