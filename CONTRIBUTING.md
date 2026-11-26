# Contributing

Thanks for helping. This list is useful only because every entry is real, current and free of promotion, so the rules are strict and CI enforces most of them. **PRs that fail CI or skip the PR checklist are closed without review.**

## The short version

1. Fork, then add your deal to the right file in `data/deals/<category>.yaml`. Keep entries sorted by `name`.
2. Run `npm ci && npm test` (validator + README build check + validator self-tests).
3. Run `npm run build` to regenerate `README.md` and `generated/`, and commit those too.
4. Open a PR and fill in the checklist, including the exact text from the vendor's page that shows the deal.

**Never edit `README.md` by hand.** It is generated from the YAML data and CI rejects manual edits.

## What gets accepted

- A **real Black Friday / Cyber Monday 2026 offer**: a time-limited discount, bundle, credit or free period. Everyday pricing, permanent free tiers and "contact sales" offers are not deals.
- **Publicly available.** No invite-only, email-gated, private, personal or one-time codes.
- **Confirmed on the vendor's own official page.** If the offer isn't stated on the vendor's site, it isn't listed.
- **One vendor per PR**, at most **3 deals per vendor** across the whole list (a few big multi-category retailers get a higher cap, see below), and at most 3 new deals per PR.

## What gets rejected (automatically where possible)

| Rule | Enforced by |
|---|---|
| Affiliate, referral or partner links; `utm_*`, `ref`, `via`, `aff`, `fpr`, `gclid`, `tag` and similar parameters; link shorteners (bit.ly, amzn.to, fkrt.it, …) | `validate.mjs` |
| `url` not on the vendor's own domain (`vendor_domain`, or an approved alias in `config/domain-allowlist.json`) | `validate.mjs` |
| Hype words ("insane", "massive", "must-have", "lowest price ever", "#1" … see `config/rules.json`), emoji, `!`, ALL-CAPS words | `validate.mjs` |
| Descriptions over 160 characters, names over 70 | JSON Schema |
| Duplicates (same id, same vendor + name, or same url + coupon) | `validate.mjs` |
| More than 3 deals for one vendor (or above its listed exception) | `validate.mjs` |
| `affiliate: true` (we never list affiliate links) | JSON Schema |
| Deal price ≥ regular price, end date before start date, `verified_on` in the future | `validate.mjs` |
| Editing files outside `data/deals/`, touching several vendors, `added_by` not matching your GitHub handle | `pr-guard.mjs` (PRs only) |
| Dead links (404/410/DNS failure) | `check-links.mjs` on changed files + weekly scan |

## Self-promotion and disclosure

You **may** add your own product's deal, but only if you say so:

```yaml
  added_by: your-github-handle
  disclosure:
    affiliated: true
    relationship: Co-founder of Acme
```

Affiliated entries get the `affiliated` label and extra maintainer scrutiny. If your handle contains the vendor's name and you don't disclose, CI fails. Undisclosed promotion found later is removed and the account may be blocked.

## Field guide

```yaml
- id: acme-notes-black-friday        # lowercase-slug, unique
  name: Acme Notes                   # product name, 2–70 chars, no hype
  vendor: Acme Inc.
  vendor_domain: acme.com            # registrable domain of the official site
  category: productivity             # see schema/deal.schema.json for the enum
  deal_description: 40% off the first year of Pro for new customers.   # 10–160 chars, factual
  discount:
    type: percent                    # percent | amount | fixed_price | free_time | credits | bundle | gift_card | other
    value: 40                        # number, or null if the vendor doesn't state it
    up_to: false                     # true for "up to X%"
  currency: USD                      # required if you give prices (USD, INR, EUR, GBP, CAD, AUD)
  regular_price: 100                 # optional
  deal_price: 60                     # optional, must be lower than regular_price
  coupon_code: BF2026                # optional; omit if auto-applied
  url: https://acme.com/pricing      # official page, no tracking params
  start_date: '2026-11-20'           # optional
  end_date: '2026-12-01'             # null if not stated — never guess
  verified_on: '2026-11-26'          # the day you checked it
  added_by: your-github-handle
  affiliate: false                   # always false
  disclosure:
    affiliated: false
  status: active                     # the expiry bot flips this to expired after end_date
```

## Reporting expired or wrong deals

Open an **Expired or wrong deal** issue, or send a PR setting `status: expired`. A daily workflow also marks deals whose `end_date` has passed and opens a PR.

## Commands

| Command | What it does |
|---|---|
| `npm run validate` | Schema + anti-spam + duplicate checks |
| `npm run build` | Regenerates `README.md`, `generated/deals.json`, `generated/deals.csv` |
| `npm run build:check` | Fails if the README is out of date or hand-edited |
| `npm run check-links` | Checks every deal `url` |
| `npm run expire` | Marks deals past their `end_date` as expired |
| `npm test` | validate + build:check + validator self-tests |

By contributing you agree your data contribution is released under CC0-1.0 (see `LICENSE-DATA`) and code under MIT.

## Big-retailer exception to the 3-per-vendor cap

Retailers such as Amazon, Flipkart or Best Buy run one Black Friday event that covers thousands of unrelated products, so three entries can't represent them fairly. `config/rules.json` → `vendor_cap_exceptions` lists those domains with a higher cap (currently 5–8). Everyone else stays at `max_deals_per_vendor` (3).

- The exception is keyed on `vendor_domain` and only maintainers (CODEOWNERS) can change it.
- Each extra entry still has to be a distinct, verifiable offer (a specific product, bank offer or category sale) with its own official `url`. Near-duplicates are closed.
- Contributors still add at most 3 new deals per PR.

