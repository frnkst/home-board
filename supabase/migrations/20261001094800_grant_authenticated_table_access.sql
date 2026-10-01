grant select, insert, update, delete
on all tables in schema public
to authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;
