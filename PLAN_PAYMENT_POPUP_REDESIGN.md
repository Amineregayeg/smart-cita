# Payment Popup Redesign - Implementation Plan

## Overview
Redesign the payment popup to promote online payment as the recommended option, with updated pricing structure.

---

## Current vs New Pricing

### PRICE_TABLE Changes

| Type | Field | Current | New |
|------|-------|---------|-----|
| **solo_cig** | online | 170 | **149** |
| **solo_cig** | plan | [60, 60, 60] | **[50, 50, 50]** |
| **solo_drugs** | online | 230 | **189** |
| **solo_drugs** | plan | [80, 80, 80] | **[70, 70, 70]** |
| duo_cig | online | 320 | 320 (unchanged?) |
| duo_cig | plan | [105, 105, 105] | unchanged? |
| solo_sugar | online | 180 | unchanged? |
| solo_sugar | plan | [60, 60, 60] | unchanged? |

**Note:** Need to add `onlineOld` field to show crossed-out price (€250 for tabac, €300 for cannabis)

---

## Changes Required

### 1. PRICE_TABLE Update (line 1891-1897)

**Current:**
```javascript
const PRICE_TABLE = {
  solo_cig:   { centerOld: 250, center: 190, online: 170, plan: [60, 60, 60] },
  duo_cig:    { centerOld: 400, center: 340, online: 320, plan: [105, 105, 105] },
  solo_drugs: { centerOld: 300, center: 250, online: 230, plan: [80, 80, 80] },
  rechute:    { center: 0 },
  solo_sugar: { centerOld: 280, center: 200, online: 180, plan: [60, 60, 60] }
};
```

**New:**
```javascript
const PRICE_TABLE = {
  solo_cig:   { centerOld: 250, center: 190, onlineOld: 250, online: 149, plan: [50, 50, 50] },
  duo_cig:    { centerOld: 400, center: 340, onlineOld: 400, online: 320, plan: [105, 105, 105] },
  solo_drugs: { centerOld: 300, center: 250, onlineOld: 300, online: 189, plan: [70, 70, 70] },
  rechute:    { center: 0 },
  solo_sugar: { centerOld: 280, center: 200, onlineOld: 280, online: 180, plan: [60, 60, 60] }
};
```

---

### 2. HTML Payment Popup Restructure (lines 597-687)

**Swap Option 1 (Center) and Option 2 (Online)**

#### NEW Option 1: Pay Online (RECOMMENDED) - Was Option 2
- Add "OPCIÓN RECOMENDADA" badge (instead of "SELECCIONADO")
- Border: `border-primary bg-primary/5` (highlighted)
- Icon: `flash_on` (purple → keep or change to primary?)
- Show: `€149` crossed-out `€250`, "AHORRA €101"
- Add benefits list:
  - Confirmación inmediata
  - Pago 100% seguro (SSL)
  - Garantía de reembolso si cancelas 24h antes
  - Oferta limitada solo para pagos online
- Button: "Pagar €149 ahora"

#### NEW Option 2: Pay at Center - Was Option 1
- Remove "SELECCIONADO" badge
- Border: `border-gray-200` (not highlighted)
- Icon: `store` (green)
- Show: `€190` crossed-out `€250`
- Add warning text: "La cita puede ser anulada si hay mucha demanda"
- Button: "Reservar y pagar en el centro"

#### Option 3: Pay in 3 Installments (stays in position)
- Update to show new monthly amounts (€50 for tabac, €70 for cannabis)
- Add benefits: Reserva confirmada, Pago flexible, Pago 100% seguro

#### Footer: Security Badges
- Add: Stripe, Visa, Mastercard, Apple Pay, Google Pay logos
- Text: "Pago protegido con encriptación SSL"

---

### 3. JavaScript showPaymentPopup() Update (lines 1533-1607)

**Add dynamic savings calculation:**
```javascript
// Calculate savings for online option
const onlineSavings = priceData.onlineOld - priceData.online;

// Update savings display
document.getElementById('popup-online-savings').textContent = onlineSavings;
document.getElementById('popup-online-original').textContent = `€${priceData.onlineOld}`;
```

**New elements to update:**
- `popup-online-original` → Show `onlineOld` (not centerPrice)
- `popup-online-savings` → New element for "AHORRA €XX"
- `popup-center-savings` → New element for center savings

---

### 4. selectPaymentOption() Update (lines 1731-1789)

**Swap option numbers:**
- `option === 1` → Now triggers online payment (was center)
- `option === 2` → Now triggers center payment (was online)
- `option === 3` → Stays as installments

**OR keep numbers but swap HTML positions** (cleaner approach)

---

### 5. Stripe Links - Potential Updates

Current Stripe links are configured for old prices:
- solo_cig onetime: €170 → Need new link for **€149**
- solo_drugs onetime: €230 → Need new link for **€189**
- solo_cig monthly: 3×€60 → Need new link for **3×€50**
- solo_drugs monthly: 3×€80 → Need new link for **3×€70**

**Action Required:** Create new Stripe Payment Links for:
1. Company 1 solo_cig: €149 onetime, €50/month subscription
2. Company 1 solo_drugs: €189 onetime, €70/month subscription
3. Company 2 solo_cig: €149 onetime, €50/month subscription
4. Company 2 solo_drugs: €189 onetime, €70/month subscription

---

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `laserostop_espagna/index.html` | 597-687 | Payment popup HTML restructure |
| `laserostop_espagna/index.html` | 1533-1607 | showPaymentPopup() JS updates |
| `laserostop_espagna/index.html` | 1731-1789 | selectPaymentOption() JS updates |
| `laserostop_espagna/index.html` | 1681-1721 | Stripe links (if new links provided) |
| `laserostop_espagna/index.html` | 1891-1897 | PRICE_TABLE updates |

---

## Questions Before Implementation

1. **duo_cig and solo_sugar pricing** - Should these also be updated? Current:
   - duo_cig: online €320, plan 3×€105
   - solo_sugar: online €180, plan 3×€60

2. **Stripe Payment Links** - Do you have new Stripe links for:
   - €149 solo_cig (onetime)
   - €189 solo_drugs (onetime)
   - €50/month solo_cig (subscription)
   - €70/month solo_drugs (subscription)

   Or should I keep the old links temporarily?

3. **Visual styling** - Should the online option use:
   - Purple theme (current) or
   - Primary teal (#22A9AF) theme?

4. **Center option warning** - Exact wording for "may be cancelled" message?

---

## Implementation Order

1. Update PRICE_TABLE with new prices + onlineOld field
2. Restructure HTML - swap options 1 and 2
3. Add new UI elements (badges, benefits lists, security logos)
4. Update showPaymentPopup() for dynamic calculations
5. Update selectPaymentOption() if needed
6. Update Stripe links (when provided)
7. Test all 5 appointment types × 8 centers

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking payment flow | Test thoroughly before deploy |
| Wrong Stripe amounts | Verify links match new prices |
| Missing price data | Add fallbacks for missing onlineOld |
| Mobile layout issues | Test responsive design |

---

## Rollback Plan

If issues arise:
```bash
git checkout 57adbb7 -- laserostop_espagna/index.html
```

This reverts to the last working version (Nov 24, 2025).
