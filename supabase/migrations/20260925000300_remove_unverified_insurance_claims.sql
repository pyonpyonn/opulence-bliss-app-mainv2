-- Remove public insurance promises until a documented policy and active cover
-- have been approved for publication.

begin;

delete from public.faqs
where lower(trim(question)) = 'are your services insured?';

update public.ai_docs
set content =
  'Opulence Bliss is a premium pay-per-visit home-cleaning marketplace in London. A cleaner must complete the application, DBS review and administrator approval before receiving new work. Customers choose a cleaning session, frequency preference, duration, date and time, then pay securely for that visit.'
where title = 'What Opulence Bliss is';

commit;
