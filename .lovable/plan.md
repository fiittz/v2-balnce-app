
# Plan: Reduce Yellow Color Usage Across the App

## Overview
The Balnce brand uses yellow (`--primary: 47 92% 48%`) as its primary color, which is currently applied extensively across the UI through interactive elements, progress bars, navigation highlights, and form controls. This creates a visually overwhelming experience with too much yellow.

## Current Yellow Usage Analysis

The yellow color (`bg-primary`, `text-primary`) is currently used in:

1. **Navigation** - Active nav items have yellow backgrounds
2. **Buttons** - Primary buttons are fully yellow
3. **Progress bars** - Yellow fill on all progress indicators
4. **Form controls** - Checkboxes, switches, and radio buttons use yellow when active/checked
5. **Notification badges** - Small yellow dots
6. **Card accents** - Yellow top bars on some cards
7. **Step indicators** - Yellow numbered circles in wizards
8. **Selected states** - Yellow backgrounds for selected rows/items

## Proposed Changes

### Strategy: Keep yellow for key CTAs and brand moments, switch secondary interactive elements to black/neutral

---

### 1. Update CSS Variables (index.css)

**Current:**
```css
--primary: 47 92% 48%;      /* Yellow */
--accent: 47 92% 48%;       /* Yellow */
```

**Proposed:**
- Keep `--primary` as yellow for primary CTAs
- Change `--accent` to black for secondary interactions
- Add a new `--interactive` variable for form controls (black)

---

### 2. Navigation (TopNavbar.tsx)

**Current:** Active nav items have yellow backgrounds
**Proposed:** Change to black backgrounds with white text for active state

This creates a cleaner, more professional look and reserves yellow for important actions.

---

### 3. Form Controls

**Checkbox (checkbox.tsx):**
- Change checked state from yellow to black (`bg-foreground` instead of `bg-primary`)
- Border stays black

**Switch (switch.tsx):**
- Change checked state from yellow to black

**Radio Group (radio-group.tsx):**
- Change border and fill from yellow to black

---

### 4. Progress Bar (progress.tsx)

**Current:** Yellow indicator
**Proposed:** Change to black indicator (`bg-foreground` instead of `bg-primary`)

---

### 5. Buttons Strategy

Keep the primary yellow button for main CTAs (like "AI Categorize", "Finalise VAT Return"), but many secondary actions can use outline or ghost variants.

---

### 6. Card Accents (BankFeed.tsx)

**Current:** Yellow top bar on bank card (`bg-primary`)
**Proposed:** Change to black top bar (`bg-foreground`)

---

### 7. Step Indicators (BusinessBankExportQuestionnaire.tsx, etc.)

**Current:** Yellow circles with black text
**Proposed:** Black circles with white text

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | Update `--accent` variable to black |
| `src/components/ui/checkbox.tsx` | Change checked state to black |
| `src/components/ui/switch.tsx` | Change checked state to black |
| `src/components/ui/radio-group.tsx` | Change border/fill to black |
| `src/components/ui/progress.tsx` | Change indicator to black |
| `src/components/layout/TopNavbar.tsx` | Change active nav state to black |
| `src/pages/BankFeed.tsx` | Change card accent bar to black |
| `src/components/export/BusinessBankExportQuestionnaire.tsx` | Change step numbers to black |
| `src/components/export/DirectorExportQuestionnaire.tsx` | Change step numbers to black (if applicable) |

---

## Visual Impact Summary

| Element | Before | After |
|---------|--------|-------|
| Navigation active | Yellow bg | Black bg |
| Checkboxes | Yellow when checked | Black when checked |
| Switches | Yellow when on | Black when on |
| Radio buttons | Yellow border/fill | Black border/fill |
| Progress bars | Yellow | Black |
| Card accents | Yellow bar | Black bar |
| Primary buttons | Yellow | Yellow (keep!) |

---

## Technical Notes

- Using `bg-foreground` and `text-background` leverages the existing CSS variable system
- This approach maintains dark mode compatibility
- Primary CTAs remain yellow to preserve brand identity for key actions
- The changes reduce yellow by ~60-70% while keeping it impactful where it matters

