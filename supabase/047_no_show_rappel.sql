-- « No show » : le passager ne s'est pas presente, le chauffeur cloture la course (status completed, ride_step no_show).
alter table rides drop constraint if exists rides_ride_step_check;
alter table rides add constraint rides_ride_step_check
  check (ride_step in ('not_started', 'en_route', 'on_site', 'on_board', 'dropped', 'completed', 'no_show'));

-- Rappel envoye au chauffeur 1 h avant la course (une seule fois par course).
alter table rides add column if not exists reminder_sent_at timestamptz;
