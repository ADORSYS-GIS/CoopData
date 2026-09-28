<#import "template.ftl" as layout>
<@layout.emailLayout title="Action Required on Your Account - CoopData">
    <h2>Action Required</h2>
    
    <p>Hello <#if user.firstName??>${user.firstName}<#else>User</#if>,</p>
    
    <p>Your administrator has requested that you update your account on CoopData. This could involve updating your password, configuring multi-factor authentication, or verifying your profile details.</p>
    
    <p>Please click the button below to complete the required actions:</p>
    
    <div class="button-wrapper">
        <a href="${link}" class="button">Update Account</a>
    </div>
    
    <div class="callout">
        <strong>Security Notice:</strong> This secure link will expire in ${linkExpiration} minutes.
    </div>
    
    <p>If you have any questions about this request, please contact your administrator.</p>
    
    <p>Best regards,<br/>The CoopData Team</p>
</@layout.emailLayout>
