-- Three additional rep FAQ entries (contract sharing, enterprise commitment, referral pricing).
-- ADDITIVE ONLY. Run against prod (Supabase SQL editor). Idempotent — re-running is a no-op.
-- Fixed ids + ON CONFLICT DO NOTHING so this never duplicates rows.

INSERT INTO "Faq" ("id", "question", "answer", "category", "sortOrder") VALUES
  (
    'faq_share_contract',
    'Can I share a copy of the contract / service agreement before the call?',
    'Yes, absolutely — you can send the contract / service agreement ahead of the call if the owner wants to review it first. The current agreement is in the Resources panel on this page: grab the link and share it directly. (If a $320 referral rate applies, use the separate referral contract instead — see the pricing FAQ.)',
    'Onboarding & Setup',
    2
  ),
  (
    'faq_enterprise_commitment',
    'For enterprise accounts, can we negotiate the commitment terms?',
    'Yes — for enterprise accounts the commitment terms are negotiable. You can bring the commitment down to as low as 3 months if the lead is a good fit. Use judgment on fit before offering it.',
    'Pricing & Fees',
    4
  ),
  (
    'faq_referral_pricing',
    'Can I offer a lower service fee or onboarding fee?',
    'Standard pricing is $350/month + a one-time $150 onboarding. For mentorship referrals you may offer a reduced $320/month service fee with the $150 onboarding. Onboarding stays at $150 unless we had already shared the service fees before increasing. Qualifying mentorship referral sources: Seven Summers (Hannan & Janel), STR Like The Best (Liz & Michael Chang), and Jane Ng – The Investment Mom. Note: a separate referral contract applies to any $320 agreement.',
    'Pricing & Fees',
    5
  )
ON CONFLICT ("id") DO NOTHING;
