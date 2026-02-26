// =============================================================================
// Default HTML template for Cituro meeting invitation email
// Placeholder: https://app.cituro.com/booking/dna-me is replaced by the actual booking URL
// =============================================================================

export const CITURO_INVITE_HTML_DEFAULT = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminbuchung - DNA ME</title>
    <style>
        /* Reset styles for email clients */
        body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        
        /* Main styles */
        body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #0a0a0f;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #0a0a0f;
        }
        
        .email-container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background: linear-gradient(180deg, #0a0a0f 0%, #12121a 100%);
        }
        
        /* Header */
        .header {
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            padding: 40px 30px;
            text-align: center;
            border-bottom: 2px solid #2d2d44;
        }
        
        .logo {
            font-size: 32px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 3px;
            text-transform: uppercase;
        }
        
        .logo span {
            color: #00d4aa;
        }
        
        .tagline {
            font-size: 12px;
            color: #888899;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-top: 8px;
        }
        
        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 50px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(0,212,170,0.03) 0%, transparent 70%);
            pointer-events: none;
        }
        
        .hero-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 25px;
            background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 40px rgba(0,212,170,0.3);
        }
        
        .hero-icon svg {
            width: 40px;
            height: 40px;
            fill: #ffffff;
        }
        
        .hero-title {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 15px;
            letter-spacing: 1px;
        }
        
        .hero-title span {
            color: #00d4aa;
        }
        
        .hero-subtitle {
            font-size: 16px;
            color: #a0a0b0;
            margin: 0 0 30px;
            line-height: 1.6;
        }
        
        /* CTA Button */
        .cta-container {
            padding: 10px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%);
            color: #0a0a0f !important;
            text-decoration: none;
            padding: 18px 50px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            box-shadow: 0 8px 30px rgba(0,212,170,0.4);
            transition: all 0.3s ease;
        }
        
        /* Content Section */
        .content {
            background-color: #12121a;
            padding: 40px 30px;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin: 0 0 25px;
            text-align: center;
        }
        
        .info-grid {
            display: table;
            width: 100%;
        }
        
        .info-item {
            display: table-cell;
            width: 33.33%;
            padding: 15px;
            text-align: center;
            vertical-align: top;
        }
        
        .info-icon {
            width: 50px;
            height: 50px;
            margin: 0 auto 12px;
            background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #3d3d5c;
        }
        
        .info-icon svg {
            width: 24px;
            height: 24px;
            fill: #00d4aa;
        }
        
        .info-title {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin: 0 0 8px;
        }
        
        .info-text {
            font-size: 12px;
            color: #888899;
            margin: 0;
            line-height: 1.5;
        }
        
        /* Features Section */
        .features {
            background: linear-gradient(180deg, #0f0f17 0%, #12121a 100%);
            padding: 40px 30px;
            border-top: 1px solid #2d2d44;
        }
        
        .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .feature-item {
            padding: 15px 0;
            border-bottom: 1px solid #2d2d44;
            display: flex;
            align-items: flex-start;
        }
        
        .feature-item:last-child {
            border-bottom: none;
        }
        
        .feature-check {
            width: 24px;
            height: 24px;
            min-width: 24px;
            background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            margin-top: 2px;
        }
        
        .feature-check svg {
            width: 12px;
            height: 12px;
            fill: #0a0a0f;
        }
        
        .feature-text {
            font-size: 14px;
            color: #c0c0d0;
            margin: 0;
            line-height: 1.6;
        }
        
        /* Contact Section */
        .contact {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 40px 30px;
            text-align: center;
        }
        
        .contact-title {
            font-size: 16px;
            font-weight: 600;
            color: #ffffff;
            margin: 0 0 20px;
        }
        
        .contact-text {
            font-size: 14px;
            color: #a0a0b0;
            margin: 0 0 25px;
            line-height: 1.6;
        }
        
        .contact-link {
            color: #00d4aa;
            text-decoration: none;
            font-weight: 600;
        }
        
        /* Footer */
        .footer {
            background-color: #0a0a0f;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #2d2d44;
        }
        
        .footer-logo {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 2px;
            margin-bottom: 15px;
        }
        
        .footer-logo span {
            color: #00d4aa;
        }
        
        .footer-address {
            font-size: 12px;
            color: #666677;
            margin: 0 0 15px;
            line-height: 1.6;
        }
        
        .footer-links {
            margin-bottom: 15px;
        }
        
        .footer-link {
            color: #888899;
            text-decoration: none;
            font-size: 12px;
            margin: 0 10px;
        }
        
        .footer-copyright {
            font-size: 11px;
            color: #555566;
            margin: 0;
        }
        
        /* Mobile Responsive */
        @media screen and (max-width: 600px) {
            .header, .hero, .content, .features, .contact, .footer {
                padding-left: 20px !important;
                padding-right: 20px !important;
            }
            
            .hero-title {
                font-size: 24px !important;
            }
            
            .info-item {
                display: block !important;
                width: 100% !important;
                margin-bottom: 20px;
            }
            
            .cta-button {
                padding: 16px 40px !important;
                font-size: 14px !important;
            }
        }
    </style>
<base target="_blank">
</head>
<body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
            <td align="center" style="background-color: #0a0a0f; padding: 20px 0;">
                
                <!-- Email Container -->
                <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%;">
                    
                    <!-- Header -->
                    <tr>
                        <td class="header" style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 40px 30px; text-align: center; border-bottom: 2px solid #2d2d44;">
                            <div class="logo" style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 3px; text-transform: uppercase;">
                                DNA<span style="color: #00d4aa;">-</span>ME
                            </div>
                            <div class="tagline" style="font-size: 12px; color: #888899; letter-spacing: 4px; text-transform: uppercase; margin-top: 8px;">
                                DNA Sequenzierung • Hamburg
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Hero Section -->
                    <tr>
                        <td class="hero" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 50px 30px; text-align: center;">
                            <!-- Calendar Icon -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="width: 80px; height: 80px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 10px 40px rgba(0,212,170,0.3);">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="#ffffff" style="display: block; margin: 0 auto;">
                                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
                                        </svg>
                                    </td>
                                </tr>
                            </table>
                            
                            <h1 class="hero-title" style="font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 15px; letter-spacing: 1px;">
                                BUCHEN SIE IHREN <span style="color: #00d4aa;">TERMIN</span>
                            </h1>
                            <p class="hero-subtitle" style="font-size: 16px; color: #a0a0b0; margin: 0 0 30px; line-height: 1.6;">
                                Vereinbaren Sie einen Termin für Ihre DNA-Analyse. Unser Team in Hamburg steht Ihnen zur Verfügung.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="https://app.cituro.com/booking/dna-me" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); color: #0a0a0f; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 8px 30px rgba(0,212,170,0.4);">
                                            JETZT TERMIN BUCHEN
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Info Grid -->
                    <tr>
                        <td class="content" style="background-color: #12121a; padding: 40px 30px;">
                            <h2 class="section-title" style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 25px; text-align: center;">
                                Warum DNA-ME wählen?
                            </h2>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <!-- Item 1 -->
                                    <td class="info-item" style="width: 33.33%; padding: 15px; text-align: center; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="width: 50px; height: 50px; background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%); border-radius: 12px; text-align: center; vertical-align: middle; border: 1px solid #3d3d5c;">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#00d4aa" style="display: block; margin: 0 auto;">
                                                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                                                    </svg>
                                                </td>
                                            </tr>
                                        </table>
                                        <p class="info-title" style="font-size: 14px; font-weight: 600; color: #ffffff; margin: 12px 0 8px;">48h Turnaround</p>
                                        <p class="info-text" style="font-size: 12px; color: #888899; margin: 0; line-height: 1.5;">Ergebnisse in 48-72 Stunden</p>
                                    </td>
                                    
                                    <!-- Item 2 -->
                                    <td class="info-item" style="width: 33.33%; padding: 15px; text-align: center; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="width: 50px; height: 50px; background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%); border-radius: 12px; text-align: center; vertical-align: middle; border: 1px solid #3d3d5c;">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#00d4aa" style="display: block; margin: 0 auto;">
                                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                                    </svg>
                                                </td>
                                            </tr>
                                        </table>
                                        <p class="info-title" style="font-size: 14px; font-weight: 600; color: #ffffff; margin: 12px 0 8px;">48 Samples/Run</p>
                                        <p class="info-text" style="font-size: 12px; color: #888899; margin: 0; line-height: 1.5;">Bis zu 48 Proben pro Durchlauf</p>
                                    </td>
                                    
                                    <!-- Item 3 -->
                                    <td class="info-item" style="width: 33.33%; padding: 15px; text-align: center; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="width: 50px; height: 50px; background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%); border-radius: 12px; text-align: center; vertical-align: middle; border: 1px solid #3d3d5c;">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#00d4aa" style="display: block; margin: 0 auto;">
                                                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                                                    </svg>
                                                </td>
                                            </tr>
                                        </table>
                                        <p class="info-title" style="font-size: 14px; font-weight: 600; color: #ffffff; margin: 12px 0 8px;">Patent angemeldet</p>
                                        <p class="info-text" style="font-size: 12px; color: #888899; margin: 0; line-height: 1.5;">Innovative Technologie</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Features Section -->
                    <tr>
                        <td class="features" style="background: linear-gradient(180deg, #0f0f17 0%, #12121a 100%); padding: 40px 30px; border-top: 1px solid #2d2d44;">
                            <h2 class="section-title" style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 25px; text-align: center;">
                                Unsere Services
                            </h2>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 15px 0; border-bottom: 1px solid #2d2d44;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="width: 24px; vertical-align: top;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="width: 24px; height: 24px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; text-align: center; vertical-align: middle;">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a0a0f" style="display: block; margin: 0 auto;">
                                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                                                </svg>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td style="padding-left: 15px; vertical-align: top;">
                                                    <p style="font-size: 14px; color: #c0c0d0; margin: 0; line-height: 1.6;">
                                                        <strong style="color: #ffffff;">Research Lab Sample Processing</strong> – Vom Sample zum Ergebnis in 48-72 Stunden
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0; border-bottom: 1px solid #2d2d44;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="width: 24px; vertical-align: top;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="width: 24px; height: 24px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; text-align: center; vertical-align: middle;">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a0a0f" style="display: block; margin: 0 auto;">
                                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                                                </svg>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td style="padding-left: 15px; vertical-align: top;">
                                                    <p style="font-size: 14px; color: #c0c0d0; margin: 0; line-height: 1.6;">
                                                        <strong style="color: #ffffff;">B2B Lab Enablement</strong> – Integrieren Sie unsere Technologie in Ihr Labor
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="width: 24px; vertical-align: top;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                        <tr>
                                                            <td style="width: 24px; height: 24px; background: linear-gradient(135deg, #00d4aa 0%, #00a884 100%); border-radius: 50%; text-align: center; vertical-align: middle;">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a0a0f" style="display: block; margin: 0 auto;">
                                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                                                </svg>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td style="padding-left: 15px; vertical-align: top;">
                                                    <p style="font-size: 14px; color: #c0c0d0; margin: 0; line-height: 1.6;">
                                                        <strong style="color: #ffffff;">Panel Co-Creation</strong> – Maßgeschneiderte digitale Panels für Ihre Forschung
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Contact Section -->
                    <tr>
                        <td class="contact" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 30px; text-align: center;">
                            <h3 class="contact-title" style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 20px;">
                                Fragen?
                            </h3>
                            <p class="contact-text" style="font-size: 14px; color: #a0a0b0; margin: 0 0 25px; line-height: 1.6;">
                                Kontaktieren Sie uns jederzeit unter<br>
                                <a href="mailto:info@dna-me.net" class="contact-link" style="color: #00d4aa; text-decoration: none; font-weight: 600;">info@dna-me.net</a>
                            </p>
                            
                            <!-- Secondary CTA -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="https://www.dna-me.net/index.html?lang=de" style="display: inline-block; background: transparent; color: #00d4aa; text-decoration: none; padding: 14px 35px; border-radius: 50px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; border: 2px solid #00d4aa;">
                                            Zur Website
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td class="footer" style="background-color: #0a0a0f; padding: 30px; text-align: center; border-top: 1px solid #2d2d44;">
                            <div class="footer-logo" style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 2px; margin-bottom: 15px;">
                                DNA<span style="color: #00d4aa;">-</span>ME
                            </div>
                            <p class="footer-address" style="font-size: 12px; color: #666677; margin: 0 0 15px; line-height: 1.6;">
                                DNA Sequenzierung • Hamburg<br>
                                Deutschland
                            </p>
                            <p class="footer-copyright" style="font-size: 11px; color: #555566; margin: 0;">
                                © 2025 DNA-ME. Alle Rechte vorbehalten.
                            </p>
                        </td>
                    </tr>
                    
                </table>
                <!-- End Email Container -->
                
            </td>
        </tr>
    </table>
</body>
</html>`;
