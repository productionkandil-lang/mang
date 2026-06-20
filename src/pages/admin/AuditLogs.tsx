import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchLogs();
    }
  }, [profile]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:user_id (full_name, department)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const translateAction = (action: string) => {
    const actions: Record<string, string> = {
      'CREATE_PROJECT': 'إنشاء مشروع',
      'UPDATE_PROJECT': 'تعديل مشروع',
      'DELETE_PROJECT': 'حذف مشروع',
      'APPROVE_EDIT': 'موافقة على التعديل',
      'REJECT_EDIT': 'رفض التعديل',
      'FINISH_DEPARTMENT': 'إنهاء مهام القسم',
      'QUALITY_ACCEPT': 'قبول الجودة',
      'QUALITY_REJECT': 'رفض الجودة',
      'QUALITY_FIX': 'طلب إصلاح من الجودة',
      'INVENTORY_ADD': 'إضافة للمخزن',
      'INVENTORY_ISSUE': 'صرف من المخزن',
      'CREATE_PURCHASE_REQUEST': 'طلب شراء جديد',
      'LOGIN': 'تسجيل الدخول',
    };
    return actions[action] || action;
  };

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">سجل النشاطات (Audit Log)</h2>
        <p className="text-muted-foreground">مراقبة جميع التحركات والتعديلات داخل النظام.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أحدث النشاطات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">جاري التحميل...</div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 font-medium text-muted-foreground">المستخدم</th>
                    <th className="p-3 font-medium text-muted-foreground">القسم</th>
                    <th className="p-3 font-medium text-muted-foreground">النشاط</th>
                    <th className="p-3 font-medium text-muted-foreground">التفاصيل</th>
                    <th className="p-3 font-medium text-muted-foreground">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{log.user?.full_name || 'غير معروف'}</td>
                      <td className="p-3">
                        <Badge variant="outline">{log.user?.department || '-'}</Badge>
                      </td>
                      <td className="p-3 font-semibold text-primary">{translateAction(log.action)}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[250px] truncate">
                        {JSON.stringify(log.details)}
                      </td>
                      <td className="p-3" dir="ltr">
                        {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: ar })}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">لا توجد نشاطات مسجلة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}