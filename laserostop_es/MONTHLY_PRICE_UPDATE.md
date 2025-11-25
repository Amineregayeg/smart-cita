# Monthly Payment Plan Price Update

**Date:** 2025-11-23
**Status:** ✅ COMPLETED

## Changes Summary

Updated monthly subscription prices for all appointment types (Solo, Duo, Cannabis) across both Stripe accounts.

### Price Changes

| Appointment Type | Old Monthly Price | New Monthly Price | Total Change |
|-----------------|-------------------|-------------------|--------------|
| **Solo Cigarettes** | 3×€65 (€195) | 3×€60 (€180) | -€15 (-7.7%) |
| **Duo Cigarettes** | 3×€114 (€342) | 3×€105 (€315) | -€27 (-7.9%) |
| **Cannabis** | 3×€84 (€252) | 3×€80 (€240) | -€12 (-4.8%) |
| **Sugar Addiction** | 3×€65 (€195) | 3×€60 (€180) | -€15 (-7.7%) |

**Note:** One-time payment prices remain unchanged (€170, €320, €230)

---

## Implementation Details

### 1. Frontend Changes (index.html)

#### Updated PRICE_TABLE (Line 1727-1733)
```javascript
const PRICE_TABLE = {
  solo_cig:   { center: 190, online: 170, plan: [60, 60, 60] },  // was [65, 65, 65]
  duo_cig:    { center: 340, online: 320, plan: [105, 105, 105] }, // was [114, 114, 114]
  solo_drugs: { center: 250, online: 230, plan: [80, 80, 80] },   // was [84, 84, 84]
  rechute:    { center: 0 },
  solo_sugar: { center: 200, online: 180, plan: [60, 60, 60] }    // was [65, 65, 65]
};
```

#### Updated Payment Popup Logic (Line 1455-1473)
```javascript
if (typeName.includes('duo')) {
  monthlyPrice = 105;  // was 114
} else if (typeName.includes('cannabis')) {
  monthlyPrice = 80;   // was 84
} else {
  monthlyPrice = 60;   // was 65 (Solo cigarettes default)
}
```

#### Updated Stripe Links (Line 1526-1557)
All monthly payment links updated with new Stripe subscription URLs.

---

### 2. Stripe Configuration

#### New Products Created

**Company 1 (Madrid Region):**
- Product: `prod_TTj7EjMfhzCtki` - Solo €60/month
- Product: `prod_TTj7uAMo5RNoCe` - Duo €105/month
- Product: `prod_TTj7eCTHarrOPb` - Cannabis €80/month

**Company 2 (Other Regions):**
- Product: `prod_TTj7wHN8WgNNlL` - Solo €60/month
- Product: `prod_TTj71dndUbYVqq` - Duo €105/month
- Product: `prod_TTj7PPeSEavwZ4` - Cannabis €80/month

#### New Payment Links

**Company 1:**
```javascript
solo_cig:   monthly: 'https://buy.stripe.com/4gM7sKeQn0VMd1H4ahawo06'
duo_cig:    monthly: 'https://buy.stripe.com/9B64gyeQn7kabXD9uBawo07'
solo_drugs: monthly: 'https://buy.stripe.com/dRmfZggYvdIyf9P0Y5awo08'
```

**Company 2:**
```javascript
solo_cig:   monthly: 'https://buy.stripe.com/14AeVd4S1ak55Obf3adby0e'
duo_cig:    monthly: 'https://buy.stripe.com/7sYcN5dox3VH1xV08gdby0f'
solo_drugs: monthly: 'https://buy.stripe.com/28E7sL3NX8bXdgDaMUdby0g'
```

---

## Testing Checklist

- [ ] Test Solo cigarettes monthly payment (€60/month)
- [ ] Test Duo cigarettes monthly payment (€105/month)
- [ ] Test Cannabis monthly payment (€80/month)
- [ ] Verify payment popup displays correct prices
- [ ] Verify Stripe checkout shows correct monthly amounts
- [ ] Confirm subscription creates 3 monthly charges
- [ ] Test for both Company 1 and Company 2 centers

---

## Rollout Notes

1. **Old Payment Links:** Previous monthly payment links are still active in Stripe but no longer referenced in the code
2. **One-Time Payments:** Unchanged - no updates needed
3. **Backward Compatibility:** Existing subscriptions using old prices will continue at their original rates
4. **New Bookings:** All new bookings after deployment will use the new reduced monthly prices

---

## Business Impact

- **Customer Benefit:** Lower monthly payments make installment plans more attractive
- **Price Reduction:** 5-8% discount on monthly plans
- **Competitive Advantage:** More affordable payment options increase conversion
- **Total Revenue:** Reduced by €12-€27 per installment customer (offset by increased conversion rate)

---

## Files Modified

- `/mnt/d/LP-espagne/smart-cita-deployment/laserostop_espagna/index.html`
  - Line 1727-1733: PRICE_TABLE
  - Line 1455-1473: Payment popup logic
  - Line 1526-1557: Stripe links configuration

---

## Verification

✅ Frontend prices updated
✅ Payment popup logic updated
✅ Stripe products created
✅ Stripe payment links created
✅ Configuration updated in code

**Ready for deployment!**
