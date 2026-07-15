-- Allow admin users to update locked evaluation rows.
-- The regular editable policy intentionally blocks locked evaluations for
-- child-table writes and field edits. This policy only opens the parent
-- evaluations row to admins so they can move a locked record back to revision.

drop policy if exists evaluations_update_admin_locked on public.evaluations;
create policy evaluations_update_admin_locked
on public.evaluations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
