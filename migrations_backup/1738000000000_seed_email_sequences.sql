-- =============================================================================
-- Email Sequences Seed Data
-- =============================================================================

-- Willkommens-Serie
INSERT INTO email_sequences (id, name, description, trigger_event, is_active, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Willkommens-Serie',
  'Automatische Begrüßung für neue Leads',
  'lead_created',
  true,
  NOW() - INTERVAL '42 days',
  NOW() - INTERVAL '42 days'
);

INSERT INTO email_sequence_steps (id, sequence_id, position, delay_days, delay_hours, subject, body_html, created_at, updated_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111101',
    '11111111-1111-1111-1111-111111111111',
    1,
    0,
    0,
    'Willkommen bei DNA ME! 🧬',
    '<p>Hallo {{first_name}},</p>
<p>herzlich willkommen bei DNA ME! Wir freuen uns, Sie als neuen Kontakt begrüßen zu dürfen.</p>
<p>Als führendes Biotech-Unternehmen bieten wir Ihnen innovative Lösungen für Ihre Forschung.</p>
<p>In den nächsten Tagen werden wir Ihnen weitere Informationen zu unseren Services zusenden.</p>
<p>Mit freundlichen Grüßen,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days'
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    '11111111-1111-1111-1111-111111111111',
    2,
    2,
    0,
    'Entdecken Sie unsere Research Lab Services',
    '<p>Hallo {{first_name}},</p>
<p>haben Sie schon von unseren Research Lab Services gehört?</p>
<p>Wir unterstützen Sie bei:</p>
<ul>
<li>Genomanalysen</li>
<li>Proteomik</li>
<li>Custom Assay Development</li>
</ul>
<p>Vereinbaren Sie jetzt ein unverbindliches Beratungsgespräch!</p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days'
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    '11111111-1111-1111-1111-111111111111',
    3,
    5,
    0,
    'Kostenlose Demo buchen',
    '<p>Hallo {{first_name}},</p>
<p>möchten Sie unsere Plattform in Aktion sehen?</p>
<p>Buchen Sie jetzt Ihre kostenlose Demo und erfahren Sie, wie DNA ME Ihre Forschung beschleunigen kann.</p>
<p>👉 <a href="#">Demo buchen</a></p>
<p>Wir freuen uns auf Sie!</p>
<p>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days'
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    '11111111-1111-1111-1111-111111111111',
    4,
    7,
    0,
    'Spezial-Angebot für neue Kunden',
    '<p>Hallo {{first_name}},</p>
<p>als neuer Kontakt möchten wir Ihnen ein exklusives Angebot machen:</p>
<p><strong>15% Rabatt</strong> auf Ihre erste Bestellung!</p>
<p>Nutzen Sie einfach den Code: <code>WELCOME15</code></p>
<p>Dieses Angebot ist 30 Tage gültig.</p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days'
  ),
  (
    '11111111-1111-1111-1111-111111111105',
    '11111111-1111-1111-1111-111111111111',
    5,
    14,
    0,
    'Bleiben Sie in Kontakt',
    '<p>Hallo {{first_name}},</p>
<p>wir hoffen, unsere bisherigen E-Mails waren hilfreich für Sie.</p>
<p>Falls Sie Fragen haben oder mehr über unsere Services erfahren möchten, zögern Sie nicht, uns zu kontaktieren.</p>
<p>Sie können uns auch auf LinkedIn und Twitter folgen, um keine Neuigkeiten zu verpassen.</p>
<p>Herzliche Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '42 days'
  );

-- Demo Follow-Up
INSERT INTO email_sequences (id, name, description, trigger_event, is_active, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Demo Follow-Up',
  'Nachfass-E-Mails nach Demo-Buchung',
  'deal_stage_changed',
  true,
  NOW() - INTERVAL '37 days',
  NOW() - INTERVAL '37 days'
);

INSERT INTO email_sequence_steps (id, sequence_id, position, delay_days, delay_hours, subject, body_html, created_at, updated_at)
VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    '22222222-2222-2222-2222-222222222222',
    1,
    0,
    2,
    'Vielen Dank für Ihr Interesse! 🎯',
    '<p>Hallo {{first_name}},</p>
<p>vielen Dank für Ihr Interesse an DNA ME und die Demo-Buchung!</p>
<p>Unser Team wird sich in Kürze mit Ihnen in Verbindung setzen, um einen passenden Termin zu vereinbaren.</p>
<p>In der Zwischenzeit können Sie sich unsere <a href="#">Fallstudien</a> ansehen, um mehr über erfolgreiche Projekte zu erfahren.</p>
<p>Beste Grüße,<br/>Ihr DNA ME Sales Team</p>',
    NOW() - INTERVAL '37 days',
    NOW() - INTERVAL '37 days'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '22222222-2222-2222-2222-222222222222',
    2,
    2,
    0,
    'Demo-Termin: Vorbereitung',
    '<p>Hallo {{first_name}},</p>
<p>Ihr Demo-Termin steht bevor!</p>
<p>Um die Demo optimal auf Ihre Bedürfnisse abzustimmen, möchten wir Sie bitten, kurz folgende Fragen zu beantworten:</p>
<ol>
<li>Welche Herausforderungen möchten Sie lösen?</li>
<li>Wie groß ist Ihr Team?</li>
<li>Gibt es spezielle Features, die Sie interessieren?</li>
</ol>
<p>Antworten Sie einfach auf diese E-Mail. Wir freuen uns auf unser Gespräch!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '37 days',
    NOW() - INTERVAL '37 days'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    '22222222-2222-2222-2222-222222222222',
    3,
    7,
    0,
    'Nach der Demo: Nächste Schritte',
    '<p>Hallo {{first_name}},</p>
<p>vielen Dank für das informative Gespräch!</p>
<p>Wie besprochen, sende ich Ihnen anbei:</p>
<ul>
<li>Individuelle Preisgestaltung für {{company}}</li>
<li>Implementierungsplan</li>
<li>Technische Dokumentation</li>
</ul>
<p>Haben Sie noch Fragen? Ich stehe Ihnen gerne zur Verfügung.</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '37 days',
    NOW() - INTERVAL '37 days'
  );

-- Reaktivierungs-Kampagne
INSERT INTO email_sequences (id, name, description, trigger_event, is_active, created_at, updated_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Reaktivierungs-Kampagne',
  'Inaktive Leads wieder aktivieren',
  'manual',
  false,
  NOW() - INTERVAL '77 days',
  NOW() - INTERVAL '77 days'
);

INSERT INTO email_sequence_steps (id, sequence_id, position, delay_days, delay_hours, subject, body_html, created_at, updated_at)
VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    '33333333-3333-3333-3333-333333333333',
    1,
    0,
    0,
    'Wir vermissen Sie! 💙',
    '<p>Hallo {{first_name}},</p>
<p>es ist eine Weile her, seit wir von Ihnen gehört haben.</p>
<p>Bei DNA ME gibt es viele Neuigkeiten:</p>
<ul>
<li>Neue Features und Tools</li>
<li>Erweiterte Analysemöglichkeiten</li>
<li>Verbesserte Performance</li>
</ul>
<p>Möchten Sie wieder mit uns in Kontakt treten? Wir würden uns freuen!</p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '77 days',
    NOW() - INTERVAL '77 days'
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '33333333-3333-3333-3333-333333333333',
    2,
    3,
    0,
    'Exklusives Comeback-Angebot 🎁',
    '<p>Hallo {{first_name}},</p>
<p>als geschätzter ehemaliger Kontakt möchten wir Ihnen ein besonderes Angebot machen:</p>
<p><strong>20% Rabatt</strong> auf alle Services für die nächsten 60 Tage!</p>
<p>Code: <code>COMEBACK20</code></p>
<p>Zusätzlich erhalten Sie eine kostenlose Beratungsstunde mit unseren Experten.</p>
<p>Lassen Sie uns wieder zusammenarbeiten!</p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '77 days',
    NOW() - INTERVAL '77 days'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '33333333-3333-3333-3333-333333333333',
    3,
    7,
    0,
    'Fallstudien: Erfolgsgeschichten unserer Kunden',
    '<p>Hallo {{first_name}},</p>
<p>sehen Sie, was andere Unternehmen mit DNA ME erreicht haben:</p>
<p><strong>Case Study 1:</strong> Forschungslabor steigert Durchsatz um 300%</p>
<p><strong>Case Study 2:</strong> Biotech-Startup reduziert Kosten um 40%</p>
<p><strong>Case Study 3:</strong> Pharmaunternehmen verkürzt Time-to-Market um 6 Monate</p>
<p><a href="#">Alle Erfolgsgeschichten lesen</a></p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '77 days',
    NOW() - INTERVAL '77 days'
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    '33333333-3333-3333-3333-333333333333',
    4,
    14,
    0,
    'Letzte Chance: Ihr Comeback-Angebot läuft ab',
    '<p>Hallo {{first_name}},</p>
<p>Ihr exklusives Comeback-Angebot läuft in 7 Tagen ab!</p>
<p>Verpassen Sie nicht die Chance auf <strong>20% Rabatt</strong> und eine kostenlose Beratungsstunde.</p>
<p>Nehmen Sie jetzt Kontakt auf und lassen Sie uns gemeinsam Ihre Ziele erreichen.</p>
<p>Wir freuen uns auf Sie!</p>
<p>Beste Grüße,<br/>Ihr DNA ME Team</p>',
    NOW() - INTERVAL '77 days',
    NOW() - INTERVAL '77 days'
  );

-- Angebots-Erinnerung
INSERT INTO email_sequences (id, name, description, trigger_event, is_active, created_at, updated_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Angebots-Erinnerung',
  'Reminder für ausstehende Angebote',
  'deal_stage_changed',
  true,
  NOW() - INTERVAL '21 days',
  NOW() - INTERVAL '21 days'
);

INSERT INTO email_sequence_steps (id, sequence_id, position, delay_days, delay_hours, subject, body_html, created_at, updated_at)
VALUES
  (
    '44444444-4444-4444-4444-444444444401',
    '44444444-4444-4444-4444-444444444444',
    1,
    1,
    0,
    'Ihr Angebot von DNA ME',
    '<p>Hallo {{first_name}},</p>
<p>anbei finden Sie unser Angebot für {{deal_name}}.</p>
<p><strong>Angebotswert:</strong> {{deal_value}} {{deal_currency}}</p>
<p>Das Angebot ist 30 Tage gültig und beinhaltet:</p>
<ul>
<li>Vollständige Implementierung</li>
<li>3 Monate Premium Support</li>
<li>Schulungen für Ihr Team</li>
</ul>
<p>Bei Fragen stehe ich Ihnen gerne zur Verfügung!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '21 days'
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '44444444-4444-4444-4444-444444444444',
    2,
    7,
    0,
    'Follow-Up: Haben Sie Fragen zum Angebot?',
    '<p>Hallo {{first_name}},</p>
<p>ich wollte mich kurz bei Ihnen melden bezüglich unseres Angebots vom letzten Donnerstag.</p>
<p>Haben Sie das Angebot erhalten und durchsehen können?</p>
<p>Gibt es Punkte, die wir gemeinsam besprechen sollten?</p>
<p>Ich freue mich auf Ihr Feedback!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '21 days'
  );

-- Onboarding-Serie
INSERT INTO email_sequences (id, name, description, trigger_event, is_active, created_at, updated_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'Onboarding-Serie',
  'Einführung für neue Kunden',
  'deal_won',
  true,
  NOW() - INTERVAL '16 days',
  NOW() - INTERVAL '16 days'
);

INSERT INTO email_sequence_steps (id, sequence_id, position, delay_days, delay_hours, subject, body_html, created_at, updated_at)
VALUES
  (
    '55555555-5555-5555-5555-555555555501',
    '55555555-5555-5555-5555-555555555555',
    1,
    0,
    0,
    'Willkommen im DNA ME Team! 🎉',
    '<p>Hallo {{first_name}},</p>
<p>herzlich willkommen bei DNA ME!</p>
<p>Wir freuen uns sehr, Sie als neuen Kunden zu begrüßen.</p>
<p>In den nächsten Wochen werden wir Sie Schritt für Schritt durch das Onboarding begleiten.</p>
<p><strong>Nächste Schritte:</strong></p>
<ol>
<li>Zugang zu Ihrer Plattform einrichten</li>
<li>Kick-off Meeting vereinbaren</li>
<li>Team-Schulungen planen</li>
</ol>
<p>Beste Grüße,<br/>Ihr DNA ME Success Team</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  ),
  (
    '55555555-5555-5555-5555-555555555502',
    '55555555-5555-5555-5555-555555555555',
    2,
    1,
    0,
    'Ihre Zugangsdaten & erste Schritte',
    '<p>Hallo {{first_name}},</p>
<p>Ihre Plattform ist jetzt bereit!</p>
<p><strong>Login-URL:</strong> https://{{company}}.dna-me.app</p>
<p><strong>Erste Schritte:</strong></p>
<ul>
<li>Passwort ändern</li>
<li>Team-Mitglieder einladen</li>
<li>Erstes Projekt anlegen</li>
</ul>
<p>📚 <a href="#">Zur Dokumentation</a></p>
<p>Bei Fragen bin ich für Sie da!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  ),
  (
    '55555555-5555-5555-5555-555555555503',
    '55555555-5555-5555-5555-555555555555',
    3,
    3,
    0,
    'Kick-off Meeting: Agenda & Vorbereitung',
    '<p>Hallo {{first_name}},</p>
<p>unser Kick-off Meeting findet nächste Woche statt!</p>
<p><strong>Agenda:</strong></p>
<ol>
<li>Plattform-Tour (30 min)</li>
<li>Use Cases & Workflows (45 min)</li>
<li>Best Practices (30 min)</li>
<li>Q&A (15 min)</li>
</ol>
<p>Bitte bereiten Sie folgende Punkte vor:</p>
<ul>
<li>Ihre wichtigsten Use Cases</li>
<li>Bestehende Workflows</li>
<li>Spezielle Anforderungen</li>
</ul>
<p>Bis bald!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  ),
  (
    '55555555-5555-5555-5555-555555555504',
    '55555555-5555-5555-5555-555555555555',
    4,
    7,
    0,
    'Woche 1: Wie läufts?',
    '<p>Hallo {{first_name}},</p>
<p>Sie nutzen DNA ME jetzt seit einer Woche - wie sind Ihre ersten Eindrücke?</p>
<p>Haben Sie alle Features gefunden, die Sie brauchen?</p>
<p>Gibt es Fragen oder Herausforderungen?</p>
<p><strong>Hilfreiche Ressourcen:</strong></p>
<ul>
<li><a href="#">Video-Tutorials</a></li>
<li><a href="#">FAQ</a></li>
<li><a href="#">Community Forum</a></li>
</ul>
<p>Ich bin hier, um zu helfen!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  ),
  (
    '55555555-5555-5555-5555-555555555505',
    '55555555-5555-5555-5555-555555555555',
    5,
    14,
    0,
    'Advanced Features & Tipps',
    '<p>Hallo {{first_name}},</p>
<p>jetzt wo Sie mit den Basics vertraut sind, möchte ich Ihnen einige Advanced Features zeigen:</p>
<p><strong>1. Automation Workflows</strong><br/>
Sparen Sie Zeit durch automatisierte Prozesse</p>
<p><strong>2. Custom Integrations</strong><br/>
Verbinden Sie Ihre anderen Tools</p>
<p><strong>3. Advanced Analytics</strong><br/>
Detaillierte Insights für bessere Entscheidungen</p>
<p>Möchten Sie eine persönliche Einführung? Vereinbaren Sie einen Termin!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  ),
  (
    '55555555-5555-5555-5555-555555555506',
    '55555555-5555-5555-5555-555555555555',
    6,
    30,
    0,
    'Monat 1: Check-in & Feedback',
    '<p>Hallo {{first_name}},</p>
<p>ein Monat mit DNA ME liegt hinter Ihnen - Zeit für ein erstes Feedback!</p>
<p>Wir würden gerne von Ihnen wissen:</p>
<ul>
<li>Was läuft gut?</li>
<li>Wo gibt es Verbesserungspotenzial?</li>
<li>Welche Features fehlen Ihnen?</li>
</ul>
<p>Ihr Feedback hilft uns, DNA ME noch besser zu machen.</p>
<p>📊 <a href="#">Kurze Umfrage (2 Min)</a></p>
<p>Vielen Dank für Ihre Unterstützung!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  ),
  (
    '55555555-5555-5555-5555-555555555507',
    '55555555-5555-5555-5555-555555555555',
    7,
    60,
    0,
    'Success Story: Teilen Sie Ihre Erfahrungen',
    '<p>Hallo {{first_name}},</p>
<p>Sie nutzen DNA ME jetzt seit 2 Monaten!</p>
<p>Wir würden uns freuen, Ihre Erfolgsgeschichte zu hören:</p>
<ul>
<li>Welche Ziele haben Sie erreicht?</li>
<li>Wie hat DNA ME Ihre Arbeit verändert?</li>
<li>Was waren die größten Verbesserungen?</li>
</ul>
<p>Vielleicht möchten Sie Ihre Erfahrungen als Referenzkunde teilen?</p>
<p>Das würde anderen Unternehmen bei ihrer Entscheidung helfen.</p>
<p>Lassen Sie uns darüber sprechen!</p>
<p>Beste Grüße,<br/>{{assigned_to}}</p>',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '16 days'
  );

-- =============================================================================
-- Success Message
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Email sequence seed data inserted successfully';
  RAISE NOTICE '📊 5 sequences with 22 total steps created';
END $$;
