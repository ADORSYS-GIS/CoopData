<#import "template.ftl" as layout>
<@layout.emailLayout title="Reset Your Password - CoopData">
    <h2>Reset Your Password</h2>
    
    <p>Hello <#if user.firstName??>${user.firstName}<#else>User</#if>,</p>
    
    <p>We received a request to reset the password associated with your CoopData account. If you made this request, please click the button below to set a new password.</p>
    
    <div class="button-wrapper">
        <a href="${link}" class="button">Reset Password</a>
    </div>
    
    <div class="callout">
        <strong>Security Notice:</strong> This link will expire in ${linkExpiration} minutes.
    </div>
    
    <p>If you did not request a password reset, please ignore this email or contact your administrator if you have concerns.</p>
    
    <p>Best regards,<br/>The CoopData Team</p>
</@layout.emailLayout>
