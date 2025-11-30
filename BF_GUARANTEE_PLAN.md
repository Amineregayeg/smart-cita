# Black Friday Guarantee Component Plan

## Overview
Add a guarantee/trust component to the Black Friday page that communicates:
1. **1 year guarantee** on the treatment
2. **Free session** in case of returning to addiction (relapse)
3. **Full refund** if the second session doesn't work

## Proposed Location
**After the Pricing Cards section and before the Trust Line** (around line 550-553)

This placement is strategic because:
- Users have just seen the prices and may have hesitation
- The guarantee addresses concerns right before the final CTA
- It's visible without scrolling past the pricing section

## Component Design

### Desktop Layout (md and up)
A horizontal card with 3 columns showing each guarantee benefit:
```
┌─────────────────────────────────────────────────────────────────────┐
│                    GARANTÍA DE SATISFACCIÓN                         │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│   [shield icon]     │   [refresh icon]    │    [money icon]         │
│   1 AÑO DE          │   SESIÓN GRATIS     │    REEMBOLSO            │
│   GARANTÍA          │   EN RECAÍDA        │    GARANTIZADO          │
│                     │                     │                         │
│   Cobertura total   │   Si vuelves a      │    Si la 2ª sesión      │
│   durante 12 meses  │   fumar, te         │    no funciona,         │
│                     │   ayudamos gratis   │    te devolvemos        │
│                     │                     │    el dinero            │
└─────────────────────┴─────────────────────┴─────────────────────────┘
```

### Mobile Layout (sm and below)
Vertical stacked cards with icons on the left:
```
┌─────────────────────────────────────────┐
│      GARANTÍA DE SATISFACCIÓN           │
├─────────────────────────────────────────┤
│ [shield]  1 AÑO DE GARANTÍA             │
│           Cobertura total 12 meses      │
├─────────────────────────────────────────┤
│ [refresh] SESIÓN GRATIS EN RECAÍDA      │
│           Si vuelves, te ayudamos       │
├─────────────────────────────────────────┤
│ [money]   REEMBOLSO GARANTIZADO         │
│           Si 2ª sesión no funciona      │
└─────────────────────────────────────────┘
```

## Styling

### Colors (matching Black Friday theme)
- Background: White with subtle border
- Border: Black (#000) to match BF theme
- Icons: Primary teal (#22A9AF) or Gold (#FFD93D)
- Title: Black with gold accent
- Text: Dark gray (#414141)

### Alternative: Dark theme version
- Background: Black (#000)
- Border: Gold (#FFD93D)
- Icons: Gold (#FFD93D)
- Title: White with gold accent
- Text: Light gray

## HTML Structure

```html
<!-- Guarantee Section -->
<div class="bg-white rounded-2xl p-6 mb-6" style="border: 2px solid #000;">
  <!-- Header -->
  <div class="text-center mb-6">
    <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold" style="background-color: #000; color: #FFD93D;">
      <span class="material-icons text-base">verified_user</span>
      GARANTÍA DE SATISFACCIÓN
    </span>
  </div>

  <!-- Benefits Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

    <!-- Benefit 1: 1 Year Guarantee -->
    <div class="flex md:flex-col items-center md:items-center text-center gap-4 md:gap-2 p-4 rounded-xl bg-gray-50">
      <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style="background-color: rgba(34, 169, 175, 0.15);">
        <span class="material-icons text-2xl" style="color: #22A9AF;">shield</span>
      </div>
      <div class="flex-1 md:flex-none">
        <h4 class="font-bold text-gray-900 text-sm md:text-base">1 AÑO DE GARANTÍA</h4>
        <p class="text-xs md:text-sm text-gray-600">Cobertura total durante 12 meses</p>
      </div>
    </div>

    <!-- Benefit 2: Free Session on Relapse -->
    <div class="flex md:flex-col items-center md:items-center text-center gap-4 md:gap-2 p-4 rounded-xl bg-gray-50">
      <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style="background-color: rgba(34, 169, 175, 0.15);">
        <span class="material-icons text-2xl" style="color: #22A9AF;">autorenew</span>
      </div>
      <div class="flex-1 md:flex-none">
        <h4 class="font-bold text-gray-900 text-sm md:text-base">SESIÓN GRATIS EN RECAÍDA</h4>
        <p class="text-xs md:text-sm text-gray-600">Si vuelves a fumar, te ayudamos gratis</p>
      </div>
    </div>

    <!-- Benefit 3: Money Back Guarantee -->
    <div class="flex md:flex-col items-center md:items-center text-center gap-4 md:gap-2 p-4 rounded-xl bg-gray-50">
      <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style="background-color: rgba(34, 169, 175, 0.15);">
        <span class="material-icons text-2xl" style="color: #22A9AF;">payments</span>
      </div>
      <div class="flex-1 md:flex-none">
        <h4 class="font-bold text-gray-900 text-sm md:text-base">REEMBOLSO GARANTIZADO</h4>
        <p class="text-xs md:text-sm text-gray-600">Si la 2ª sesión no funciona, te devolvemos el dinero</p>
      </div>
    </div>

  </div>
</div>
```

## Responsive Behavior

| Breakpoint | Layout | Icon Position |
|------------|--------|---------------|
| Mobile (<768px) | Horizontal rows | Left side |
| Desktop (≥768px) | 3 columns | Top center |

## Implementation Steps

1. Add the HTML component after the pricing cards `</div>` (line 550)
2. Place it before the Trust Line (line 553)
3. No CSS changes needed - uses Tailwind classes
4. No JavaScript needed - static component

## Alternative Placement Options

1. **Inside pricing section** (current plan) - Best for conversion
2. **Below booking form header** - Good for reassurance during booking
3. **Sticky footer banner** - High visibility but may be intrusive
4. **As a popup on first visit** - Attention-grabbing but may annoy users

## Questions for Approval

1. **Theme preference**: Light (white background) or Dark (black background matching BF theme)?
2. **Icon style**: Teal (#22A9AF) or Gold (#FFD93D)?
3. **Placement**: After pricing cards (recommended) or alternative location?
4. **Copy refinement**: Are the Spanish texts accurate and compelling?

## Waiting for Approval

Ready to implement once placement and styling preferences are confirmed.
