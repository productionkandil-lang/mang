import { supabase } from '@/db/supabase';

export const logAuditAction = async (userId: string | undefined, action: string, details: any = {}) => {
  if (!userId) return;
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      details
    });
  } catch (err) {
    console.error('Failed to log audit action:', err);
  }
};
