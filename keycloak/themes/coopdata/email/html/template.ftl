<#macro emailLayout title>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <!-- Fallback fonts for email -->
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            -webkit-font-smoothing: antialiased;
            color: #334155;
        }
        .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f8fafc;
            padding-bottom: 60px;
        }
        .main {
            background-color: #ffffff;
            margin: 0 auto;
            width: 100%;
            max-width: 600px;
            border-spacing: 0;
            color: #334155;
            border-radius: 10px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            margin-top: 40px;
        }
        .header {
            background-color: #ffffff;
            padding: 40px 30px 20px 30px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
        }
        .header img {
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
        }
        .content {
            padding: 40px 30px;
            line-height: 1.6;
        }
        h2 {
            color: #1e293b;
            font-size: 20px;
            margin-top: 0;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            margin-top: 0;
            margin-bottom: 20px;
            color: #475569;
        }
        .callout {
            background-color: #f8fafc;
            border-left: 4px solid #e11d48;
            padding: 12px 16px;
            margin-bottom: 20px;
            font-size: 14px;
            font-weight: 500;
            color: #334155;
        }
        .button-wrapper {
            text-align: center;
            margin-top: 30px;
            margin-bottom: 30px;
        }
        .button {
            background-color: #1e293b; /* Navy Blue instead of bright Indigo */
            color: #ffffff;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            display: inline-block;
            font-size: 16px;
        }
        .footer {
            text-align: center;
            padding: 20px 30px;
            font-size: 13px;
            color: #94a3b8;
            background-color: #f8fafc;
        }
        .footer p {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <table class="main">
            <tr>
                <td style="background-color: #e11d48; height: 6px; line-height: 6px; font-size: 6px;">&nbsp;</td>
            </tr>
            <tr>
                <td class="header">
                    <img src="${url.resourcesUrl}/img/coopdatalogo.png" alt="CoopData Logo" />
                </td>
            </tr>
            <tr>
                <td class="content">
                    <#nested>
                </td>
            </tr>
            <tr>
                <td class="footer">
                    <p>This is an automated message from the CoopData platform. Please do not reply directly to this email.</p>
                    <p>&copy; ${.now?string('yyyy')} CoopData. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
</#macro>
