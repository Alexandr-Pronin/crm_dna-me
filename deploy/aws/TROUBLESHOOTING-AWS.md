# AWS Deploy: Läuft lokal, auf dem Server nicht

## 1. Deploy-Fehler in der Konsole

Nach dem Update von `deploy-aws-ssm.sh` zeigt das Skript bei Fehlern jetzt **Stdout** und **Stderr** der SSM-Befehle. Schau dir die **Stderr**-Ausgabe an – dort steht meist die konkrete Fehlermeldung (z.B. Migration, npm, Docker).

## 2. Häufige Ursachen

| Problem | Prüfung | Lösung |
|--------|---------|--------|
| **Migration schlägt fehl** | Stderr: `column "xy" does not exist` oder `relation "pgmigrations"` | Auf dem Server sind nicht alle Migrationen gelaufen. Skript lädt `.env.aws` jetzt robuster für `npm run migrate:up`. Prüfe in `deploy/aws/.env.aws`, ob `DATABASE_URL` nicht gesetzt ist (wird vom Skript gesetzt). |
| **Umgebungsvariablen fehlen** | API startet, aber DB/Redis/SMTP-Fehler | In **deploy/aws/.env.aws** müssen dieselben Variablen wie lokal in `.env` stehen (außer `DATABASE_URL`). Besonders: `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEYS`, `REDIS_URL`, SMTP, ggf. `DOMAIN_NAME`, `CORS_ORIGIN`. |
| **DOMAIN_NAME / Nginx** | 502, oder SSL-Zertifikat fehlt | In `.env.aws`: `DOMAIN_NAME=crm.dna-me.net` (oder deine Domain). Nginx-Config wird daraus erzeugt. Beim ersten Start: Certbot braucht erreichbare Domain (DNS A-Record auf Elastic IP). |
| **Health-Check schlägt fehl** | Am Ende: "WARNING: Health check failed" | App braucht länger als 15 s oder Container starten nicht. Im Skript wird bei Fehler `docker logs dna_api` (letzte 30 Zeilen) ausgegeben. Prüfe Stderr in der Deploy-Ausgabe. |
| **Alte Container/Images** | Änderungen kommen nicht an | Skript führt `docker-compose ... up -d --build` aus. Bei Verdacht auf Cache: auf der App-EC2-Instanz per SSM manuell bauen: `docker-compose -f deploy/aws/docker-compose.aws.yml build --no-cache` und dann `up -d`. |

## 3. Status auf dem Server prüfen (SSM)

```bash
# App-Instanz
bash deploy/aws/check-app-status.sh
```

Oder manuell einen Befehl ausführen:

```bash
INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name dna-crm-stack --region eu-central-1 \
  --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text)
aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /opt/dna-crm && docker ps -a && echo --- && docker logs dna_api 2>&1 | tail -50"]' \
  --region eu-central-1
# CommandId ausgeben lassen, dann:
# aws ssm get-command-invocation --command-id <CommandId> --instance-id $INSTANCE_ID --region eu-central-1
```

## 4. Lokal vs. Server

- **Lokal**: Du nutzt oft `.env` und `npm run dev` / `npm run dev:workers`.  
- **Server**: Es zählt nur, was in **deploy/aws/.env.aws** steht (wird als `.env.app` hochgeladen und auf dem Server als `.env.aws` abgelegt). Alle Änderungen an Env-Variablen für AWS in **deploy/aws/.env.aws** machen und erneut deployen.

## 5. Nach einem Skript-Update

Wenn du nur `deploy-aws-ssm.sh` geändert hast:

1. Deploy erneut ausführen: `bash deploy/aws/deploy-aws-ssm.sh`
2. Bei Fehlern die **komplette Stderr-Ausgabe** der SSM-Befehle lesen (steht jetzt klar unter "Stderr:").
3. Bei "Health check failed" die danach ausgegebenen `dna_api`-Logzeilen prüfen.

Wenn der Fehler weiterhin unklar ist: Stderr- und (falls vorhanden) Log-Ausgabe vom letzten Deploy mit angeben.
