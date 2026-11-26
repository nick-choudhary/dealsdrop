# How deals are verified

Every deal in DealsDrop is confirmed on the vendor's own official page, and the `url` field links straight to that page.

- A deal is listed only if the vendor's own site states the Black Friday / Cyber Monday offer: the discount, price or code, and the end date when one is given. The vendor's own pricing page, sale page, blog, newsroom or terms page all count.
- `verified_on` records the day it was last checked. Entries older than 14 days are flagged for re-checking.
- Discounts, prices and end dates are recorded only when the vendor states them. Otherwise they are `null`; nothing is guessed.
- Descriptions are written in our own words, factual and short.
- No affiliate or tracking links anywhere. Tracking parameters are rejected by CI.
- Dead links are caught by the weekly link check, and deals past their `end_date` are flagged by the daily expiry job.
