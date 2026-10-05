-- Migration 40: Add INVENTORIES (1306) to the Chart of Accounts
-- Inventories / Stock / Trading stock are common for multipurpose and
-- trading cooperatives but previously had no account code, so extracted
-- line items for them were left "UNMAPPED" and excluded from KPIs.
-- 1306 is a child of OTHER ASSETS (1300), which is a subtotal.

INSERT INTO chart_of_accounts
    (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (1306, 'INVENTORIES', 'assets', 'OTHER', FALSE, FALSE, 1300, NULL, 146, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- Update the OTHER ASSETS (1300) formula to include inventories.
UPDATE chart_of_accounts
SET formula = '1301+1302+1303-1304+1305+1306'
WHERE account_code = 1300;
