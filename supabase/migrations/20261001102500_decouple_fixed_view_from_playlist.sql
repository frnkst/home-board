alter table public.display_state
  add column forced_kind public.playlist_kind,
  add column forced_reference_id uuid;

update public.display_state as state
set
  forced_kind = entry.kind,
  forced_reference_id = entry.reference_id
from public.playlist_entries as entry
where state.forced_entry_id = entry.id;

