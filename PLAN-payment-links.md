# Implementation Plan: Post-Booking Payment Links

## Overview

After a user books an appointment through the chatbot, provide them with the correct Stripe payment link (one-time or 3x monthly) based on:
1. **Center** → Determines which Stripe company (Company 1 or Company 2)
2. **Treatment** → Determines which payment link to show

## Company Assignment Logic

| Company | Centers | Agenda IDs |
|---------|---------|------------|
| Company 1 | Chamartín, Torrejón, Majadahonda | 48, 49, 51 |
| Company 2 | Barcelona, Sevilla, Atocha | 43, 44, 50 |

## Payment Links Structure

### Company 1 (Madrid Region)
| Treatment | One-time | 3x Monthly |
|-----------|----------|------------|
| Tabaco | €149 - `https://buy.stripe.com/5kQdR85fNfQG9PvbCJawo0b` | 3×€60 - `https://buy.stripe.com/dRm6oGbEb1ZQ8LreOVawo0f` |
| Duo | €320 - `https://buy.stripe.com/28E9AS0ZxfQGd1H4ahawo01` | 3×€105 - `https://buy.stripe.com/9B64gyeQn7kabXD9uBawo07` |
| Cannabis | €189 - `https://buy.stripe.com/9B6bJ09w3bAq9Pv36dawo0d` | 3×€70 - `https://buy.stripe.com/fZu00i0Zx47Ye5L9uBawo0e` |
| Azucar | €180 - `https://buy.stripe.com/4gM5kCaA7dIyaTz9uBawo09` | 3×€60 - `https://buy.stripe.com/8x214maA7fQG7Hn36dawo0a` |

### Company 2 (Other Regions)
| Treatment | One-time | 3x Monthly |
|-----------|----------|------------|
| Tabaco | €149-190 - `https://buy.stripe.com/4gM8wPbgpcsdfoL5sAdby0j` | 3×€60 - `https://buy.stripe.com/dRm9ATckt4ZLdgDf3adby0n` |
| Duo | €320 - `https://buy.stripe.com/8x2fZh3NX4ZL2BZ6wEdby09` | 3×€105 - `https://buy.stripe.com/7sYcN5dox3VH1xV08gdby0f` |
| Cannabis | €189 - `https://buy.stripe.com/28E28rcktfEpb8vf3adby0l` | 3×€70 - `https://buy.stripe.com/bJe4gz98h2RD0tR3ksdby0m` |
| Azucar | €180 - `https://buy.stripe.com/5kQ14n7090Jv3G39IQdby0h` | 3×€60 - `https://buy.stripe.com/9B6bJ198h3VH0tR8EMdby0i` |

---

## Implementation Steps

### Step 1: Add Stripe Payment Links Data Structure

**File:** `netlify/functions/admin-test-chat.js`

Add a new constant `STRIPE_PAYMENT_LINKS` after the existing `CENTER_DETAILS` constant (~line 280):

```javascript
const STRIPE_PAYMENT_LINKS = {
  company1: {
    centers: ['48', '49', '51'], // Chamartín, Torrejón, Majadahonda
    treatments: {
      tabaco: {
        onetime: { url: 'https://buy.stripe.com/5kQdR85fNfQG9PvbCJawo0b', price: 149 },
        monthly: { url: 'https://buy.stripe.com/dRm6oGbEb1ZQ8LreOVawo0f', price: 60, installments: 3 }
      },
      duo: {
        onetime: { url: 'https://buy.stripe.com/28E9AS0ZxfQGd1H4ahawo01', price: 320 },
        monthly: { url: 'https://buy.stripe.com/9B64gyeQn7kabXD9uBawo07', price: 105, installments: 3 }
      },
      cannabis: {
        onetime: { url: 'https://buy.stripe.com/9B6bJ09w3bAq9Pv36dawo0d', price: 189 },
        monthly: { url: 'https://buy.stripe.com/fZu00i0Zx47Ye5L9uBawo0e', price: 70, installments: 3 }
      },
      azucar: {
        onetime: { url: 'https://buy.stripe.com/4gM5kCaA7dIyaTz9uBawo09', price: 180 },
        monthly: { url: 'https://buy.stripe.com/8x214maA7fQG7Hn36dawo0a', price: 60, installments: 3 }
      }
    }
  },
  company2: {
    centers: ['43', '44', '50'], // Barcelona, Sevilla, Atocha
    treatments: {
      tabaco: {
        onetime: { url: 'https://buy.stripe.com/4gM8wPbgpcsdfoL5sAdby0j', price: 190 },
        monthly: { url: 'https://buy.stripe.com/dRm9ATckt4ZLdgDf3adby0n', price: 60, installments: 3 }
      },
      duo: {
        onetime: { url: 'https://buy.stripe.com/8x2fZh3NX4ZL2BZ6wEdby09', price: 320 },
        monthly: { url: 'https://buy.stripe.com/7sYcN5dox3VH1xV08gdby0f', price: 105, installments: 3 }
      },
      cannabis: {
        onetime: { url: 'https://buy.stripe.com/28E28rcktfEpb8vf3adby0l', price: 189 },
        monthly: { url: 'https://buy.stripe.com/bJe4gz98h2RD0tR3ksdby0m', price: 70, installments: 3 }
      },
      azucar: {
        onetime: { url: 'https://buy.stripe.com/5kQ14n7090Jv3G39IQdby0h', price: 180 },
        monthly: { url: 'https://buy.stripe.com/9B6bJ198h3VH0tR8EMdby0i', price: 60, installments: 3 }
      }
    }
  }
};
```

### Step 2: Add Helper Function to Get Payment Links

Add a helper function after the `STRIPE_PAYMENT_LINKS` constant:

```javascript
/**
 * Get Stripe payment links for a center and treatment
 * @param {string} agendaId - The agenda ID of the center
 * @param {string} treatment - The treatment type (tabaco, duo, cannabis, azucar)
 * @returns {object|null} - Payment links object or null if not found
 */
function getPaymentLinks(agendaId, treatment) {
  const company = STRIPE_PAYMENT_LINKS.company1.centers.includes(agendaId)
    ? STRIPE_PAYMENT_LINKS.company1
    : STRIPE_PAYMENT_LINKS.company2;

  const treatmentLinks = company.treatments[treatment.toLowerCase()];
  if (!treatmentLinks) return null;

  return {
    onetime: treatmentLinks.onetime,
    monthly: treatmentLinks.monthly
  };
}
```

### Step 3: Modify `create_booking` Tool Response

In the `create_booking` case of `executeToolCall` function (~line 722), modify the success response to include payment links:

```javascript
// Get payment links for this booking
const paymentLinks = getPaymentLinks(centerInfo.agendaId, treatment.toLowerCase());

return {
  success: true,
  appointmentId: appointment.id,
  center: centerInfo.name,
  treatment: TREATMENTS[treatment.toLowerCase()]?.name || treatment,
  price: TREATMENTS[treatment.toLowerCase()]?.price || 0,
  date,
  time,
  displayDate: formatSpanishDate(date),
  customerName: full_name,
  paymentLinks: paymentLinks,  // NEW: Include payment links
  message: `Reserva confirmada en ${centerInfo.name} para el ${formatSpanishDate(date)} a las ${time}.`
};
```

### Step 4: Update System Prompt

Add a new section to the `SYSTEM_PROMPT` constant to instruct the chatbot about payment options (~after line 150):

```
## PAGO ONLINE - DESPUÉS DE CONFIRMAR RESERVA

Después de confirmar una reserva exitosa (cuando create_booking devuelve success: true con paymentLinks):

1. Confirma la reserva con el número de reserva
2. Ofrece las opciones de pago:
   - Pago único: Enlace de pago completo
   - Pago en 3 cuotas: Enlace de pago fraccionado (3 meses)
   - Pago en centro: Pueden pagar el día de la cita

Formato de respuesta después de reserva:
"Tu reserva ha sido confirmada. Número de reserva: [ID]

Centro: [centro]
Tratamiento: [tratamiento]
Fecha: [fecha]
Hora: [hora]

💳 Opciones de pago online:
Pago único (€XXX): [enlace onetime]
Pago en 3 cuotas (3×€XX): [enlace monthly]

También puedes pagar en el centro el día de tu cita."

IMPORTANTE: Usa los enlaces EXACTOS que devuelve paymentLinks. NO inventes enlaces.
```

### Step 5: Deploy and Test

1. Deploy to Netlify
2. Test booking flow with different centers:
   - Test with Chamartín (Company 1)
   - Test with Barcelona (Company 2)
3. Verify correct payment links are shown
4. Verify both one-time and monthly options are presented

---

## Expected User Experience

**Before (current):**
```
Tu reserva ha sido confirmada.
Centro: Madrid Chamartín
Tratamiento: Dejar de fumar (individual)
Fecha: Martes, 6 de enero
Hora: 11:00
Número de reserva: 8081

Si tienes alguna pregunta, no dudes en contactarnos. ¡Te esperamos!
```

**After (with payment links):**
```
Tu reserva ha sido confirmada. Número de reserva: 8081

Centro: Madrid Chamartín
Tratamiento: Dejar de fumar (individual)
Fecha: Martes, 6 de enero
Hora: 11:00

💳 Opciones de pago online:
Pago único (€149): https://buy.stripe.com/5kQdR85fNfQG9PvbCJawo0b
Pago en 3 cuotas (3×€60): https://buy.stripe.com/dRm6oGbEb1ZQ8LreOVawo0f

También puedes pagar en el centro el día de tu cita.

¡Te esperamos!
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `netlify/functions/admin-test-chat.js` | Add payment links data, helper function, modify booking response, update system prompt |

## Risk Assessment

- **Low risk**: Changes are additive, don't affect existing booking logic
- **Testing required**: Verify correct company/treatment mapping
- **Rollback**: Easy - just remove the paymentLinks from response

## Approval Required

Please review this plan and confirm:
1. Payment link URLs are correct
2. Company-to-center mapping is accurate
3. Pricing displayed is correct
4. Desired user experience format is acceptable
