-- Store the complete professional application privately for admin review.
-- Existing applications remain valid; new submissions are validated by the API.

begin;

alter table public.provider_onboarding_details
  add column if not exists salutation text
    check (salutation is null or salutation in ('miss', 'mrs', 'mr')),
  add column if not exists date_of_birth date,
  add column if not exists right_to_work boolean,
  add column if not exists current_self_employment_status text
    check (
      current_self_employment_status is null
      or current_self_employment_status in ('yes', 'no', 'other')
    ),
  add column if not exists current_self_employment_detail text,
  add column if not exists business_name text,
  add column if not exists cleaning_experience_years smallint
    check (
      cleaning_experience_years is null
      or cleaning_experience_years between 0 and 60
    ),
  add column if not exists cleaning_experience_types text[],
  add column if not exists other_cleaning_experience text,
  add column if not exists max_travel_distance text
    check (
      max_travel_distance is null
      or max_travel_distance in (
        'Up to 2 miles',
        'Up to 5 miles',
        'Up to 10 miles',
        'Up to 15 miles',
        '20+ miles',
        'Depends on the job/location'
      )
    ),
  add column if not exists weekly_availability jsonb;

alter table public.provider_onboarding_details
  drop constraint if exists provider_onboarding_cleaning_experience_types_valid,
  add constraint provider_onboarding_cleaning_experience_types_valid check (
    cleaning_experience_types is null
    or (
      cardinality(cleaning_experience_types) > 0
      and cleaning_experience_types <@ array[
        'Domestic cleaning',
        'Commercial cleaning',
        'Industrial cleaning',
        'Office cleaning',
        'End of tenancy / move-in cleaning',
        'Other'
      ]::text[]
    )
  ),
  drop constraint if exists provider_onboarding_weekly_availability_valid,
  add constraint provider_onboarding_weekly_availability_valid check (
    weekly_availability is null
    or (
      jsonb_typeof(weekly_availability) = 'object'
      and weekly_availability ?& array[
        'monday', 'tuesday', 'wednesday', 'thursday',
        'friday', 'saturday', 'sunday'
      ]
      and weekly_availability->>'monday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
      and weekly_availability->>'tuesday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
      and weekly_availability->>'wednesday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
      and weekly_availability->>'thursday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
      and weekly_availability->>'friday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
      and weekly_availability->>'saturday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
      and weekly_availability->>'sunday' in ('unavailable', 'all_day', 'morning', 'afternoon', 'evening')
    )
  );

comment on column public.provider_onboarding_details.right_to_work is
  'Applicant answer to whether they currently have the right to work in the UK.';
comment on column public.provider_onboarding_details.weekly_availability is
  'Private day-by-day application availability. Public matching hours are stored separately in provider_availability.';
comment on column public.provider_onboarding_details.cleaning_experience_types is
  'Private cleaning experience declared during the professional application.';

commit;
