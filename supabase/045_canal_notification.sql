-- Canal de notification Android de chaque appareil (l'app chauffeur y enregistre « courses_v2 » une fois son canal cree).
-- Le serveur n'envoie un canal precis qu'aux appareils qui le possedent : un canal inconnu ferait disparaitre la notification.
alter table profiles add column if not exists push_channel text;
grant update (vehicle_category, online_status, phone, last_lat, last_lng, push_token, push_channel) on profiles to authenticated;
-- App chauffeur actuellement installee chez le proprietaire : elle a l'ancien canal « courses ».
update profiles set push_channel = 'courses' where id = '148f5a2a-9182-471a-a024-6ccbefff7878';
