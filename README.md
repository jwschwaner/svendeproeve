# Sortr – AI-baseret mailhåndtering (SaaS)

Multi-tenant SaaS-platform der automatisk modtager, klassificerer og organiserer indgående mails via IMAP-integration og AI.

---

## Stack

| Komponent  | Teknologi            |
|------------|----------------------|
| Backend    | Python + FastAPI     |
| Database   | MongoDB              |
| Frontend   | Next.js + Material UI |
| Mail       | IMAP + SMTP          |
| Tests      | Playwright + Docker  |

---

## Funktioner

- IMAP-integration med UID-tracking og trådhåndtering
- AI-baseret kategorisering og prioritering
- Rollebaseret adgang (Superbruger, Administrator, Medarbejder)
- Svar på mails via SMTP, interne noter, filtrering og søgning
- Logisk multi-tenant isolation

---

## Opsætning

Se [INSTALLATIONSVEJLEDNING.md](INSTALLATIONSVEJLEDNING.md).

---

## Projektstruktur

```
backend/
  app/
    api/
    services/
    models/
    main.py
  requirements.txt

frontend/
  src/
    app/
    components/
  package.json
```

---

Projektet er udviklet som svendeprøve.
