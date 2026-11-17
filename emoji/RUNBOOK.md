# THE REFRIGERATOR EMOJI INITIATIVE
## Campaign operations runbook — Charlie / fridge.run

**Owner and public credit:** Charlie. **Public home:** https://fridge.run/emoji/  
**Hosting:** GitHub Pages, repository `LuckyMonkey/node-home`, `main` branch, root publishing directory.  
**Campaign status:** Preparatory / soft launch, 17 November 2026. The Change.org petition has **not** been created; do not present a signature count or functioning sign button until then.  
**Objective:** Build a credible, cheerful, high-visibility campaign to propose a **generic, unbranded refrigerator emoji** for Unicode. The campaign must survive even if the proposal fails.
**Working budget:** $0–$100 initial out-of-pocket, prioritizing existing equipment, free distribution, and permission-based placements.

### Non-negotiables

1. **Charlie gets attribution.** Use “An initiative by Charlie,” “Organized by Charlie,” and the same author name on the eventual Unicode submission. Fridge.run is the website, not the inventor or legal person. Do not claim Charlie first conceived a refrigerator emoji: earlier petitions exist.
2. **A standards proposal is not a popularity contest.** Unicode explicitly does not accept petition counts, hashtags, or public requests as usage evidence. Treat Change.org as a community and media tool. Prepare empirical usage evidence separately.
3. **No company is a sponsor without permission.** Brand lists are outreach prospects, not partners. Never add their logos to the page until an authorized representative provides written permission.
4. **No spam, vandalism, or unauthorized stickers.** Label grocery bags only with the store's permission. Do not place QR labels over barcodes, ingredients, prices, food-safety warnings, or manufacturer labeling. Never interfere with food-contact surfaces.
5. **No dependencies on the Fridge node.** The campaign must still work if the personal Mac mini, Caddy, Tailscale, tunnels, identity provider, or any Fridge app is offline.
6. **No invented results.** Do not claim official Unicode support, a trademark license, a named corporate endorser, a petition count, a press mention, a live tracking system, or an expected adoption year unless proven.
7. **Unbranded emoji artwork.** The site’s illustration is a promotional poster. The official proposal candidate must be a separate, simple, visually distinct refrigerator icon, licensed appropriately. A fridge picture branded LG/Samsung/etc. could be rejected.

### Systems map

```
Audience / sticker / social media
        |
        v
https://fridge.run/emoji/ [GitHub Pages; static files]
        |                         |
        | Sign (only when live)   | Share campaign
        v                         v
Change.org campaign          Native share or copy link
        |
        | Public support and campaign awareness
        v
Charlie (campaign organizer) ---> Unicode evidence + PDF proposal (separate workflow)
```

Campaign code lives in `node-home/emoji/`. This path is independent from the homepage. Deployment is **commit to `main` root**. Do not use `docs/` as the Pages root and do not create a contradictory Pages Actions workflow; the repository README documents why. The campaign site has no cookie banner, email collection, database, API, or personal analytics by default.

---

## PHASE 0 — Establish the campaign record (Day 0)

**Goal:** A verifiable chronology and clean identity.

- [ ] Write a brief launch statement identifying Charlie as organizer and `fridge.run/emoji` as campaign headquarters.
- [ ] Put the launch date in a public changelog or README; Git commits provide additional timestamps.
- [ ] Keep the headline focused on the missing **object emoji**; do not present this as a political or corporate campaign.
- [ ] Read current Unicode proposal guidance: https://www.unicode.org/emoji/proposals.html
- [ ] Read proposal statuses and previous requests: https://unicode.org/emoji/emoji-proposals-status.html and https://emojipedia.org/requests
- [ ] Confirm whether a refrigerator emoji is already pending, under consideration, recently rejected, or approved immediately before submission. A recently declined proposal may have a waiting period.
- [ ] Record any previous efforts honestly in the campaign history; the earlier 80-signature petition was closed.
- [ ] Open one GitHub issue for each operational track: web, petition, artwork, stickers, corporate outreach, research, proposal, media.

**Completion gate:** Site displays real organizer credit, real campaign status, no fabricated endorsements.

## PHASE 1 — The landing page, artwork, and CTA (Days 0–3)

**Goal:** A person scanning a label understands the ask in under five seconds.

**The hero:** A giant recognizable two-door refrigerator, dramatic poster typography, excellent contrast, and one sentence of humor. Core words:
- **WHERE'S OUR FRIDGE EMOJI?**
- **IT'S FREE. IT'S COOL. TAKES A SECOND.**
- **SIGN THE PETITION** — only after it exists.

**Information hierarchy:** (1) what is missing, (2) immediate action, (3) short explanation, (4) Charlie's attribution, (5) standards disclaimer. The entire above-the-fold experience works on small phones.

**Accessibility / engineering:** semantic headings, keyboard-operable controls, descriptive alt text, 44px-ish tap targets, focus styles, reduced-motion support, no autoplay audio, no sign-in, no third-party trackers. The fridge image must stay visible even if JS fails; the signature CTA is progressively activated after the petition is configured.

**Technical tasks:**
- [x] Site directory `emoji/` on GitHub Pages.
- [x] Static `index.html`, `style.css`, `campaign.js`.
- [x] Original campaign illustration `emoji/assets/fridge.svg`.
- [x] Share button and copy-link fallback.
- [x] Disabled pending petition state.
- [x] Native Zebra ZPL 3×2 QR label source.
- [ ] Create a photographically clear 1:1 or 1.91:1 social share raster, under ~500 KB, and set `og:image`. Many social crawlers do not render SVG reliably.
- [ ] Manually test 320px, 375px, 768px, and desktop widths; desktop Firefox and iOS Safari.
- [ ] Check real public status 200, secure HTTPS, and no unexpected redirect for `/emoji/`.
- [ ] Check link previews using actual Facebook/LinkedIn share inspectors once an OG raster exists.

**Completion gate:** The main CTA matches campaign state and no page functionality depends on the Fridge server.

## PHASE 1A — Experimental fridge emoji implementation (working now; distinct from Unicode approval)

**Purpose:** Show, rather than merely tell, what a refrigerator emoji would do.

- [x] Original single-glyph custom TrueType font with **U+E900** mapping, packaged as an embedded compressed WOFF2 webfont with independent original outlines.
- [x] Full-color refrigerator SVG usable in browsers and exported as a 256×256 PNG for opt-in chat custom emojis.
- [x] **`:fridge:` / `:refrigerator:`** shortcode support with small browser DOM shim and MutationObserver for dynamically inserted text.
- [x] Live prototype in `/emoji/` with copy-shortcode, copy-PUA and image export controls.
- [x] Experimental OS font installer for Linux/fontconfig, checksum verified; no root permissions.
- [x] Optional, non-default userscript template for explicitly permitted sites.
- [x] A developer guide at `/emoji/IMPLEMENTATION.md`, including HTML and OS examples.
- [ ] Test across multiple browsers and systems; investigate strict site Content Security Policies.
- [ ] Create a versioned package/website demo matrix if other projects adopt the shortcode.

**Crucial portability distinction:** Private use U+E900 is **not** a standard emoji; copying it into other applications may produce an empty box or an unrelated symbol. The portable human-readable value is `:fridge:`; the rendering shim is opt in. Native emoji picker and vendor emoji fonts cannot be universally overwritten through this static website.

**Campaign message:** “We made a fridge emoji work ourselves, so you can see the gap.” Never claim it is the world's first custom fridge symbol or that Unicode has accepted it.

---


## PHASE 2 — Publish the new Change.org petition (Days 1–5)

**Goal:** One legitimate petition URL that can be safely printed on physical labels **indirectly through fridge.run**.

Suggested title: **“Add a refrigerator emoji to Unicode!”**

Suggested petition framing:
- We have a fax machine and an ice cube emoji, but no refrigerator.
- A refrigerator is a globally recognizable object associated with food, storage, kitchens, and refrigeration.
- We are asking for community support and encouraging an independent proposal to the Unicode Consortium.
- Petition signatures do **not** determine Unicode approval.
- This initiative is organized by Charlie at fridge.run; it is not affiliated with Unicode.

**Operational tasks:**
- [ ] Publish with Charlie identified as organizer. Use a public-facing profile only as comfortable.
- [ ] Choose appropriate petition addressee (Unicode Consortium, with language making clear only a technical proposal is evaluated); avoid implying Apple alone can add a Unicode emoji.
- [ ] Create a clean, memorable URL if supported; save the final canonical HTTPS link.
- [ ] Edit **one** constant in `emoji/campaign.js`: `PETITION_URL = "https://www.change.org/...";`.
- [ ] Check both SIGN buttons now appear and open the live petition.
- [ ] Click from a clean browser without account cookies; ensure readable, reachable URL.
- [ ] Keep the frontend `fridge.run/emoji/` permanent even if Change.org moves or closes the petition.
- [ ] Publish launch update and record baseline signature count with a date.

**Completion gate:** Only after a working petition CTA is visible do we begin physical QR distribution.

## PHASE 3 — Low-cost grassroots pilot (Week 1)

**Goal:** Validate the message and QR usability before printing hundreds of labels.

**Use what exists:** Zebra printer, 3×2 thermal labels, phone camera, existing contacts, local independent grocery stores, cafes, appliance service shops.

**Pilot protocol:**
1. Print **10–25 labels** from `emoji/assets/label-3x2.zpl` on an actually compatible 3×2 stock and printer. Zebra models/firmware differ; test the ZPL QR command locally before a run.
2. Scan every first/last label using two phones if possible, and check the page loads under normal cellular conditions.
3. Ask store owners or managers for explicit permission before labeling any grocery bag or counter. Offer a **removable display near checkout** as the less intrusive first option.
4. Do **not** attach stickers to people’s purchases without permission from the business or purchaser. Never obscure product information, safety warnings, or staff labels.
5. Use a one-sentence pitch: “We're trying to get a refrigerator emoji. It's free, it's cool, takes a second.”
6. Observe what happens without pestering anyone: does the visitor understand? Can they find the button? Does the scan work? Does the poster raise a smile?
7. Record **distribution and opt-in feedback**, not any shopper identities.

**Pilot KPI targets (hypotheses, not claims):**
- At least 90% of scanned samples open the right site.
- At least 2 businesses agree to display a poster or allow opt-in labels.
- At least one person outside the core circle can explain the campaign after a five-second glance.

**Kill condition:** If labels don't scan at realistic distances or people cannot tell what they're being asked to do, stop printing and revise.

## PHASE 4 — QR distribution system (Weeks 2–4)

**Goal:** Make print materials reliable, attractive, trackable in aggregate, and cheap.

**Canonical URL:** `https://fridge.run/emoji/`.  
**Distribution-specific URLs:** optional `?src=bag`, `?src=counter`, `?src=repairshop`, `?src=linkedin`.

**Important:** Query parameters currently are **just labels in the URL**. They are not analytics. Do not claim that individual scans, petition conversions, or visitor locations are being measured. If analytics are added later, prefer a privacy-respecting aggregate-only service, document it, and test whether it is compatible with static Pages and privacy expectations. Do not silently track people by placing unique per-person IDs on grocery bags.

**Material menu:**
- 3×2 thermal sticker: 1 CTA, 1 QR, tiny plain-text URL. Black on white with ample quiet-zone clearance.
- 4×6 shelf talker: hero art + headline + QR.
- 8.5×11 counter poster: more explanation and Charlie attribution.
- LinkedIn landscape image: uncluttered large typography and source URL.
- Small card for appliance repair businesses: practical fridge-repair angle.

**Print QC:** Print, scan from 30–60 cm, verify link, verify contrast, ensure the quiet zone, check both portrait/landscape material, avoid placing a QR near fold lines. Use permanent URL `/emoji/` rather than Change.org directly.

## PHASE 5 — Social and LinkedIn campaign (Weeks 1–8)

**Goal:** Make the missing-fridge emoji an easy, funny, repeatable thing people want to share.

**Audience:** home-appliance technicians, retail employees, smart-home engineers, grocery teams, graphic designers, Unicode enthusiasts, consumer tech reporters.

**Cadence:** Start with **2–3 genuinely different posts weekly**, not daily spam. Rotate:
- The visual contradiction (“fax machine yes, refrigerator no”).
- Illustration reveal / tiny 18px concept test.
- Store pilot photo (only with consent).
- “Where would you use a fridge emoji?” responses.
- Honest milestone updates, with dates and sources.
- Technical proposal updates demonstrating seriousness.

**Outreach hygiene:** No scraping emails, mass mentions, impersonation, fake endorsements, purchased signatures, bots, hashtag flooding, or deceptive “official Unicode” graphics. Ask permission before reusing photographs or quotes. Keep a contact ledger with date, organization, channel, reply, permission status, and next follow-up.

**Simple weekly dashboard:** public petition signatures (source/date), verified organic reposts, opt-in display sites, manufacturer responses, press links, technical proposal completion. Keep vanity metrics separate from actual progress.

## PHASE 6 — The appliance-industry coalition (Weeks 2–12)

**Goal:** Win authentic public support from companies without giving away creative control.

**Prospects:** Frigidaire, Amana, GE Appliances, LG, Samsung; plus independent appliance repair firms, grocers, kitchen designers, cold-chain associations, open smart-home projects. Validate the specific legal entities and marketing contacts before outreach.

**Pitch structure (short, non-salesy):**
- Subject: *Why does your refrigerator not have an emoji?*
- The absurd fact: smartphone keyboards have a fax machine emoji but no fridge.
- The relevance: connected appliances, grocery UX, food storage, kitchens, and digital culture.
- The ask: Would your social/media team share a public campaign advocating a generic refrigerator emoji?
- No sponsorship money required; no exclusivity; no requested product endorsement; no use of logos until written permission.
- Organizer and link: Charlie — fridge.run/emoji.

**Three participation tiers:**
- **Signal boost:** one repost or share.
- **Written endorsement:** a factual quote and permission to cite it.
- **Public collaboration:** a co-post, guest blog, or employee-contributed use case, subject to editorial and permission review.

**Cautions:** The Unicode proposal must not read as “a refrigerator icon for these smart apps.” Unicode automatically excludes pure UI icon requests and branded designs. The product-use pitch is useful to recruit manufacturers; the encoding case concerns a *general communicative object* with high likely usage.

**Hard rule:** No company appears on a “supporters” wall until its authorization is documented. A social media like is not official corporate support.

## PHASE 7 — Earned press / amplification (Weeks 4–16)

**Goal:** Give newsrooms an accurate, visual story without manufactured outrage.

**Media kit at `/emoji/` should eventually contain:**
- Campaign organizer bio: Charlie (fact-checked and voluntarily shared).
- 1 high-quality poster; 1 simple logo-free fridge art; print materials.
- One-paragraph purpose and clear Unicode-vs-petition distinction.
- Recent real signature count with “as of” date and public source.
- Quotes from willing participating businesses (only after consent).
- A simple chronological timeline, a reproducible research methodology, and contact method if Charlie chooses to publish one.

**News angle examples:** “Why is there a fax machine emoji but no refrigerator?” / “One developer organizes an appliance-industry push for a fridge emoji.”

**Avoid:** guaranteed approval dates, claims of Unicode backing, inflated counts, false press coverage, defamatory comparisons, or presenting a petition as a standards vote.

## PHASE 8 — Technical proposal: eligibility and evidence (Start immediately; submit in 2027 window if eligible)

**Goal:** Independently build the dossier that Unicode actually evaluates.

**Preflight:**
- [ ] Review status pages and prior rejections, specifically the previous four years, near the submission date.
- [ ] Confirm refrigerator is not encoded/pending under an equivalent name.
- [ ] Read the *latest* proposal guidelines; as of Nov 2026 the page says submissions reopen in 2027.
- [ ] Read the emoji proposal agreement, especially licensing and ownership. If commissioning art, secure appropriate written rights from the actual illustrator.

**Proposed identification:** Emoji name “refrigerator”; category may be “Objects / household” (verify official ordering before submission). Keywords might be “fridge”, “freezer”, “kitchen”, “food storage”, “appliance”, “cold”. Do not pretend the proposal category/name has been approved.

**Evidence research log — empirical, not grassroots:**
- [ ] Google Search: reproducible search query and screenshot.
- [ ] Google Video Search: same.
- [ ] Google Trends web search: include **elephant** comparison.
- [ ] Google Trends image search: include **elephant** comparison.
- [ ] Google Books Ngram Viewer: dated screenshot.
- [ ] Note dates, locations/search language, query strings, date ranges, ambiguities, and methodology.
- [ ] Use incognito/private browsing where feasible to minimize personalization.
- [ ] Compare refrigerator/fridge usage to benchmark terms and examine non-English equivalents, but don't cherry-pick misleading comparisons.
- [ ] Keep all raw screenshots and the research log. Separate web evidence from posts generated by the campaign.

**Argument map:**
- Multiple uses: food storage, kitchens, leftovers, cold preservation, electricity, home, grocery logistics, smart appliances.
- Emoji combinations: refrigerator + food, calendar, house, thermometer, electricity.
- Distinctiveness: a single generic object with recognizable freezer-over-fridge silhouette.
- Not already representable: ice cube expresses “cold” but not a storage appliance.
- Risks: the emoji field is saturated; a refrigerator may be considered mundane or too similar to an existing appliance icon, or lack enough demonstrated conversational demand.
- **What not to claim:** That connected-app usage alone qualifies under Unicode's “compatibility” criterion. That factor has specific requirements and often should be marked N/A.

## PHASE 9 — Emoji artwork and official submission (2027)

**Goal:** Submit a compliant and persuasive PDF under Charlie's authorship.

**Artwork requirements as published Nov 2026:**
- Color versions **18×18 px** and **72×72 px**.
- **Black-and-white** versions at both sizes (not grayscale).
- No text, brand logo, trademark, mascot, or specific manufacturer's model.
- Maximize silhouette clarity at 18 pixels. Design at 18px, then draw larger.
- Do not rely on the decorative campaign poster as the emoji candidate.
- Clarify ownership and open-license eligibility; the submitter must be able to give required grants. Unicode expressly says vendors implement their own artwork.

**Proposal document:**
- Title: “Proposal for Emoji: Refrigerator”.
- Submitter: Charlie (consistent preferred public credit and contact).
- Date, keywords, category; four required images at the top of first page.
- Inclusion factors, evidence and screenshots.
- Exclusion factors honestly addressed.
- License declaration with full rights chain.
- Export readable, accessible PDF, check that hosted PDF is publicly accessible.
- Submit only through the **official Unicode Emoji Submission Form** when open. Do not email or send hard copies.
- Record the submission date, exact PDF version, source archive, and submission acknowledgment.

**Decision handling:** Log statuses “submitted,” “returned for revision,” “under consideration,” “approved,” or “declined” only when actually confirmed. If rejected, publish a clear, respectful explanation and retain public assets. Avoid pressure campaigns targeting individual committee members.

## PHASE 10 — Operations and measurement (ongoing)

**Weekly ritual, maximum 30 minutes to review:**
1. Read petition count and date.
2. Update outreach ledger: next person, reply, or no response.
3. Record actual opt-in locations and remaining print stock.
4. Check website and petition links from a mobile device.
5. Choose *one* specific action for next week; no eternal planning loop.

**Milestones (targets, not outcome predictions):**

| Milestone | Proposed target | What it unlocks |
|---|---:|---|
| Soft launch | Site live | Shareable, attributable home |
| Beat old record | 81+ signatures | Humorous milestone post |
| Local proof | 2+ opt-in display locations | Grassroots photos |
| Local press | 500 signatures | First earned-media pitch |
| Industry validation | 1 authorized corporate repost | Legitimate partner case study |
| Regional momentum | 1,000 signatures | Wider publication outreach |
| Public stretch goal | 10,000 signatures | Big cultural story, **not** Unicode approval |
| Standards milestone | Complete compliant PDF | Technical submission |

**Budget rules:** No buying followers or signatures. Avoid paid ads until organic sticker and social tests work. Use existing Zebra printer and supplies, and donated display space. Do not spend campaign cash on domains, apps, custom CMS systems, or automation that the static site already handles.

## PHASE 11 — Failure modes and contingency

| Risk | Response |
|---|---|
| Change.org petition changes or closes | Update the one `PETITION_URL`; original physical QR continues to point to `fridge.run/emoji/`. |
| Fridge server goes offline | No impact: site is on GitHub Pages. |
| Pages deployment blocked | Check `node-home` Settings → Pages: legacy `main` root. Do not “fix” via `docs/` without intentionally changing deploy mode. |
| Zebra labels won't scan | Check ZPL language/firmware, media calibration, printer resolution, QR quiet zone, label damage. Stop printing until fixed. |
| Store requests removal | Remove immediately and thank them. |
| Partner requests payment or exclusivity | Decline by default. This is an independent cross-industry effort. |
| Unicode proposal judged insufficient | Publish reasons, keep campaign transparent, respect any reapplication restrictions. |
| Social attention spikes | Website remains static; keep only a share link and petition button, no unaudited backend. |
| Harassment / misuse of organizer's name | Avoid publishing private phone/address; limit public contact to an intentional channel. |
| Perceived corporate capture | Publicly disclose financial sponsors if any; retain independent editorial control. |
| Signature count stalls | Test new artwork and channels rather than manufacturing engagement. |

## PHASE 12 — Success and credit preservation

If Unicode approves a generic refrigerator emoji:
- Link to Unicode's official announcement/record and the publicly archived proposal.
- Credit **Charlie** only for the work actually performed: organizer, author, coordinating outreach. Prior petitions and independent supporters deserve honest credit too.
- Do not claim ownership of the encoded character. Unicode standardizes the character; platform vendors control their implementations.
- Retain the campaign page as a dated archive with screenshots and source links.
- Publish a small “how we did it” post documenting what worked, what failed, how much was spent, and which companies chose to help.
- Include a dry, victorious final slogan: **WE GOT THE FRIDGE.**

---

## Copy / artwork assets

**Public message:** “Sign the petition! Let's get a refrigerator emoji :D It's free. It's cool. Takes a second. Thank you!”

**Short social hook:** “There is a fax machine emoji. There is no refrigerator emoji. We're changing that. fridge.run/emoji”

**Industry hook:** “You can control a smart refrigerator from a phone that doesn't have a refrigerator emoji.”

**Attribution:** “An initiative by Charlie. Hosted at fridge.run.”

**Design philosophy:** Playful campaign art is allowed to be bold; the actual Unicode sample must be generic, functional, and readable at 18 pixels. The site's refrigerator illustration is *not* an official Unicode emoji proposal image.

## Source-of-truth links

- Unicode proposal guidelines: https://www.unicode.org/emoji/proposals.html
- Unicode proposal status: https://unicode.org/emoji/emoji-proposals-status.html
- Unicode emoji proposal agreement: https://www.unicode.org/emoji/emoji-proposal-agreement.pdf
- Unicode Emoji Requests: https://emojipedia.org/requests
- GitHub Pages branch publishing: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Live public home (once deploy succeeds): https://fridge.run/emoji/
- Source: https://github.com/LuckyMonkey/node-home/tree/main/emoji

**Next domino:** Create the new Change.org petition, insert its URL in `emoji/campaign.js`, verify the sign button on a phone, **then** print and distribute a ten-label pilot with permission.
