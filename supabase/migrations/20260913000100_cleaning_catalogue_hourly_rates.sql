begin;

with catalogue(name, description, inclusions, good_to_know, price, duration_minutes) as (
  values
    (
      'Essential Clean',
      'Our regular standard cleaning includes dusting, floors, bedroom, kitchen and bathroom, keeping your home fresh week to week.',
      array['Dusting', 'Floors', 'Bedroom', 'Kitchen', 'Bathroom']::text[],
      array['£18.90 per cleaner-hour', 'Two-hour minimum booking']::text[],
      37.80::numeric,
      120
    ),
    (
      'One-Time Essential Clean',
      'A single standard clean with no ongoing commitment, perfect for a one-off refresh.',
      array['Dusting', 'Floors', 'Bedroom', 'Kitchen', 'Bathroom']::text[],
      array['£22.90 per cleaner-hour', 'Two-hour minimum booking']::text[],
      45.80::numeric,
      120
    ),
    (
      'Express Clean',
      'Need it today? Our same-day standard clean fits your schedule when time is tight.',
      array['Dusting', 'Floors', 'Bedroom', 'Kitchen', 'Bathroom']::text[],
      array['£22.90 per cleaner-hour', 'Same-day availability varies', 'Two-hour minimum booking']::text[],
      45.80::numeric,
      120
    ),
    (
      'Signature Deep Clean',
      'A thorough, top-to-bottom clean reaching the spots regular cleaning misses, ideal for a seasonal reset or before hosting.',
      array['Top-to-bottom cleaning', 'Detailed kitchen and bathroom cleaning', 'Hard-to-reach areas']::text[],
      array['£24.90 per cleaner-hour', 'Three hours recommended', 'Two-hour minimum booking']::text[],
      74.70::numeric,
      180
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
    ('Essential Clean', 'Our regular standard cleaning includes dusting, floors, bedroom, kitchen and bathroom, keeping your home fresh week to week.', array['Dusting', 'Floors', 'Bedroom', 'Kitchen', 'Bathroom']::text[], array['£18.90 per cleaner-hour', 'Two-hour minimum booking']::text[], 37.80::numeric, 120),
    ('One-Time Essential Clean', 'A single standard clean with no ongoing commitment, perfect for a one-off refresh.', array['Dusting', 'Floors', 'Bedroom', 'Kitchen', 'Bathroom']::text[], array['£22.90 per cleaner-hour', 'Two-hour minimum booking']::text[], 45.80::numeric, 120),
    ('Express Clean', 'Need it today? Our same-day standard clean fits your schedule when time is tight.', array['Dusting', 'Floors', 'Bedroom', 'Kitchen', 'Bathroom']::text[], array['£22.90 per cleaner-hour', 'Same-day availability varies', 'Two-hour minimum booking']::text[], 45.80::numeric, 120),
    ('Signature Deep Clean', 'A thorough, top-to-bottom clean reaching the spots regular cleaning misses, ideal for a seasonal reset or before hosting.', array['Top-to-bottom cleaning', 'Detailed kitchen and bathroom cleaning', 'Hard-to-reach areas']::text[], array['£24.90 per cleaner-hour', 'Three hours recommended', 'Two-hour minimum booking']::text[], 74.70::numeric, 180)
)
insert into public.packages (
  name,
  description,
  inclusions,
  good_to_know,
  price,
  duration_minutes,
  service_type,
  billing_type,
  active
)
select
  catalogue.name,
  catalogue.description,
  catalogue.inclusions,
  catalogue.good_to_know,
  catalogue.price,
  catalogue.duration_minutes,
  'cleaning',
  'per_visit',
  true
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
        'Essential Clean',
        'One-Time Essential Clean',
        'Express Clean',
        'Signature Deep Clean'
      )
  ) <> 4 then
    raise exception 'Cleaning catalogue update did not create all four active sessions';
  end if;
end
$$;

commit;
