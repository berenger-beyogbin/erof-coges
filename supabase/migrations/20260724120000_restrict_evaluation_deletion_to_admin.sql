-- Deleting an evaluated COGES is an irreversible administrative operation.
-- Keep it restricted to active national administrators, regardless of status.
drop policy if exists evaluations_delete_admin_or_draft_owner on public.evaluations;
drop policy if exists evaluations_delete_admin_only on public.evaluations;
create policy evaluations_delete_admin_only
on public.evaluations for delete
to authenticated
using (public.is_admin());

-- Administrators must be able to remove proof files before deleting an
-- evaluation, including when the evaluation is locked.
drop policy if exists preuves_erof_delete_scoped on storage.objects;
drop policy if exists preuves_erof_delete_admin_or_editable on storage.objects;
create policy preuves_erof_delete_admin_or_editable
on storage.objects for delete
to authenticated
using (
  bucket_id = 'preuves-erof'
  and (
    public.is_admin()
    or public.user_can_edit_evaluation(public.try_uuid((storage.foldername(name))[1]))
  )
);
