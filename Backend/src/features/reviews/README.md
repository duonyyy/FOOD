# reviews

Owner: food/shipper review, moderation và anti-duplicate rule.

Reviews owns the `Review` repository and HTTP API. It validates completed purchaser orders through
the Ordering eligibility reader and validates food targets through the Catalog reader; it does not
inject Order, Food, Shipper or User repositories.
