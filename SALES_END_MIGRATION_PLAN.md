# Sales End Migration Plan: Normalize All Pages to Standard Pricing

## Executive Summary

Sales and promotions are ending. All landing pages need to be normalized to match `/laserostop_espagna` standard pricing.

---

## Current State Analysis

### Pages Inventory (13 total)

| Page | Type | Current Pricing | Status |
|------|------|-----------------|--------|
| `laserostop_espagna` | Reference | Standard | **REFERENCE - NO CHANGES** |
| `laserostop_es` | Promo | Standard (same as espagna) | **NO CHANGES** |
| `laserostop_bf` | Black Friday | **DISCOUNTED** | NEEDS UPDATE |
| `laserostop_azucar` | Sugar Special | Custom pricing | NEEDS REVIEW |
| `laserostop_valencia` | Center (BF) | **DISCOUNTED** | NEEDS UPDATE |
| `laserostop_sevilla` | Center (BF) | **DISCOUNTED** | NEEDS UPDATE |
| `laserostop_barcelona` | Center | Standard | **NO CHANGES** |
| `laserostop_atocha` | Center | Standard | **NO CHANGES** |
| `laserostop_chamartin` | Center | Standard | **NO CHANGES** |
| `laserostop_majadahonda` | Center | Standard | **NO CHANGES** |
| `laserostop_sansebastian` | Center | Standard | **NO CHANGES** |
| `laserostop_torrejon` | Center | Standard | **NO CHANGES** |

---

## Pricing Comparison Table

### PRICE_TABLE Values

| Service | Standard (espagna) | Black Friday (bf) | Difference |
|---------|-------------------|-------------------|------------|
| **solo_cig (online)** | €149 | €99 | -€50 |
| **solo_cig (center)** | €190 | €129 | -€61 |
| **solo_cig (plan)** | 3×€60 | 3×€40 | -€60 total |
| **duo_cig (online)** | €269 | €179 | -€90 |
| **duo_cig (center)** | €340 | €340 | Same |
| **duo_cig (plan)** | 3×€90 | 3×€60 | -€90 total |
| **solo_drugs** | €189 | €189 | Same |
| **solo_sugar** | €180 | €180 | Same |

### Stripe Links Status

| Page | solo_cig Links | duo_cig Links | Comment |
|------|---------------|---------------|---------|
| espagna | €149/3×60 | €269/3×90 | STANDARD |
| es | €149/3×60 | €269/3×90 | STANDARD |
| bf | €99/3×40 | €179/3×60 | **BLACK FRIDAY** |
| valencia | €99/3×40 | €179/3×60 | **BLACK FRIDAY** |
| sevilla | €99/3×40 | €179/3×60 | **BLACK FRIDAY** |

---

## Pages Requiring Updates

### 1. `/laserostop_bf` - MAJOR CHANGES

**Location:** `/smart-cita-deployment/laserostop_bf/index.html`

#### Changes Required:

**A. PRICE_TABLE (Line ~1958)**
```javascript
// FROM (Black Friday):
const PRICE_TABLE = {
  solo_cig:   { centerOld: 190, center: 129, onlineOld: 190, online: 99, plan: [40, 40, 40] },
  duo_cig:    { centerOld: 380, center: 340, onlineOld: 380, online: 179, plan: [60, 60, 60] },
  ...
};

// TO (Standard):
const PRICE_TABLE = {
  solo_cig:   { centerOld: 190, center: 190, onlineOld: 190, online: 149, plan: [60, 60, 60] },
  duo_cig:    { centerOld: 380, center: 340, onlineOld: 380, online: 269, plan: [90, 90, 90] },
  solo_drugs: { centerOld: 300, center: 250, onlineOld: 300, online: 189, plan: [70, 70, 70] },
  rechute:    { center: 0 },
  solo_sugar: { centerOld: 280, center: 200, onlineOld: 280, online: 180, plan: [60, 60, 60] }
};
```

**B. APPOINTMENT_TYPES prices (Line ~1898)**
```javascript
// Update all center entries from:
{ id: '1', kind: 'solo_cig', name: '...', price: 99, ... }
// TO:
{ id: '1', kind: 'solo_cig', name: '...', price: 149, ... }

// Update duo_cig from price: 179 to price: 269
```

**C. Stripe Links (Line ~1749)**
```javascript
// FROM (Black Friday):
solo_cig: {
  onetime: 'https://buy.stripe.com/4gM6oGdMjeMC4vb229awo0i',  // €99 BLACK FRIDAY
  monthly: 'https://buy.stripe.com/28E14m6jRdIy2n3ayFawo0h'   // 3×€40 BLACK FRIDAY
},
duo_cig: {
  onetime: 'https://buy.stripe.com/aFafZg4bJ47Yd1H7mtawo0j',   // €179 BLACK FRIDAY
  monthly: 'https://buy.stripe.com/eVqeVcfUrcEu3r7229awo0k'    // 3×€60 BLACK FRIDAY
}

// TO (Standard):
solo_cig: {
  onetime: 'https://buy.stripe.com/5kQdR85fNfQG9PvbCJawo0b',  // €149
  monthly: 'https://buy.stripe.com/dRm6oGbEb1ZQ8LreOVawo0f'   // 3×€60
},
duo_cig: {
  onetime: 'https://buy.stripe.com/28E9AS0ZxfQGd1H4ahawo01',   // €320 (or €269 if available)
  monthly: 'https://buy.stripe.com/9B64gyeQn7kabXD9uBawo07'    // 3×€105 (or 3×€90 if available)
}
```

**D. Frontend Price Cards (Lines ~503-543)**
```html
<!-- Card 1: Individual - Update from 99€ to 149€ -->
<span class="text-4xl font-black" style="color: #14A3A3;">99€</span>  → 149€
<span class="text-sm line-through">190€</span>  → Keep same
<div>Ahorra 91€</div>  → Ahorra 41€

<!-- Card 2: Dúo - Update from 179€ to 269€ -->
<span class="text-4xl font-black" style="color: #2563EB;">179€</span>  → 269€
<span class="text-sm line-through">380€</span>  → Keep same
<div>Ahorra 201€</div>  → Ahorra 111€

<!-- Card 3: Pago Flexible - Update from 3×40€ to 3×60€ -->
<span class="text-4xl font-black" style="color: #7C3AED;">3×40€</span>  → 3×60€
<div>Ahorra 70€</div>  → Ahorra 10€
```

**E. Promo Popup (Line ~793-797)**
```html
<!-- Update "desde" price -->
<span class="text-lg font-bold" style="color: #22A9AF;">desde 99€</span>
→ <span class="text-lg font-bold" style="color: #22A9AF;">desde 149€</span>
```

**F. Payment Popup Default Values (Lines ~849-926)**
```html
<!-- Update popup default prices -->
popup-online-price: €99 → €149
popup-savings-amount: 91 → 41
popup-center-price: €129 → €190
popup-center-savings: 61 → 0
popup-monthly-price: €40 → €60
popup-plan-savings: 70 → 10
popup-monthly-total: 120 → 180

<!-- Update warning message -->
"⚠️ Pagas 30€ más que reservando online" → "⚠️ Pagas 41€ más que reservando online"
```

**G. Urgency Banner (Lines ~390-391)**
```html
<!-- Optional: Can keep or remove -->
<span>⏳ Solo 5 plazas disponibles a precio especial hoy</span>
→ Remove or change to generic "Plazas limitadas disponibles"
```

**H. Section Header (Lines ~490-491)**
```html
<h2>Nuestras <span style="...">Ofertas</span></h2>
<p style="color: #E53935;">Plazas limitadas...</p>
→ Change to match espagna styling (neutral, not promotional)
```

---

### 2. `/laserostop_valencia` - MAJOR CHANGES

**Location:** `/smart-cita-deployment/laserostop_valencia/index.html`

Same changes as laserostop_bf:
- Update PRICE_TABLE (Line ~1621)
- Update APPOINTMENT_TYPES (Line ~1557)
- Update Stripe Links (Line ~1412)
- Update frontend price displays
- Update promo popup "desde" price (Line ~647)

---

### 3. `/laserostop_sevilla` - MAJOR CHANGES

**Location:** `/smart-cita-deployment/laserostop_sevilla/index.html`

Same changes as laserostop_bf:
- Update PRICE_TABLE (Line ~1631)
- Update APPOINTMENT_TYPES (Line ~1567)
- Update Stripe Links (Line ~1422)
- Update frontend price displays
- Update promo popup "desde" price (Line ~647)

---

### 4. `/laserostop_azucar` - SPECIAL REVIEW

**Location:** `/smart-cita-deployment/laserostop_azucar/index.html`

This page has slightly different pricing structure:
```javascript
solo_cig: { centerOld: 250, center: 190, onlineOld: 250, online: 149, plan: [50, 50, 50] }
```

**Needs decision:** Should centerOld stay at 250 or change to 190 like other pages?

---

## Summary of Changes by File

### Files Requiring MAJOR Updates (3 files):
1. `laserostop_bf/index.html`
2. `laserostop_valencia/index.html`
3. `laserostop_sevilla/index.html`

### Files Requiring REVIEW (1 file):
1. `laserostop_azucar/index.html`

### Files with NO Changes Needed (9 files):
1. `laserostop_espagna/index.html` (reference)
2. `laserostop_es/index.html`
3. `laserostop_barcelona/index.html`
4. `laserostop_atocha/index.html`
5. `laserostop_chamartin/index.html`
6. `laserostop_majadahonda/index.html`
7. `laserostop_sansebastian/index.html`
8. `laserostop_torrejon/index.html`

---

## Change Checklist Per File (bf, valencia, sevilla)

For each file, update:

- [ ] **PRICE_TABLE** - Change solo_cig and duo_cig values
- [ ] **APPOINTMENT_TYPES** - Update price field for each appointment type
- [ ] **Stripe Links (company1)** - Replace solo_cig and duo_cig URLs
- [ ] **Stripe Links (company2)** - Replace solo_cig and duo_cig URLs
- [ ] **Frontend Card 1** - Individual price (99→149, Ahorra 91→41)
- [ ] **Frontend Card 2** - Dúo price (179→269, Ahorra 201→111)
- [ ] **Frontend Card 3** - Flexible plan (3×40→3×60, Ahorra 70→10)
- [ ] **Promo Popup** - "desde" price (99→149)
- [ ] **Payment Popup** - All default values
- [ ] **Urgency Banner** - Remove or neutralize (optional)
- [ ] **Section Header** - Remove promotional styling (optional)

---

## Risk Assessment

### High Priority (Must Change)
- Stripe Links - Customers will be charged wrong amounts
- PRICE_TABLE - Popup prices will be wrong
- APPOINTMENT_TYPES - Displayed prices will be wrong

### Medium Priority (Should Change)
- Frontend Price Cards - Visual inconsistency
- Payment Popup defaults - First render will show wrong prices

### Low Priority (Nice to Have)
- Urgency banners - Marketing messaging
- Section headers - Branding consistency

---

## Rollback Plan

If issues arise:
1. All changes are in Git - can revert to previous commit
2. Each file can be reverted independently
3. Keep backup of current files before making changes

---

## Testing Checklist

After changes, verify:
- [ ] Price cards show correct amounts (149€, 269€, 3×60€)
- [ ] Payment popup displays correct prices
- [ ] Stripe links open correct payment amounts
- [ ] Ahorra badges show correct savings (41€, 111€, 10€)
- [ ] Promo popup shows "desde 149€"
- [ ] Mobile responsive layout still works
- [ ] All 8 centers can be selected and booked

---

## Approval Required

Please confirm:
1. Should I proceed with updating the 3 main files (bf, valencia, sevilla)?
2. What should we do with laserostop_azucar special pricing?
3. Should urgency banners be removed or just neutralized?
4. Should promotional section headers be changed to match espagna neutral style?

Awaiting your approval to proceed with implementation.
