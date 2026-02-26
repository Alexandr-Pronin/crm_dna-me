# Cituro-Integration testen

## 0. Webhook anlegen und Secret holen

**Endpoint für Cituro:** Dein Backend muss von außen erreichbar sein. Für [crm.dna-me.net](https://crm.dna-me.net) z.B.:

- `https://crm.dna-me.net/api/webhooks/cituro` (wenn die API unter derselben Domain läuft)

**Variante A – Skript (nutzt .env):**

```bash
# Optional in .env: CITURO_WEBHOOK_ENDPOINT=https://crm.dna-me.net/api/webhooks/cituro
npm run cituro:create-webhook
```

Das Skript gibt das **Secret** (z.B. `whs_...`) aus. Diesen Wert in `.env` als `CITURO_WEBHOOK_SECRET=whs_...` eintragen.

**Variante B – curl (z.B. in Git Bash / WSL / Linux):**

```bash
curl -X POST https://app.cituro.com/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: IHR_API_KEY" \
  -d '{"name":"CRM Integration","endpoint":"https://crm.dna-me.net/api/webhooks/cituro","active":true,"eventTypes":["booking.created"]}'
```

Aus der Response `data.secret` kopieren und in `.env` als `CITURO_WEBHOOK_SECRET` eintragen.

Wenn Cituro **"Access forbidden"** zurückgibt: Webhook ggf. im Cituro-Dashboard anlegen und dort das Secret anzeigen lassen.

---

## 1. Umgebungsvariablen (.env)

```env
CITURO_API_KEY=rk_...
CITURO_BASE_URL=https://app.cituro.com/api
# Optional für createMeetingWithLead:
CITURO_SERVICE_ID=uuid-des-meeting-with-lead-services
# Optional: andere Test-E-Mail (Standard: test-crm-<timestamp>@example.com)
CITURO_TEST_EMAIL=deine-test-email@example.com
```

## 2. API & Sync/Meeting (Skript)

```bash
npm run test:cituro
```

Das Skript prüft nacheinander:

1. **Verbindung** – GET zu Cituro, ob der API-Key funktioniert  
2. **syncCituroClient** – Kunde per E-Mail suchen bzw. anlegen, gibt `customerId` aus  
3. **createMeetingWithLead** – nur wenn `CITURO_SERVICE_ID` gesetzt ist; legt einen Termin für „morgen 10:00“ an  

Bei Fehlern steht die Meldung in der Konsole (z.B. 401 = falscher Key, 429 = Rate-Limit).

## 3. Webhook (booking.created) manuell testen

Der Webhook ist: **POST** `https://<deine-domain>/api/webhooks/cituro`

### Signatur berechnen

Header-Format: `X-CITURO-SIGNATURE: t=<timestamp>,s=<signature>`

- `t` = aktuelle Unix-Zeit in Sekunden  
- Payload-String = `t + "." + JSON.stringify(body)`  
- `s` = HMAC-SHA256(Payload-String, CITURO_WEBHOOK_SECRET) als Hex  

Beispiel (Node einmal in der Konsole):

```bash
node -e "
const crypto = require('crypto');
const secret = process.env.CITURO_WEBHOOK_SECRET || 'dein_webhook_secret';
const t = Math.floor(Date.now()/1000).toString();
const body = { event: 'booking.created', data: { booking: { customerId: 'test-uuid' }, appointment: {} } };
const payload = t + '.' + JSON.stringify(body);
const s = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('Header: X-CITURO-SIGNATURE: t=' + t + ', s=' + s);
console.log('Body:', JSON.stringify(body));
"
```

### Request senden (curl)

```bash
# CITURO_WEBHOOK_SECRET in .env setzen, dann:
export CITURO_WEBHOOK_SECRET="dein_secret"

# Signatur + Body erzeugen (oben im node -e ausgeben lassen), dann:
curl -X POST http://localhost:3000/api/webhooks/cituro \
  -H "Content-Type: application/json" \
  -H "X-CITURO-SIGNATURE: t=<timestamp>,s=<signature>" \
  -d '{"event":"booking.created","data":{"booking":{"customerId":"test-uuid"},"appointment":{}}}'
```

Wenn die Signatur stimmt und das Event `booking.created` ist, siehst du im Server-Log: **"TODO: Create CRM Task from Cituro booking.created"** mit customerId und appointment.

### Typische Antworten

- **200** `{"received":true,"event":"booking.created"}` – Webhook angenommen  
- **401** – Signatur falsch oder Header fehlt  
- **503** – CITURO_WEBHOOK_SECRET nicht gesetzt  

## 4. Status über die API prüfen

Wenn der Server läuft (z.B. `npm run dev`):

```bash
# Mit gültigem JWT oder API-Key:
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/integrations/cituro/status
```

Antwort enthält z.B. `status: "connected"` oder `"not_configured"`.
