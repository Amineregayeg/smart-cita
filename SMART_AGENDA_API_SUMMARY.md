# Smart Agenda API Summary for LaserOstop España

**Generated:** December 22, 2025
**Purpose:** Enable chatbot booking capability

---

## API Authentication

```javascript
const BASE_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const CREDENTIALS = {
  login: 'eshapi48Kd79BmSy83A',
  pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150',
  api_id: 'app_landing',
  api_key: '95Gt-Ke92-48Uf39Sp27hF'
};

// Get token: POST /token with CREDENTIALS
// Use token: Header 'X-SMARTAPI-TOKEN: {token}'
```

---

## 6 Bookable Centers

| Agenda ID | Center Name | Group ID | Status |
|-----------|-------------|----------|--------|
| 43 | Barcelona Sants | 4 | ✅ Bookable |
| 44 | Sevilla | 5 | ✅ Bookable |
| 48 | Madrid Chamartín | 7 | ✅ Bookable |
| 49 | Torrejón de Ardoz | 6 | ✅ Bookable |
| 50 | Madrid Atocha | 8 | ✅ Bookable |
| 51 | Majadahonda | 10 | ✅ Bookable |

### NOT Bookable (excluded from booking page)

| Agenda ID | Center Name | Reason |
|-----------|-------------|--------|
| 10 | Valencia | Temporarily closed |
| 52 | San Sebastián | Temporarily closed |

---

## Appointment Types by Center

### Barcelona Sants (Agenda ID: 43)

| Type ID | Service | Duration | Price |
|---------|---------|----------|-------|
| 20 | Solo – Dejar de fumar | 60min | 190€ |
| 21 | Duo – Dejar de fumar | 90min | 360€ |
| 23 | Adicción al cannabis | 60min | 250€ |
| 22 | En caso de recaída | 30min | 0€ |
| 91 | Adicción al azúcar | 60min | 200€ |

### Sevilla (Agenda ID: 44)

| Type ID | Service | Duration | Price |
|---------|---------|----------|-------|
| 32 | Solo – Dejar de fumar | 60min | 190€ |
| 34 | Duo – Dejar de fumar | 90min | 360€ |
| 37 | Adicción al cannabis | 60min | 250€ |
| 35 | En caso de recaída | 30min | 0€ |
| 96 | Adicción al azúcar | 60min | 200€ |

### Madrid Chamartín (Agenda ID: 48)

| Type ID | Service | Duration | Price |
|---------|---------|----------|-------|
| 44 | Solo – Dejar de fumar | 60min | 190€ |
| 46 | Duo – Dejar de fumar | 90min | 360€ |
| 49 | Adicción al cannabis | 60min | 250€ |
| 47 | En caso de recaída | 30min | 0€ |
| 93 | Adicción al azúcar | 60min | 200€ |

### Torrejón de Ardoz (Agenda ID: 49)

| Type ID | Service | Duration | Price |
|---------|---------|----------|-------|
| 53 | Solo – Dejar de fumar | 60min | 190€ |
| 56 | Duo – Dejar de fumar | 90min | 360€ |
| 59 | Adicción al cannabis | 60min | 250€ |
| 57 | En caso de recaída | 30min | 0€ |
| 97 | Adicción al azúcar | 60min | 200€ |

### Madrid Atocha (Agenda ID: 50)

| Type ID | Service | Duration | Price |
|---------|---------|----------|-------|
| 63 | Solo – Dejar de fumar | 60min | 190€ |
| 65 | Duo – Dejar de fumar | 90min | 360€ |
| 68 | Adicción al cannabis | 60min | 250€ |
| 66 | En caso de recaída | 30min | 0€ |
| 92 | Adicción al azúcar | 60min | 200€ |

### Majadahonda (Agenda ID: 51)

| Type ID | Service | Duration | Price |
|---------|---------|----------|-------|
| 72 | Solo – Dejar de fumar | 60min | 190€ |
| 74 | Duo – Dejar de fumar | 90min | 360€ |
| 77 | Adicción al cannabis | 60min | 250€ |
| 75 | En caso de recaída | 30min | 0€ |
| 94 | Adicción al azúcar | 60min | 200€ |

---

## Staff Assignments (from CM)

| Zone | Staff |
|------|-------|
| Madrid (all centers) | Nabila |
| Sevilla | Emily |
| Atocha | Ana |
| Barcelona | Argi |

---

## Company Structure (for billing)

### Company 1: Madrid Chamartín, Torrejón, Majadahonda
- Stripe payments go to Company 1 account

### Company 2: Barcelona Sants, Sevilla, Madrid Atocha
- Stripe payments go to Company 2 account

---

## Availability API

### Endpoint

```
POST /service/getAvailabilities
Headers: X-SMARTAPI-TOKEN: {token}
Content-Type: application/json
```

### Request

```json
{
  "pdo_type_rdv_id": "20",
  "pdo_agenda_id": "43",
  "date_a_partir_de": "2025-12-22",
  "date_fin": "2026-01-05"
}
```

### Response Structure

```json
[
  {
    "nj": "Tuesday",           // Day name (English)
    "dj": "2025-12-23",        // Date (YYYY-MM-DD)
    "ja": "23/12/25",          // Date (DD/MM/YY)
    "det": [                   // Available time slots
      {
        "idp": "11:00",        // Time slot (HH:MM)
        "ida": "43",           // Agenda ID
        "idpr": "20"           // Appointment type ID
      }
    ]
  }
]
```

---

## Booking API

### Create Booking

```
POST /pdo_events
```

```json
{
  "client_id": "123",
  "presta_id": "20",           // Appointment type ID
  "ressource_id": "-1",
  "start_date": "2025-12-23T11:00:00",
  "end_date": "2025-12-23T12:00:00",
  "equipe_id": "43",           // Agenda ID (center)
  "internet": "O"              // Online booking
}
```

---

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/token` | POST | Get auth token |
| `/pdo_agenda` | GET | List all centers |
| `/pdo_groupe` | GET | List all groups |
| `/pdo_type_rdv` | GET | List appointment types |
| `/pdo_client` | GET/POST | Client management |
| `/pdo_events` | POST | Create booking |
| `/service/getAvailabilities` | POST | Check availability |

---

## Booking Page URL

```
https://smart-cita.com/laserostop_bf/
```

Users can book directly on this page for all 6 centers.
