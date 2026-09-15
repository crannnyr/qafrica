-- Rewrite of the Import Terms & Conditions (legal_documents.type = 'import_terms').
-- Explicitly states QAFRICA operates as a third-party sourcing agent (not
-- the manufacturer), and adds a full Cancellations & Refunds section:
--   - Before an item is billed (priced into a consolidation & shipping
--     bill): full refund for a genuine reason, since no purchase cost has
--     been committed yet.
--   - After billing: a 20% cancellation fee applies for a voluntary
--     cancellation (change of mind), since QAFRICA has already committed
--     to buying the item from the vendor.
--   - Carve-out, required by the Federal Competition and Consumer
--     Protection Act 2018: the 20% fee never applies to genuinely
--     defective, damaged-in-transit, or incorrectly supplied items --
--     those remain entitled to repair/replacement/full refund regardless
--     of billing stage. An absolute forfeiture clause with no such
--     carve-out would be void and unenforceable under the FCCPA (Nigerian
--     courts have already awarded damages against businesses that tried
--     blanket no-refund clauses), so this carve-out is what keeps the
--     rest of the policy enforceable rather than a real gap in it.
-- Also adds: sourcing-agent / vendor quality disclaimer, customs &
-- compliance, IP disclaimer, force majeure, limitation of liability with
-- an explicit non-waiver of statutory rights, and governing law.

update public.legal_documents
set content = $doc$
<section style="margin-bottom:2rem;">
<p>These Import Terms &amp; Conditions ("Import Terms") govern your use of QAFRICA's China-to-Nigeria importation and sourcing service, in addition to our general <a href="/terms-of-service">Terms of Service</a> and <a href="/privacy-policy">Privacy Policy</a>. By creating an import account or placing an import order, you agree to all three.</p>
</section>

<h2>1. What QAFRICA Is — A Third-Party Sourcing Agent</h2>
<section style="margin-bottom:2rem;">
<p>QAFRICA is a <strong>third-party sourcing and importation agent</strong>. We are not a manufacturer. When you place an order through QAFRICA, you are instructing us to purchase the specified product(s), on your behalf, from independent vendors and factories in China that we have vetted for reliability.</p>
<p>Because the goods are manufactured by independent third-party vendors, not by QAFRICA:</p>
<ul>
<li>We do not manufacture, design, or control the production of any item listed on our platform.</li>
<li>We select vendors based on reputation, order history, and buyer feedback, but we cannot guarantee that any individual unit will be defect-free, as no sourcing agent can inspect every unit of every order at the factory level.</li>
<li>Minor variations from the listing (e.g. slight differences in shade, print placement, or packaging between manufacturing batches) are normal in bulk sourcing and are not treated as defects.</li>
</ul>
<p>This does not remove your rights as a consumer under Nigerian law — see Section 7 (Cancellations &amp; Refunds) for what you are entitled to when something is genuinely wrong with an item.</p>
</section>

<h2>2. How Ordering Works</h2>
<section style="margin-bottom:2rem;">
<p>You submit a product link, description, or catalog selection along with your specifications (size, color, quantity, and preferred shipping method). We source and purchase the item from the vendor once your order is confirmed and paid for. You are responsible for the accuracy of the product link, specifications, and delivery information you provide — we source exactly what you specify, so errors in your submission (wrong size, wrong link, wrong variant) are not treated as a QAFRICA error.</p>
</section>

<h2>3. Payment, Consolidation &amp; Billing</h2>
<section style="margin-bottom:2rem;">
<p>QAFRICA combines many customers' orders into a single consolidated freight batch. Once a batch closes, the total consolidation and shipping cost for that batch is divided across participating customers and billed individually — this is how we offer significantly reduced per-item shipping fees compared to shipping alone. A separate clearance fee is billed once your shipment reaches Nigeria and is ready for customs clearance. Both bills are itemized so you can see the cost breakdown per item before paying.</p>
<p>"Billed," for the purposes of Section 7, means the point at which we have priced and invoiced your item as part of a consolidation &amp; shipping bill — the point at which QAFRICA has committed funds to purchase that item from the vendor on your behalf.</p>
</section>

<h2>4. Shipping Methods &amp; Timelines</h2>
<section style="margin-bottom:2rem;">
<p>We offer two shipping methods, each with different cost and speed trade-offs. Estimated timelines begin once your order reaches our consolidation warehouse in China and are <strong>not guaranteed delivery dates</strong> — customs clearance, national holidays, and carrier delays can extend them:</p>
<ul>
<li><strong>Air freight:</strong> approximately 20–30 days</li>
<li><strong>Sea freight:</strong> approximately 60–90 days</li>
</ul>
<p>By placing an order, you accept the expected timeline for your chosen shipping method, and agree that delivery within these estimated windows does not constitute late delivery. Where a single order contains multiple items, each item may be assigned its own shipping method, and items may arrive separately.</p>
</section>

<h2>5. Delivery &amp; Pickup</h2>
<section style="margin-bottom:2rem;">
<p>You may choose to have your order delivered to a home address or collected from a partnered Jumia pickup station. Risk in the goods passes to you once the item is delivered to your address or handed over at your chosen pickup station. It is your responsibility to inspect the item at the point of collection or delivery where reasonably possible, and to report any visible damage or shortfall immediately — see Section 7.</p>
</section>

<h2>6. Customs, Duties &amp; Import Compliance</h2>
<section style="margin-bottom:2rem;">
<p>All shipments are cleared through Nigerian customs as part of our consolidated process, and clearance costs are recovered through the clearance fee described in Section 3. You are responsible for ensuring that anything you order is lawful to import into Nigeria. QAFRICA will not source or ship items that are prohibited, counterfeit, or restricted under Nigerian law or international shipping regulations, and reserves the right to decline, cancel, or seize any order that appears to violate this, with a refund of amounts paid minus any costs already incurred.</p>
</section>

<h2>7. Cancellations &amp; Refunds</h2>
<section style="margin-bottom:2rem;">

<p><strong>7.1 Before your item is billed (not yet priced into a consolidation &amp; shipping bill).</strong> You may cancel your order and are entitled to a full refund of the amount you paid, provided the cancellation is for a genuine reason (for example: you no longer need the item, ordered the wrong item by mistake, or found the price no longer suitable). At this stage QAFRICA has not yet committed funds to purchase the item from the vendor, so no purchase cost has been incurred on your behalf.</p>

<p><strong>7.2 After your item is billed.</strong> Once your item has been priced and included in a consolidation &amp; shipping bill, QAFRICA has already committed to purchasing it from the vendor on your behalf. If you choose to cancel at this stage for a reason of your own (a change of mind, no longer wanting the item, and similar reasons not related to a fault with the item), a <strong>20% cancellation fee</strong> will be deducted from your refund to cover the purchase cost already committed, and the remaining 80% will be refunded to you.</p>

<p><strong>7.3 Defective, damaged-in-transit, or incorrectly supplied items.</strong> The 20% cancellation fee in 7.2 does <strong>not</strong> apply where the item you receive is genuinely faulty, materially different from what was ordered, or damaged as a result of our shipping, consolidation, or handling process. In these cases, and regardless of what billing stage your order is at, you are entitled to a repair, replacement, or full refund, consistent with your rights under the Federal Competition and Consumer Protection Act 2018. To make a claim under this clause, please report the issue with photo or video evidence within 48 hours of delivery or collection — see Section 7.5.</p>

<p><strong>7.4 Damage or malfunction after delivery.</strong> QAFRICA is not responsible for, and will not refund or replace, items that are damaged, altered, or that malfunction after delivery due to misuse, improper handling, unauthorized repair, normal wear and tear, or failure to follow the product's care or usage instructions. This includes damage that occurs after you have accepted delivery and used the product.</p>

<p><strong>7.5 How to request a refund or report a problem.</strong> Contact us with your order code, a description of the issue, and photo or video evidence within 48 hours of delivery or collection. Claims made after this window may still be reviewed, but the closer to delivery you report an issue, the easier it is for us to verify it occurred before the item reached you rather than afterward. Approved refunds are processed to your original payment method or bank details on file within a reasonable time after approval.</p>

<p><strong>7.6 Quality expectations.</strong> As a sourcing agent, QAFRICA is responsible for accurately representing what we source and for the condition of items up to the point of delivery to you. We are not responsible for the vendor's underlying manufacturing standards, brand reputation, or design choices — if you are unsatisfied with a product's design, fit, or general quality where the item matches its description and is not defective, that falls outside this refund policy, though we're always happy to hear feedback.</p>

</section>

<h2>8. Intellectual Property &amp; Product Listings</h2>
<section style="margin-bottom:2rem;">
<p>QAFRICA sources products based on vendor listings and does not independently verify vendor claims regarding trademarks, patents, or brand authenticity. If you believe an item you ordered infringes a third party's intellectual property rights, please contact us so we can investigate and, where appropriate, remove the listing and address your order.</p>
</section>

<h2>9. Limitation of Liability</h2>
<section style="margin-bottom:2rem;">
<p>To the fullest extent permitted by Nigerian law, QAFRICA is not liable for:</p>
<ul>
<li>Delays caused by customs authorities, carriers, force majeure events, national holidays, or incorrect information supplied by you;</li>
<li>Losses arising from your use, misuse, or resale of an item after delivery;</li>
<li>Indirect, incidental, or consequential losses (such as lost business or lost profits) arising from an order;</li>
<li>Manufacturing characteristics, materials, or design choices made by the independent vendor, where the item otherwise matches its description and is not defective.</li>
</ul>
<p>Nothing in these Import Terms excludes or limits any right that cannot lawfully be excluded or limited under the Federal Competition and Consumer Protection Act 2018 or any other applicable law. Where our liability cannot lawfully be excluded, it is limited to the value of the affected item(s) or, at our discretion, a repair or replacement of the affected item(s).</p>
</section>

<h2>10. Force Majeure</h2>
<section style="margin-bottom:2rem;">
<p>QAFRICA is not liable for any failure or delay in performance caused by events beyond our reasonable control, including natural disasters, war, civil unrest, government action, customs or port disruptions, pandemics, carrier failures, or factory shutdowns in China or Nigeria.</p>
</section>

<h2>11. Customer Responsibilities</h2>
<section style="margin-bottom:2rem;">
<ul>
<li>Provide accurate product links, specifications, sizes, and delivery information.</li>
<li>Review and accept your chosen shipping method's estimated timeline before payment.</li>
<li>Provide a valid delivery address or select a pickup station you can reasonably access.</li>
<li>Report any issue with a delivered item within the timeframe set out in Section 7.5.</li>
</ul>
</section>

<h2>12. Changes to These Terms</h2>
<section style="margin-bottom:2rem;">
<p>We may update these Import Terms from time to time to reflect changes in our process or applicable law. Where a change materially affects your rights, we will make reasonable efforts to notify existing import customers. Continued use of the import service after an update constitutes acceptance of the revised terms.</p>
</section>

<h2>13. Governing Law &amp; Dispute Resolution</h2>
<section style="margin-bottom:2rem;">
<p>These Import Terms are governed by the laws of the Federal Republic of Nigeria, including the Federal Competition and Consumer Protection Act 2018. If you have an unresolved complaint, you may also raise it with the Federal Competition and Consumer Protection Commission (FCCPC) at fccpc.gov.ng. We encourage you to contact us directly first so we can try to resolve any issue quickly.</p>
</section>
$doc$,
    updated_at = now()
where type = 'import_terms';
