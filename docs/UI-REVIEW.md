# Nomad Vault UI review

For the UI/UX designer, 25 Oct 2026. Review only; no code was changed. Sources: `web/src`, the screenshots in `web/screenshots`, the design brief, a design critique and technical audit, a polish pass, and worst-case data rendered into the real pages at 1280, 390 and 320px. Effort: S under an hour, M half a day, L a day or more.

## Top 10 fixes for the live demo

| # | Screen | Problem | Fix | Effort |
|---|---|---|---|---|
| 1 | Vault | The hero number is 10,006.22 XLM, almost all free test funds. Maya's 5.50 payment, the point of the demo, is invisible. | Lead with "Compensation received 5.50". Show total balance as a secondary line: "includes 10,000 free test funds". | S |
| 2 | Dashboard, Payroll | "Review payroll" ignores a partly confirmed run and starts a new run for the same month, paying people twice. History already shows two "October 2026" runs. | Treat partly confirmed runs as open (`ReviewPayrollButton.jsx:5`). Warn or block when the month has confirmed payments. Label repeat runs "Run 2". | S |
| 3 | Payroll execution | The demo stalls at Maya. The daily limit is mostly spent, she is last and largest, so her row ends "Needs approval" just before "switch to Maya". | Reset the limit and order her first before stage. Then design the hold as a feature: "Policy held 1 payment over the operator limit. Co-sign to release", previewed at review, in its own colour. | S, then M |
| 4 | All | Yellow means brand, testnet, prototype, demo, invited, warning, error and invalid input. Cobalt means both "click me" and "confirmed". Nothing stands out, and success badges look like buttons. | Yellow only for "needs your action". Prototype and Demo tags become outlined neutrals. Add the brief's warm accent for confirmed and vault active. | M |
| 5 | Payroll review | Approve sits below the fold at 1280x800 under three yellow panels and never says what it approves. With 40 recipients it is 3,400px down (4,600px on a phone). | Action in the page head or a sticky bottom bar, labelled with the outcome: "Approve 14.70 XLM for 4 people". Same for Execute. | M |
| 6 | Payroll execution | The ending is one small sentence in a pale bar: no total, no next step. | Completion card: "14.70 XLM paid to 4 contractors, 4 confirmed on Stellar", plus "See it in Maya's vault". Show "2 of 4 confirmed" while running. | M |
| 7 | Dashboard | "1,234,567.89 XLM" needs 311px in a 212px stat card. It spills into the next card and scrolls the page sideways at 320px. | Asset code on its own small line under the number; clamp the figure size. Never truncate amounts. | S |
| 8 | Invitation | "Create my vault" is below the fold on desktop and two screens down on a phone. The amount is mid-sentence. The header tells the contractor "Viewing as Company admin". | Summary card on top: company, amount as a figure, the CTA. Questions follow as detail. Hide the role switcher on `/invite`. | M |
| 9 | Payroll rows | Amounts jump sideways as badge text changes. A held row still says "Policy checked", with a "!" mark. | Fixed amount and badge columns. Rename the held step "Over daily limit". | S |
| 10 | Vault | Withdraw is the primary button but entirely prototype. Hold opens a modal that only explains. "Demo key is not stored in this browser" reads like an error on stage. | "Prototype" on the Send and Withdraw buttons. Hold becomes a status line, not a modal. Reword or hide the key line. | S |

## By screen

**Dashboard.** The run list uses the raw status "Partly confirmed" where every other screen says "Needs approval" (`Dashboard.jsx:79`). "Next payroll" ignores a run already in progress. 28px section titles outweigh the 32px money figures. The Private payments card ("Registered: maya", "testnet storage fees") reads like an internal log. Six identical "View on Stellar" links give screen readers no context.

**Contractors.** Pause is a quiet text button and Resume an outlined one, so one control looks like two. Pause has no confirmation. The vault column shows address fragments (GCXG...SJR3), which the brief keeps out of primary UI. On phones each contractor is a 270px card; drop Frequency there.

**Add contractor.** Errors fill fields with the warning yellow. Step changes do not announce "Step 2 of 3" or move focus. The success view keeps the title "Add contractor"; use "Invitation ready".

**Payroll review.** "Before" is the live balance, so it drifts during execution (136.50, 131.50, 127.30) while "After" stays put. Snapshot it at approval and set the pair as large as the total. The over-limit message appears three times. The brief's privacy row is missing: "Privacy: prototype, this run settles publicly on testnet".

**Payroll execution.** The per-row stepper is the strongest screen. Step changes have no motion, and the active step shows "..." at the bottom of the circle. Queued rows show three empty circles each; one "Queued" line is enough. A finished row says "Confirmed" three times (badge, step, link); make the link "View on Stellar".

**History and errors.** Same-month runs are indistinguishable. A missing run repeats "not found" twice and offers only "Try again"; offer "Back to payroll".

**Invitation.** The company name appears four times above the fold.

**Vault.** "Keep in stablecoin" is marked "Coming through partners" though Hold already does it. The disabled Withdraw button at 50% opacity (2.2:1) looks broken. The Send placeholder "G..." exposes the address format.

**Landing.** Two of the brief's nine sections and no visual. The orbital treasury-to-vault metaphor is the missing product signature.

**Accessibility (WCAG 2.1 AA).** All text contrast passes (lowest: muted label on yellow 4.8:1). Fails: cobalt focus ring on the dark header 2.6:1, input borders 2.1:1, empty stepper circles 1.3:1 (all need 3:1). Every route has the same page title, "Nomad Vault" (2.4.2). The role select navigates on change (3.2.2). `aria-label="becomes"` on a plain span is ignored (`PayrollRun.jsx:97`). The no-vault page has no heading. Small buttons (Pause, New invitation link, Approve as admin, Close) are 36px tall and nav links 40px, under the 44px touch size. Skip link, landmarks and modal focus all work. DM Sans as loaded has no tabular figures: "1111.11" measures 32.8px and "8888.88" 61.5px, so amount columns never align and live numbers jitter. Use a face that has them for amounts.

## CSS-level polish

| Before | After | Why |
| --- | --- | --- |
| `.btn`: no transition, no `:active` | `transition: background-color 150ms ease, transform 160ms ease-out`; `:active { transform: scale(0.97) }` | Presses need instant feedback |
| `.btn-primary:hover { background: var(--ink) }` | Darker cobalt (`#2443C4`) inside `@media (hover: hover)` | Charcoal reads as another button; hover sticks after a tap |
| `.btn:disabled { opacity: 0.5 }` | `background: var(--soft); color: var(--ink-muted)` | Washed cobalt looks broken, not off |
| `.modal` appears instantly | `@starting-style { opacity: 0; transform: scale(0.96) }`, 200ms `cubic-bezier(0.23,1,0.32,1)`, backdrop fade | Modals should arrive, not pop |
| `.step-dot` snaps; active shows `…` | 200ms colour transition; active is a CSS ring spinner, static under reduced motion | The brief wants motion that explains state; this is the place |
| `.meter-fill { width: N% }` | `transform: scaleX(N)`, `transform-origin: left`, 400ms ease-out | Spend changes become visible, on the compositor |
| `.payment-main: 1fr auto auto` | `minmax(0,1fr) 10rem 9.5rem`, amount right-aligned | Amounts stop jumping |
| `.figure` amount with unit inline, `nowrap` | Unit in `.figure-unit` on its own line; `font-size: clamp(24px, 2.6vw, 32px)` | Seven figures fit the card |
| `.figure-pair` at 16px | After-balance as `.figure`, before as muted "from 136.50" | The key approval number was the smallest |
| `.input[aria-invalid]`: 2px border, yellow fill | `box-shadow: 0 0 0 1px var(--ink)`, white fill, icon | No layout shift; yellow stays for attention |
| `.option--selected { border: 2px }` | `box-shadow: inset 0 0 0 1px var(--accent)` | Selecting no longer nudges content |
| `:focus-visible` cobalt in header | `.header :focus-visible { outline-color: var(--highlight) }` | 2.6:1 becomes 12.1:1 |
| Input border `rgba(37,37,37,0.35)` | `rgba(37,37,37,0.55)` | 2.1:1 becomes about 3.6:1 |
| `.shell`, `.modal` use `100vh` | `100dvh` | Phone toolbars stop clipping the modal |
| `.h1`, `.lead`, `.small` wrap by default | `.h1, .h2 { text-wrap: balance }`, `p { text-wrap: pretty }` | Fixes the one-word last lines on the landing hero and at 390px |

## Worst-case data findings

Data used: "Aleksandra Wisniewska-Kowalczyk" with a 70-character email, a five-word Spanish name, "Jo", Chinese and Arabic names, amounts up to 1,349,571.32, and 0, 1, 6 and 40 contractors.

| # | Severity | Where | Value | What happens | Fix |
|---|---|---|---|---|---|
| 1 | Broken | Stat cards (dashboard, vault, run) | 1,234,567.89 | Overflows into the next card; sideways scroll at 320px | Unit on its own line, clamp size |
| 2 | Broken | Every amount (`money()` in `format.js`) | 0.0000001 | Shows "0.00 XLM": the server keeps 7 decimals, the client rounds to 2 via `Number()` | Format from the decimal string |
| 3 | Broken | Vault greeting (`Vault.jsx:44`) | "Dr. Ngo Bao Chau" | "Hi Dr." | Stored first name, or the full name |
| 4 | Ugly | Contractors table, 1280px | long name, email, country | Table runs 30px past the page edge; dates wrap | `table-layout: fixed`, `overflow-wrap: anywhere` on email |
| 5 | Ugly | Next payroll (`Dashboard.jsx:41`) | 1 contractor | "1 contractors" | Plural rule |
| 6 | Ugly | Dashboard, empty | 0 contractors | "0.00 XLM, Funded" and copy pointing to a CTA that fails | Point to "Add contractor" |
| 7 | Ugly | Recent payments | unknown recipient | Name shows as "GDUX...WKVR" | "Unknown recipient" |
| 8 | Ugly | Payroll run | 40 recipients | Run page is 5,700px tall (10,000px on a phone) | Sticky actions; collapse queued rows |
| 9 | Fragile | Add contractor | name, email | No client limits; server takes names of 2 to 80 characters, any email, and silently cuts location at 60 | Matching `maxLength` |
| 10 | Fragile | Role switcher | long names | Cut to "Dr. Ngo Bao Ch" | First name only |

What held up: Chinese and Arabic names render correctly, initials cope with one-word and two-letter names, long names wrap in rows without pushing amounts away, long emails break at hyphens, and no dataset caused sideways scroll at 390px.
