import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function OrderEditRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, [profile]);

  const fetchRequests = async () => {
    if (!profile) return;
    
    try {
      // Fetch edit requests and their approvals
      // If admin, fetch all. Otherwise, fetch requests where the department has an approval record.
      let query = supabase
        .from('order_edit_requests')
        .select(`
          *,
          project:project_id (name, client_name, brand, status, delivery_date, priority, notes, product_details),
          requester:requested_by (full_name),
          approvals:order_edit_approvals (*)
        `)
        .order('created_at', { ascending: false });

      if (profile.role !== 'admin' && profile.department !== 'production_manager') {
        // We will filter in memory for simplicity since it's a join
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (profile.role !== 'admin' && profile.department !== 'production_manager') {
        filteredData = filteredData.filter(req => 
          req.approvals.some((a: any) => a.department === profile.department) || 
          req.requested_by === profile.id
        );
      }

      setRequests(filteredData);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب طلبات التعديل');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approvalId: string, status: string, requestId: string) => {
    let rejectReason = '';
    if (status === 'مرفوض') {
      const reason = prompt('يرجى توضيح سبب الرفض:');
      if (!reason) {
        toast.error('يجب إدخال سبب الرفض');
        return;
      }
      rejectReason = reason;
    }

    try {
      const { error } = await supabase
        .from('order_edit_approvals')
        .update({ status, rejection_reason: rejectReason })
        .eq('id', approvalId);
        
      if (error) throw error;
      
      toast.success('تم تحديث حالة الموافقة');
      
      // Check if all approvals are now 'موافق'
      const req = requests.find(r => r.id === requestId);
      if (req) {
        // optimistically update the approvals array to check
        const updatedApprovals = req.approvals.map((a: any) => a.id === approvalId ? { ...a, status } : a);
        const allApproved = updatedApprovals.every((a: any) => a.status === 'موافق');
        const anyRejected = updatedApprovals.some((a: any) => a.status === 'مرفوض');
        
        if (allApproved) {
          // Process the update
          await finalizeEditRequest(requestId, req.project_id, req.new_data);
        } else if (anyRejected && req.status !== 'مرفوض') {
          await supabase.from('order_edit_requests').update({ status: 'مرفوض' }).eq('id', requestId);
        }
      }
      
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء التحديث');
    }
  };

  const finalizeEditRequest = async (requestId: string, projectId: string, newData: any) => {
    try {
      // 1. Mark request as approved
      await supabase.from('order_edit_requests').update({ status: 'مقبول' }).eq('id', requestId);

      // 2. Update project
      await supabase.from('projects').update({
        client_name: newData.client_name,
        delivery_date: newData.delivery_date,
        brand: newData.brand,
        priority: newData.priority,
        notes: newData.notes,
        product_details: newData.product_details
      }).eq('id', projectId);

      // 3. Update financials
      await supabase.from('project_financials').update({
        price: newData.totalCost,
        payment_terms: `مقدم: ${newData.depositAmount}`
      }).eq('project_id', projectId);

      toast.success('تم تطبيق التعديلات على الأوردر بنجاح');
    } catch (error) {
      console.error('Error finalizing edit:', error);
      toast.error('حدث خطأ أثناء تطبيق التعديلات');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">طلبات تعديل الأوردرات</h2>
        <p className="text-muted-foreground">مراجعة واعتماد طلبات التعديل الواردة من قسم المبيعات.</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">لا توجد طلبات تعديل حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">تعديل: {req.project?.name}</CardTitle>
                    <CardDescription>
                      بواسطة: {req.requester?.full_name} | {format(new Date(req.created_at), 'dd MMM yyyy', { locale: ar })}
                    </CardDescription>
                  </div>
                  <Badge variant={req.status === 'قيد المراجعة' ? 'outline' : req.status === 'مقبول' ? 'default' : 'destructive'}>
                    {req.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">حالة الموافقات المطلوبة:</h4>
                  <div className="flex flex-wrap gap-2">
                    {req.approvals?.map((app: any) => (
                      <div key={app.id} className="flex flex-col gap-1 p-2 border rounded-md text-sm bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span>{app.department === 'admin' ? 'الإدارة العليا' : app.department === 'quality' ? 'الجودة' : app.department === 'warehouse' ? 'المخازن' : app.department}</span>
                          <Badge variant={app.status === 'موافق' ? 'default' : app.status === 'مرفوض' ? 'destructive' : 'secondary'}>
                            {app.status}
                          </Badge>
                          
                          {req.status === 'قيد المراجعة' && (profile?.role === 'admin' || profile?.department === app.department || (profile?.department === 'production_manager' && app.department !== 'admin')) && app.status === 'قيد الانتظار' && (
                            <div className="flex gap-1 mr-2 border-r pr-2">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApproval(app.id, 'موافق', req.id)}>موافقة</Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleApproval(app.id, 'مرفوض', req.id)}>رفض</Button>
                            </div>
                          )}
                        </div>
                        {app.status === 'مرفوض' && app.rejection_reason && (
                          <div className="text-xs text-red-600 mt-1 mr-2 bg-red-50 p-1 rounded">سبب الرفض: {app.rejection_reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Diff viewer */}
                <div className="mt-4 border rounded-md p-4 bg-muted/10 space-y-4">
                  <h4 className="font-semibold text-sm">التعديلات المقترحة:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {req.new_data?.client_name !== req.project?.client_name && (
                      <div className="bg-card p-3 rounded border">
                        <span className="text-xs text-muted-foreground block mb-1">اسم العميل</span>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500">{req.project?.client_name || '-'}</span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-green-600 font-medium">{req.new_data?.client_name}</span>
                        </div>
                      </div>
                    )}
                    {req.new_data?.brand !== req.project?.brand && (
                      <div className="bg-card p-3 rounded border">
                        <span className="text-xs text-muted-foreground block mb-1">البراند</span>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500">{req.project?.brand || '-'}</span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-green-600 font-medium">{req.new_data?.brand}</span>
                        </div>
                      </div>
                    )}
                    {req.new_data?.delivery_date !== req.project?.delivery_date && (
                      <div className="bg-card p-3 rounded border">
                        <span className="text-xs text-muted-foreground block mb-1">تاريخ التسليم</span>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500">{req.project?.delivery_date ? format(new Date(req.project.delivery_date), 'yyyy-MM-dd') : '-'}</span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-green-600 font-medium">{req.new_data?.delivery_date ? format(new Date(req.new_data.delivery_date), 'yyyy-MM-dd') : '-'}</span>
                        </div>
                      </div>
                    )}
                    {req.new_data?.priority !== req.project?.priority && (
                      <div className="bg-card p-3 rounded border">
                        <span className="text-xs text-muted-foreground block mb-1">الأولوية</span>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500">{req.project?.priority || '-'}</span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-green-600 font-medium">{req.new_data?.priority}</span>
                        </div>
                      </div>
                    )}
                    {req.new_data?.notes !== req.project?.notes && (
                      <div className="bg-card p-3 rounded border md:col-span-2">
                        <span className="text-xs text-muted-foreground block mb-1">الملاحظات</span>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500">{req.project?.notes || '-'}</span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-green-600 font-medium">{req.new_data?.notes}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Show diff for product details if changed */}
                    {JSON.stringify(req.new_data?.product_details) !== JSON.stringify(req.project?.product_details) && (
                      <div className="bg-card p-3 rounded border md:col-span-2">
                        <span className="text-xs text-muted-foreground block mb-1">تفاصيل الأقسام (تغيرت)</span>
                        <div className="text-sm">
                          <span className="text-amber-600">تم تعديل تفاصيل ومواصفات الأقسام، يرجى مراجعة المواصفات الجديدة بدقة.</span>
                          {/* We can list departments that changed */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {['paint', 'upholstery_renovation', 'upholstery_manufacturing', 'flooring', 'graphite', 'electric', 'accessories', 'steel', 'cover', 'engine'].map(dept => {
                              const oldD = req.project?.product_details?.services?.[dept];
                              const newD = req.new_data?.product_details?.services?.[dept];
                              if (JSON.stringify(oldD) !== JSON.stringify(newD)) {
                                return <Badge key={dept} variant="outline" className="bg-amber-50">تعديل: {dept}</Badge>
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}