# Changes Plan for laserostop_es, laserostop_espagna, laserostop_azucar

## Summary of Changes Needed

For **cigarette pages** (es, espagna): Change old price from 250€ to 190€
For **sugar page** (azucar): Change old price from 280€ to 190€ (if requested, otherwise keep 280€)

Form prices should show **online prices** instead of center prices.

---

## Page 1: laserostop_es (Enhanced Cigarette Page)

### Current State:
- Solo online: 149€, center: 190€, old: 250€
- Duo online: 269€, center: 340€, old: 500€
- Plan: 3×60€

### PRICE_TABLE (line 1926-1927):
```javascript
solo_cig: { centerOld: 250, center: 190, onlineOld: 250, online: 149, plan: [60, 60, 60] }
```

### Changes Needed:

| # | Location | Line | Current | New |
|---|----------|------|---------|-----|
| 1 | Card 1 old price | 521 | 250€ | 190€ |
| 2 | Card 1 ahorra | 526 | 101€ | 41€ (190-149=41) |
| 3 | Card 3 old price | 555 | 250€ | 190€ |
| 4 | Card 3 ahorra | 560 | 70€ | 10€ (190-180=10) |
| 5 | Form "hasta" price | 761 | 250€ | 190€ |
| 6 | Popup online old | 818 | €250 | €190 |
| 7 | Popup online ahorra | 819 | 101 | 41 |
| 8 | Popup center old | 854 | €250 | €190 |
| 9 | Popup center ahorra | 855 | 60 | 0 (190-190=0) |
| 10 | Popup plan ahorra | 894 | 70 | 10 |
| 11 | PRICE_TABLE centerOld | 1927 | 250 | 190 |
| 12 | PRICE_TABLE onlineOld | 1927 | 250 | 190 |
| 13 | Form solo_cig price (×8) | 1866+ | 190 | 149 |
| 14 | Form duo_cig price (×8) | 1867+ | 170 | 269 |
| 15 | Form solo_sugar price (×8) | 1870+ | 200 | 180 |

---

## Page 2: laserostop_espagna (Original Cigarette Page)

### Current State:
- Solo online: 149€, center: 190€, old: 250€
- Plan: 3×60€

### PRICE_TABLE (line 1979-1980):
```javascript
solo_cig: { centerOld: 250, center: 190, onlineOld: 250, online: 149, plan: [60, 60, 60] }
```

### Changes Needed:

| # | Location | Line | Current | New |
|---|----------|------|---------|-----|
| 1 | Form "hasta" price | 591 | 250€ | 190€ |
| 2 | Popup online old | 648 | €250 | €190 |
| 3 | Popup online ahorra | 649 | 101 | 41 |
| 4 | Popup center old | 684 | €250 | €190 |
| 5 | Popup center ahorra | 685 | 60 | 0 |
| 6 | Popup plan ahorra | 719 | 70 | 10 |
| 7 | PRICE_TABLE centerOld | 1980 | 250 | 190 |
| 8 | PRICE_TABLE onlineOld | 1980 | 250 | 190 |
| 9 | Form solo_cig price (×8) | 1919+ | 190 | 149 |
| 10 | Form duo_cig price (×8) | 1920+ | 170 | 269 |
| 11 | Form solo_sugar price (×8) | 1923+ | 200 | 180 |

---

## Page 3: laserostop_azucar (Sugar Addiction Page)

### Current State:
- Sugar online: 180€, center: 200€, old: 280€
- Plan: 3×60€

### PRICE_TABLE (line 1803-1808):
```javascript
solo_sugar: { centerOld: 280, center: 200, onlineOld: 280, online: 180, plan: [60, 60, 60] }
```

### Changes Needed (if changing old from 280€ to 190€):

| # | Location | Line | Current | New |
|---|----------|------|---------|-----|
| 1 | Form "hasta" price | 650 | 280€ | 190€ |
| 2 | Popup online old | 707 | €280 | €190 |
| 3 | Popup online ahorra | 708 | 100 | 10 (190-180=10) |
| 4 | Popup center old | 743 | €280 | €190 |
| 5 | Popup center ahorra | 744 | 80 | -10 (190-200=-10, NEGATIVE!) |
| 6 | Popup plan ahorra | 778 | 100 | 10 |
| 7 | PRICE_TABLE centerOld | 1808 | 280 | 190 |
| 8 | PRICE_TABLE onlineOld | 1808 | 280 | 190 |
| 9 | Form solo_sugar price (×8) | 1747+ | 200 | 180 |

**⚠️ WARNING for Sugar Page:**
If old price becomes 190€ but center price is 200€, the "ahorra" for center would be NEGATIVE (-10€). This means customers would pay MORE than the "old" price when paying at center.

Options:
1. Keep sugar old price at 280€ (no change)
2. Change center price to match (190€ or lower)
3. Hide center payment option for sugar

---

## Form Appointment Prices - All 3 Pages

Currently showing **CENTER prices**. Should show **ONLINE prices**:

| Type | Current (Center) | New (Online) |
|------|------------------|--------------|
| solo_cig | 190€ | 149€ |
| duo_cig | 170€ | 269€ |
| solo_drugs | 250€ | keep 250€ |
| solo_sugar | 200€ | 180€ |

---

## Ahorra Calculations Summary

### For laserostop_es and laserostop_espagna (if old=190€):
- Online ahorra: 190 - 149 = **41€**
- Center ahorra: 190 - 190 = **0€** (no savings!)
- Plan ahorra: 190 - 180 = **10€**

### For laserostop_azucar (if old=190€):
- Online ahorra: 190 - 180 = **10€**
- Center ahorra: 190 - 200 = **-10€** (PROBLEM!)
- Plan ahorra: 190 - 180 = **10€**

---

## Questions Before Implementation:

1. **Sugar page old price**: Should it change from 280€ to 190€? This creates negative savings for center payment.

2. **Center payment ahorra = 0€**: For cigarette pages, if old=190 and center=190, ahorra becomes 0€. Is this acceptable or should we hide it?

3. **Duo form price**: Should show online price 269€? (Currently shows 170€ which seems like a discounted center price)

---

## Awaiting Approval
