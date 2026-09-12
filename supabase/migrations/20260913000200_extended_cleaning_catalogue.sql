begin;

with catalogue(name, description, inclusions, good_to_know, price, duration_minutes) as (
  values
    (
      'End of Tenancy / Move-In Clean',
      'A detailed deep clean to leave a property spotless for moving out or moving in. Landlord and inspection ready.',
      array['Top-to-bottom deep cleaning', 'Kitchen and bathroom detail', 'Move-in and move-out preparation']::text[],
      array['£25.00 per cleaner-hour', 'Tell us about any inspection requirements']::text[],
      50.00::numeric,
      120
    ),
    (
      'Guest Ready',
      'Fast turn around cleaning between guests, tailored for Airbnb and holiday rental hosts.',
      array['Guest-area cleaning', 'Kitchen and bathroom reset', 'Turnaround preparation']::text[],
      array['£22.90 per cleaner-hour', 'Share the next guest check-in time']::text[],
      45.80::numeric,
      120
    ),
    (
      'Linen Care',
      'Ironing and laundry service to keep your linens and clothing fresh, crisp, and ready to use.',
      array['Laundry', 'Ironing', 'Linen and clothing care']::text[],
      array['£16.90 per cleaner-hour', 'Two-hour minimum booking']::text[],
      33.80::numeric,
      120
    ),
    (
      'Window Cleaning',
      'Interior and exterior window cleaning for a streak-free shine, done as a standalone service or added to any clean.',
      array['Interior windows', 'Exterior windows where safely accessible', 'Streak-free finishing']::text[],
      array['£16.90 per cleaner-hour', 'Exterior work depends on safe access and weather']::text[],
      33.80::numeric,
      120
    ),
    (
      'Essential Clean and Linen Care',
      'Our regular standard cleaning includes dusting, floors, kitchen and bathroom, keeping your home fresh week to week and ironing and laundry service to keep your linens and clothing fresh, crisp, and ready to use.',
      array['Dusting', 'Floors', 'Kitchen', 'Bathroom', 'Laundry', 'Ironing']::text[],
      array['£23.90 per cleaner-hour', 'Two-hour minimum booking']::text[],
      47.80::numeric,
      120
    )
)
update public.packages as package
set description = catalogue.description,
    inclusions = catalogue.inclusions,
    good_to_know = catalogue.good_to_know,
    price = catalogue.price,
    duration_minutes = catalogue.duration_minutes,
    service_type = 'cleaning',
    billing_type = 'per_visit',
    active = true
from catalogue
where package.name = catalogue.name
  and (package.billing_type = 'per_visit' or package.billing_type is null);

with catalogue(name, description, inclusions, good_to_know, price, duration_minutes) as (
  values
    ('End of Tenancy / Move-In Clean', 'A detailed deep clean to leave a property spotless for moving out or moving in. Landlord and inspection ready.', array['Top-to-bottom deep cleaning', 'Kitchen and bathroom detail', 'Move-in and move-out preparation']::text[], array['£25.00 per cleaner-hour', 'Tell us about any inspection requirements']::text[], 50.00::numeric, 120),
    ('Guest Ready', 'Fast turn around cleaning between guests, tailored for Airbnb and holiday rental hosts.', array['Guest-area cleaning', 'Kitchen and bathroom reset', 'Turnaround preparation']::text[], array['£22.90 per cleaner-hour', 'Share the next guest check-in time']::text[], 45.80::numeric, 120),
    ('Linen Care', 'Ironing and laundry service to keep your linens and clothing fresh, crisp, and ready to use.', array['Laundry', 'Ironing', 'Linen and clothing care']::text[], array['£16.90 per cleaner-hour', 'Two-hour minimum booking']::text[], 33.80::numeric, 120),
    ('Window Cleaning', 'Interior and exterior window cleaning for a streak-free shine, done as a standalone service or added to any clean.', array['Interior windows', 'Exterior windows where safely accessible', 'Streak-free finishing']::text[], array['£16.90 per cleaner-hour', 'Exterior work depends on safe access and weather']::text[], 33.80::numeric, 120),
    ('Essential Clean and Linen Care', 'Our regular standard cleaning includes dusting, floors, kitchen and bathroom, keeping your home fresh week to week and ironing and laundry service to keep your linens and clothing fresh, crisp, and ready to use.', array['Dusting', 'Floors', 'Kitchen', 'Bathroom', 'Laundry', 'Ironing']::text[], array['£23.90 per cleaner-hour', 'Two-hour minimum booking']::text[], 47.80::numeric, 120)
)
insert into public.packages (name, description, inclusions, good_to_know, price, duration_minutes, service_type, billing_type, active)
select catalogue.name, catalogue.description, catalogue.inclusions, catalogue.good_to_know, catalogue.price, catalogue.duration_minutes, 'cleaning', 'per_visit', true
from catalogue
where not exists (
  select 1
  from public.packages as package
  where package.name = catalogue.name
    and package.billing_type = 'per_visit'
);

do $$
begin
  if (
    select count(distinct name)
    from public.packages
    where billing_type = 'per_visit'
      and active = true
      and name in (
        'End of Tenancy / Move-In Clean',
        'Guest Ready',
        'Linen Care',
        'Window Cleaning',
        'Essential Clean and Linen Care'
      )
  ) <> 5 then
    raise exception 'Extended cleaning catalogue update did not create all five active sessions';
  end if;
end
$$;

commit;
