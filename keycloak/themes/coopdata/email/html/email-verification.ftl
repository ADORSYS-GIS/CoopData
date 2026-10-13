<#import "template.ftl" as layout>
<@layout.emailLayout title="Verify Your Email Address - CoopData">
    <h2>Verify Your Email Address</h2>
    
    <p>Hello <#if user.firstName??>${user.firstName}<#else>User</#if>,</p>
    
    <p>Welcome to CoopData! To complete your registration and secure your account, we just need to verify your email address.</p>
    
    <div class="button-wrapper">
        <a href="${link}" class="button">Verify Email Address</a>
    </div>
    
    <div class="callout">
        <strong>Security Notice:</strong> This verification link will expire in ${linkExpiration} minutes.
    </div>
    
    <p>If you did not create an account using this email address, you can safely ignore this message.</p>
    
    <p>Best regards,<br/>The CoopData Team</p>
</@layout.emailLayout>
