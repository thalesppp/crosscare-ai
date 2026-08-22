-- Remove audit history only when the obsolete row still matches the original
-- demo seed. This avoids touching a real Shopify record that might reuse an ID.
DELETE FROM `audit_events`
WHERE `case_id` = 'SHOP-7291684585704'
	AND EXISTS (
		SELECT 1
		FROM `support_cases`
		WHERE `id` = 'SHOP-7291684585704'
			AND `source` = 'demo'
			AND `customer_name` = 'Shopify 测试客户'
			AND `order_number` = '#1001'
	);
--> statement-breakpoint
DELETE FROM `support_cases`
WHERE `id` = 'SHOP-7291684585704'
	AND `source` = 'demo'
	AND `customer_name` = 'Shopify 测试客户'
	AND `order_number` = '#1001';
