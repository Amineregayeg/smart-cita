# Black Friday Page Changes Plan - laserostop_bf

## Summary of Requested Changes

| Item | Current Value | New Value |
|------|---------------|-----------|
| Solo old crossed price | 250€ | 190€ |
| Duo old crossed price | 500€ | 380€ |
| Duo actual price | 269€ | 179€ |
| Form display price | center price (129€) | online price (99€, 179€, etc.) |
| Cannabis price | 250€ | 250€ (unchanged) |

---

## DETAILED CHANGES REQUIRED

### 1. LANDING PAGE - Pricing Cards (lines 495-565)

#### Card 1: Individual (Solo)
- **Line 504**: Change `250€` → `190€` (old crossed price)
- **Line 509**: Change `Ahorra 151€` → `Ahorra 91€` (190 - 99 = 91)

#### Card 2: Dúo
- **Line 520**: Change `269€` → `179€` (actual price)
- **Line 521**: Change `500€` → `380€` (old crossed price)
- **Line 526**: Change `Ahorra 231€` → `Ahorra 201€` (380 - 179 = 201)

#### Card 3: Pago Flexible (3×40€)
- **Line 538**: Change `250€` → `190€` (old crossed price)
- **Line 543**: Change `Ahorra 130€` → `Ahorra 70€` (190 - 120 = 70)

---

### 2. FORM SIDEBAR - Sales Highlights (lines 740-750)

- **Line 744**: Change `hasta 250€` → `hasta 190€`
- **Line 748**: `desde 99€` - KEEP AS IS (already shows online price)

---

### 3. POPUP - Payment Options (lines 780-900)

#### Online Payment Card
- **Line 801**: Change `€250` → `€190` (popup-online-original)
- **Line 802**: Change `151` → `91` (popup-savings-amount) - dynamically updated but default matters

#### Pay at Center Card
- **Line 837**: Change `€250` → `€190` (popup-center-old)
- **Line 838**: Change `121` → `61` (popup-center-savings) - 190 - 129 = 61

#### Monthly Plan Card
- **Line 877**: Change `130` → `70` (popup-plan-savings) - 190 - 120 = 70

---

### 4. PRICE_TABLE - JavaScript Configuration (lines 1909-1915)

```javascript
// CURRENT:
const PRICE_TABLE = {
  solo_cig:   { centerOld: 250, center: 129, onlineOld: 250, online: 99, plan: [40, 40, 40] },
  duo_cig:    { centerOld: 400, center: 340, onlineOld: 400, online: 320, plan: [105, 105, 105] },
  solo_drugs: { centerOld: 300, center: 250, onlineOld: 300, online: 189, plan: [70, 70, 70] },
  ...
};

// NEW:
const PRICE_TABLE = {
  solo_cig:   { centerOld: 190, center: 129, onlineOld: 190, online: 99, plan: [40, 40, 40] },
  duo_cig:    { centerOld: 380, center: 340, onlineOld: 380, online: 179, plan: [60, 60, 60] },
  solo_drugs: { centerOld: 300, center: 250, onlineOld: 300, online: 189, plan: [70, 70, 70] },  // Cannabis unchanged
  ...
};
```

**Changes:**
- `solo_cig.centerOld`: 250 → 190
- `solo_cig.onlineOld`: 250 → 190
- `duo_cig.centerOld`: 400 → 380
- `duo_cig.onlineOld`: 400 → 380
- `duo_cig.online`: 320 → 179
- `duo_cig.plan`: [105, 105, 105] → [60, 60, 60] (179 ÷ 3 ≈ 60)

---

### 5. STRIPE LINKS - Need New Payment Links for Duo

**Current Duo Links:**
- Company 1: €320 onetime, 3×€105 monthly
- Company 2: €320 onetime, 3×€105 monthly

**Need NEW Stripe Links:**
- Company 1: €179 onetime, 3×€60 monthly
- Company 2: €179 onetime, 3×€60 monthly

**ACTION REQUIRED:** Create 4 new Stripe payment links (2 per company)

---

### 6. FORM APPOINTMENT TYPES - Display Prices (lines 1845-1900)

Currently showing center prices (190€). Need to show online prices:

**Current (example):**
```javascript
{ id: '1', kind: 'solo_cig', name: 'Solo – Dejar de fumar (1h)', duration: 60, price: 190, ... }
```

**Should be:**
```javascript
{ id: '1', kind: 'solo_cig', name: 'Solo – Dejar de fumar (1h)', duration: 60, price: 99, ... }
```

**Changes for each center:**
- `solo_cig` price: 190 → 99 (online price)
- `duo_cig` price: need to add duo options with price 179
- `solo_drugs` (cannabis): 250 → stays 250 (but should reflect online price 189)

---

## COMPLETE CHANGES CHECKLIST

| # | Location | Line(s) | Current | New | Status |
|---|----------|---------|---------|-----|--------|
| 1 | Card 1 old price | 504 | 250€ | 190€ | Pending |
| 2 | Card 1 ahorra | 509 | 151€ | 91€ | Pending |
| 3 | Card 2 price | 520 | 269€ | 179€ | Pending |
| 4 | Card 2 old price | 521 | 500€ | 380€ | Pending |
| 5 | Card 2 ahorra | 526 | 231€ | 201€ | Pending |
| 6 | Card 3 old price | 538 | 250€ | 190€ | Pending |
| 7 | Card 3 ahorra | 543 | 130€ | 70€ | Pending |
| 8 | Form "hasta" price | 744 | 250€ | 190€ | Pending |
| 9 | Popup online old | 801 | €250 | €190 | Pending |
| 10 | Popup online savings | 802 | 151 | 91 | Pending |
| 11 | Popup center old | 837 | €250 | €190 | Pending |
| 12 | Popup center savings | 838 | 121 | 61 | Pending |
| 13 | Popup plan savings | 877 | 130 | 70 | Pending |
| 14 | PRICE_TABLE solo_cig | 1910 | centerOld/onlineOld: 250 | 190 | Pending |
| 15 | PRICE_TABLE duo_cig | 1911 | online: 320, plan: [105,105,105] | online: 179, plan: [60,60,60] | Pending |
| 16 | PRICE_TABLE duo_cig old | 1911 | centerOld/onlineOld: 400 | 380 | Pending |
| 17 | Stripe Links duo | 1707-1709, 1726-1728 | €320, 3×€105 | €179, 3×€60 | Need new links |
| 18 | Form prices solo_cig | 1849+ | 190 | 99 | Pending |
| 19 | Form prices solo_drugs | 1851+ | 250 | 189 (online) | Pending |

---

## STRIPE LINKS TO CREATE

### Company 1 (Madrid Chamartín, Torrejón, Majadahonda, San Sebastián)
1. **Duo One-time**: €179
2. **Duo Monthly**: 3×€60

### Company 2 (Valencia, Barcelona Sants, Sevilla, Madrid Atocha)
1. **Duo One-time**: €179
2. **Duo Monthly**: 3×€60

---

## NOTES

1. **Cannabis (solo_drugs)** stays at 250€ center price, 189€ online price - NO CHANGES
2. **Form display** should show ONLINE prices (99€, 179€, 189€) not center prices
3. All ahorra calculations verified mathematically
4. Duo monthly plan: 179€ ÷ 3 = 59.67€ → rounded to 60€ per month

---

## AWAITING APPROVAL

Please confirm:
1. All values above are correct
2. Should I proceed with creating new Stripe payment links for Duo (€179 and 3×€60)?
3. Any additional changes needed?
