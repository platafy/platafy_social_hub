-- Migration to add anon permissions and select policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_automation_logs TO anon;

CREATE POLICY "Logs tenant select anon_v2" ON public.zernio_automation_logs
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Logs tenant insert anon_v2" ON public.zernio_automation_logs
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Logs tenant update anon_v2" ON public.zernio_automation_logs
    FOR UPDATE TO anon
    USING (true);
