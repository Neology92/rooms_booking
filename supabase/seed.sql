-- Demo data for local testing. Run after 0001_init.sql.
-- Safe to re-run: clears the demo trip first.
delete from trips where name = 'Demo Trip';

with t as (
  insert into trips (name, target_headcount, signups_locked)
  values ('Demo Trip', 5, false)
  returning id
),
r as (
  insert into rooms (trip_id, name, capacity, info)
  select t.id, v.name, v.capacity, v.info
  from t, (values
    ('Room A', 3, 'Ground floor, code 1234'),
    ('Room B', 2, 'First floor, sea view')
  ) as v(name, capacity, info)
  returning id, name
)
insert into participants (trip_id, name, email, gender)
select t.id, v.name, v.email, v.gender::gender
from t, (values
  ('Alice', 'alice@example.com', 'female'),
  ('Bob',   'bob@example.com',   'male'),
  ('Carol', 'carol@example.com', 'female'),
  ('Dave',  'dave@example.com',  'male'),
  ('Erin',  'erin@example.com',  'female')
) as v(name, email, gender);

-- Example rules: Alice MUST share a same-gender room; Dave prefers to be with Erin.
insert into rules (participant_id, type, strictness, target_participant_id)
select p.id, 'same_gender', 'must_have', null
from participants p join trips t on t.id = p.trip_id
where t.name = 'Demo Trip' and p.name = 'Alice';

insert into rules (participant_id, type, strictness, target_participant_id)
select p.id, 'preferred_person', 'preference', e.id
from participants p
  join trips t on t.id = p.trip_id
  join participants e on e.trip_id = t.id and e.name = 'Erin'
where t.name = 'Demo Trip' and p.name = 'Dave';
