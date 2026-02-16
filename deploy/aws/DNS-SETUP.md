# DNS einrichten — crm.dna-me.net

## Was du brauchst

| Feld | Wert |
|------|------|
| **Typ** | A |
| **Name** | crm |
| **Wert** | 18.194.169.112 |
| **TTL** | 300 (oder Auto) |

---

## Anleitung nach Provider

### Cloudflare
1. Login: https://dash.cloudflare.com
2. Domain **dna-me.net** auswählen
3. **DNS** → **Records** → **Add record**
4. Eintragen:
   - Type: **A**
   - Name: **crm**
   - IPv4 address: **18.194.169.112**
   - Proxy: **DNS only** (grau, nicht orange)
5. **Save**

### IONOS
1. Login: https://www.ionos.de
2. **Domains** → **dna-me.net** → **DNS-Einstellungen**
3. **Neuer Eintrag**
4. Typ: **A**, Name: **crm**, Ziel: **18.194.169.112**
5. Speichern

### Strato
1. Login: https://www.strato.de
2. **Domains** → **dna-me.net** → **Verwaltung**
3. **Subdomain** oder **DNS-Einträge**
4. Neuer A-Record: **crm** → **18.194.169.112**

### AWS Route53
1. **Route53** → **Hosted zones** → **dna-me.net**
2. **Create record**
3. Name: **crm**, Type: **A**, Value: **18.194.169.112**
4. **Create**

### Andere Provider
Überall gleich: A-Record mit Name **crm** und Wert **18.194.169.112**.

---

## Danach

- Warten: 2–10 Minuten (DNS-Propagation)
- Testen: https://crm.dna-me.net
- SSL: Let's Encrypt richtet sich automatisch ein
