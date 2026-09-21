-- Import checkout payment routing:
-- Paystack is allowed for orders below ₦100,000.
-- Orders at or above ₦100,000 must use manual bank transfer.
-- Keep the admin toggle enabled so the checkout can expose manual transfer
-- when the threshold requires it.

update import_admin_credentials
set
  paystack_enabled = true,
  manual_transfer_enabled = true,
  paystack_manual_threshold_ngn = 100000
where id = 1;
