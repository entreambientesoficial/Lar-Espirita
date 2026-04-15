```markdown
# Design System Specification: Editorial Serenity

This design system is a bespoke framework crafted for a spiritual-themed volunteer management PWA. It moves away from the rigid, utility-first aesthetics of standard administrative tools toward a "High-End Editorial" experience. By prioritizing tonal depth, organic flow, and sophisticated layering, we create an environment that feels less like a database and more like a digital sanctuary.

---

### 1. Creative North Star: "The Ethereal Anchor"
The system is built on the concept of **The Ethereal Anchor**. It balances the weight and trust of a deep spiritual foundation with the light, airy freedom of service. 

To break the "template" look, designers must employ **Intentional Asymmetry**. Hero sections should feature overlapping elements—such as a spiritual symbol (dove) bleeding behind a surface container—to create a sense of three-dimensional space. We avoid the "boxed-in" feeling by using expansive white space and large-scale typography that breathes across the canvas.

---

### 2. Colors & Tonal Depth

The palette is rooted in a meditative depth, utilizing Material Design 3 naming conventions but applied with an editorial lens.

#### The "No-Line" Rule
**Borders are strictly prohibited for sectioning.** To define boundaries, use color shifts. For example, a `surface-container-low` section should sit directly against a `surface` background. The eye should perceive the change in "weight" rather than a hard edge.

#### Surface Hierarchy & Nesting
Think of the UI as layers of fine paper or frosted glass.
- **Background (`#f9f9fb`):** The base canvas.
- **Surface Container Lowest (`#ffffff`):** Used for primary content cards that need to "pop."
- **Surface Container High (`#e8e8ea`):** Used for sidebar navigation or secondary utility panels.

#### The "Glass & Gradient" Rule
To add "soul," use subtle gradients for primary CTAs, transitioning from `primary` (`#003178`) to `primary-container` (`#0d47a1`) at a 135-degree angle. For floating overlays (like mobile navigation bars), apply **Glassmorphism**: use a semi-transparent `surface` color with a `backdrop-filter: blur(20px)`.

---

### 3. Typography: The Voice of Authority and Grace

We use a duo of **Plus Jakarta Sans** for structure and **Manrope** for human-centric legibility.

- **Display & Headlines (Plus Jakarta Sans):** High-contrast sizing. `display-lg` (3.5rem) should be used sparingly to create editorial "moments."
- **Body & Titles (Manrope):** Chosen for its modern, friendly geometric shapes.
- **Minimum Body Size:** Never drop below `1rem` (`body-lg`) for primary content to ensure accessibility and a "premium" feel.

The hierarchy is designed to feel like a high-end magazine; large, bold headlines provide the "spirit," while clean, well-spaced body text provides the "guidance."

---

### 4. Elevation & Depth: Tonal Layering

We convey hierarchy through "Tonal Lift" rather than shadows.

*   **The Layering Principle:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-low` background. This creates a soft, natural distinction.
*   **Ambient Shadows:** If an element must float (e.g., a Modal), use an ultra-diffused shadow: `box-shadow: 0 20px 40px rgba(13, 71, 161, 0.06);`. Note the blue tint in the shadow—never use pure black or grey.
*   **The "Ghost Border":** If a boundary is required for accessibility, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

### 5. Component Guidelines

#### Buttons
- **Primary:** `primary-container` background with `on-primary` text. Use `lg` (2rem) corner radius.
- **Secondary:** Transparent background with a `Ghost Border` and `primary` text.
- **Interaction:** On hover, the button should subtly scale (1.02x) rather than just changing color, mimicking a physical "press."

#### Cards & Lists
- **No Dividers:** Forbid the use of 1px lines. Use 24px–32px of vertical white space to separate list items.
- **Organic Shapes:** Cards should utilize the `lg` (2rem) or `xl` (3rem) rounding scale to feel welcoming and "soft."

#### Input Fields
- Avoid the "box" look. Use a `surface-container-low` background with a bottom-only `outline-variant` (20% opacity). On focus, transition the background to `surface-container-lowest`.

#### Signature Component: The "Symbolic Watermark"
For empty states or dashboard backgrounds, place a large-scale, low-opacity (4%) version of the dove or hand icons. These should be cropped off-canvas to reinforce the "Organic Asymmetry."

---

### 6. Do’s and Don’ts

#### Do
- **Do** embrace "Wasted Space." It isn't wasted; it's room for the user to breathe.
- **Do** use `secondary` (`#006a62`) for success states or "Join" actions to link the color to growth and vitality.
- **Do** use `md` (1.5rem) or `lg` (2rem) rounding for all UI elements to maintain the "Sober & Welcoming" aesthetic.

#### Don’t
- **Don’t** use 1px solid borders. They feel clinical and restrictive.
- **Don’t** use pure black (#000000) for text. Use `on-surface` (#1a1c1d) to keep the contrast high but the "vibe" soft.
- **Don’t** center-align long blocks of text. Stick to editorial left-alignment to maintain the "Modern" feel.
- **Don’t** stack more than three levels of surface containers; it muddies the visual hierarchy.

---

### 7. Spacing Scale
Utilize a strict 8px grid, but encourage "Airy" multipliers:
- **Section Padding:** 64px, 80px, or 120px.
- **Component Gap:** 16px or 24px.
- **Text Leading:** 1.5x for body text to ensure maximum legibility for all age groups.```