create policy "admins view submitted enrollments"
on public.enrollments
for select
to authenticated
using (
  is_draft = false
  and public.has_role(auth.uid(), 'admin')
);
