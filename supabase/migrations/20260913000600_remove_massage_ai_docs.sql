-- Remove stale chatbot knowledge for the retired massage offering.
-- The deployed seed route now rebuilds these documents with cleaning-only copy.

begin;

delete from public.ai_docs
 where lower(coalesce(title, '')) ~ '(massage|therapist|wellness)'
    or lower(coalesce(content, '')) ~ '(massage|therapist|wellness)';

commit;
