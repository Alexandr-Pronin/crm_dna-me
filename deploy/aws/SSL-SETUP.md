# SSL/HTTPS auf AWS — so bekommst du das Zertifikat

In diesem Projekt gibt es **zwei mögliche Wege** zu HTTPS. Mit der aktuellen Architektur (EC2 ohne ALB) nutzt ihr **Certbot (Let's Encrypt)** — nicht AWS ACM auf dem Server.

---

## Kurz: Was du brauchst für HTTPS (Certbot)

| Schritt | Was |
|--------|-----|
| 1. DNS | **A-Record**: `crm.dna-me.net` → **18.194.169.112** (deine Elastic IP) |
| 2. Domain in App | In `deploy/aws/.env.aws`: `DOMAIN_NAME=crm.dna-me.net` und `LETSENCRYPT_EMAIL=deine@email.de` |
| 3. Nginx-Config | Beim Deploy wird aus dem Template `nginx-aws.conf` mit genau dieser Domain erzeugt |
| 4. Ports | In der Security Group: **80** und **443** von außen erreichbar (für Certbot und HTTPS) |
| 5. Deploy | Nach dem Deploy holt Certbot im Container automatisch das Let's-Encrypt-Zertifikat |

Der **CNAME** (`_b541f4fc4ada8e15c788c9d9bc95f1d1.crm.dna-me.net` → ACM) und das **ACM-Zertifikat** (ARN) werden bei dieser Variante **nicht** verwendet — sie wären nur nötig, wenn ihr einen **Application Load Balancer (ALB)** oder **CloudFront** davor setzen würdet.

---

## Certbot (Let's Encrypt) — aktueller Weg

- SSL wird **direkt auf der EC2** in Nginx + Certbot eingerichtet.
- Kein ALB, keine Änderung an der Architektur.
- Ablauf:
  1. Beim Start des Containers `nginx-proxy` werden ggf. Dummy-Zertifikate angelegt, Nginx startet.
  2. Certbot nutzt den **HTTP-01-Challenge**: Let's Encrypt ruft `http://crm.dna-me.net/.well-known/acme-challenge/...` auf.
  3. Dafür muss **crm.dna-me.net** per **A-Record auf die Elastic IP** zeigen und **Port 80** von außen erreichbar sein.
  4. Certbot speichert die Zertifikate in `/etc/letsencrypt/live/<DOMAIN>/` (im Container-Volume).
  5. Nginx wird neu geladen und bedient danach HTTPS mit dem echten Zertifikat.

### Checkliste Certbot

- [ ] **A-Record**: `crm` (bzw. `crm.dna-me.net`) → **18.194.169.112**
- [ ] **.env.aws**: `DOMAIN_NAME=crm.dna-me.net`, `LETSENCRYPT_EMAIL=...`
- [ ] **nginx-aws.conf** wird mit dieser Domain erzeugt (passiert beim Deploy über Template)
- [ ] Security Group: **80** (HTTP) und **443** (HTTPS) von `0.0.0.0/0` (oder mindestens für Let's Encrypt erreichbar)
- [ ] Nach Deploy: 2–5 Minuten warten, dann https://crm.dna-me.net testen

### Wenn HTTPS nicht anspringt

1. **Logs des Nginx/Certbot-Containers prüfen**
   - z.B. `docker logs dna_nginx_proxy` auf der App-EC2
   - Dort siehst du, ob Certbot den Challenge erfolgreich abgeschlossen hat oder einen Fehler meldet (z.B. Domain nicht erreichbar, Timeout).

2. **DNS prüfen**
   - `nslookup crm.dna-me.net` oder `dig crm.dna-me.net` → muss **18.194.169.112** zurückgeben.

3. **Port 80 von außen testen**
   - `curl -I http://crm.dna-me.net/.well-known/acme-challenge/test` → sollte von Nginx/Certbot bedient werden (404 ist ok, wenn die Datei fehlt; wichtig: Antwort kommt von deinem Server).

4. **Domain überall gleich**
   - Überall, wo die Domain konfiguriert ist, muss **crm.dna-me.net** stehen (nicht .com), sonst weicht Certbot auf die falsche Domain aus oder Nginx antwortet nicht für den richtigen Host.

---

## AWS ACM — nur mit ALB/CloudFront

- Das **ACM-Zertifikat** (ARN: `arn:aws:acm:eu-central-1:075995348651:certificate/d1bcf56c-1437-4ba5-ab2d-be2ef6bba964`) und der **CNAME** zur Validierung sind für die **Validierung des Zertifikats** in AWS gedacht.
- **ACM-Zertifikate können nicht auf EC2/Nginx installiert werden.** Sie werden nur von AWS-Diensten verwendet:
  - **Application Load Balancer (ALB)** oder
  - **CloudFront**
- Wenn ihr das ACM-Zertifikat nutzen wollt, müsst ihr:
  - einen **ALB** (oder CloudFront) vor die EC2 setzen,
  - SSL am ALB/CloudFront beenden (dort das ACM-Zertifikat anhängen),
  - vom ALB per HTTP (oder HTTPS) zur EC2 weiterleiten.

Das wäre eine Architekturänderung („mit ALB“) und ist für das aktuelle „ohne ALB“-Setup **nicht nötig** — Certbot reicht für HTTPS.

---

## Zusammenfassung

- **HTTPS mit dem aktuellen Setup:** A-Record auf Elastic IP, `DOMAIN_NAME`/`LETSENCRYPT_EMAIL` in `.env.aws`, Ports 80/443 offen, Deploy ausführen — Certbot richtet das Zertifikat automatisch ein.
- **CNAME für ACM:** Wird nur für die ACM-Validierung gebraucht; für Certbot auf der EC2 ist er nicht nötig.
- **ACM-Zertifikat:** Nur verwendbar, wenn ihr später ALB oder CloudFront einsetzt; dann SSL-Terminierung dort mit diesem Zertifikat.
