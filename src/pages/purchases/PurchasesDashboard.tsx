import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export default function PurchasesDashboard() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request Dialog
  const [newRequestDialog, setNewRequestDialog] = useState(false);
  const [newRequest, setNewRequest] = useState({ item_name: '', quantity: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [profile]);

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('purchase_requests')
        .select(`
          *,
          requester:requested_by ( full_name, department )
        `)
        .order('created_at', { ascending: false });

      // If not procurement and not admin, only show own department requests
      // But we don't have department in purchase_requests, so we filter by requested_by
      if (profile?.role !== 'admin' && profile?.department !== 'procurement') {
        query = query.eq('requested_by', profile?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب طلبات الشراء');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.item_name || newRequest.quantity <= 0) {
      toast.error('يرجى إدخال الصنف والكمية');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('purchase_requests').insert([{
        item_name: newRequest.item_name,
        quantity: newRequest.quantity,
        requested_by: profile?.id
      }]);

      if (error) throw error;
      toast.success('تم إرسال طلب الشراء');
      setNewRequestDialog(false);
      setNewRequest({ item_name: '', quantity: 1 });
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('purchase_requests').update({ status }).eq('id', id);
      if (error) throw error;
      toast.success('تم تحديث حالة الطلب');
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('خطأ في التحديث');
    }
  };

  const isProcurement = profile?.role === 'admin' || profile?.department === 'procurement';

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">طلبات الشراء</h2>
          <p className="text-muted-foreground">{isProcurement ? 'إدارة جميع طلبات الشراء الواردة من الأقسام' : 'متابعة طلبات الشراء الخاصة بك'}</p>
        </div>
        <Button onClick={() => setNewRequestDialog(true)}>
          <Plus className="ml-2 h-4 w-4" />
          طلب شراء جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <div className="w-full max-w-full overflow-x-auto bg-card">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">التاريخ</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الصنف</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الكمية</th>
                    {isProcurement && <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">طالب الشراء</th>}
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">النوع</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الحالة</th>
                    {isProcurement && <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">إجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد طلبات شراء</td></tr>
                  ) : requests.map(req => (
                    <tr key={req.id} className="hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap" dir="ltr">{format(new Date(req.created_at), 'dd MMM yyyy HH:mm')}</td>
                      <td className="p-3 font-medium whitespace-nowrap">{req.item_name}</td>
                      <td className="p-3 whitespace-nowrap">{req.quantity}</td>
                      {isProcurement && (
                        <td className="p-3 whitespace-nowrap">
                          {req.requester?.full_name} <span className="text-muted-foreground">({req.requester?.department})</span>
                        </td>
                      )}
                      <td className="p-3 whitespace-nowrap">
                        {req.auto_generated ? <Badge variant="secondary">تلقائي</Badge> : <Badge variant="outline">يدوي</Badge>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <Select 
                          value={req.status} 
                          disabled={!isProcurement}
                          onValueChange={(v) => updateStatus(req.id, v)}
                        >
                          <SelectTrigger dir="rtl" className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="جديد">جديد</SelectItem>
                            <SelectItem value="قيد المعالجة">قيد المعالجة</SelectItem>
                            <SelectItem value="في انتظار فحص الجودة">في انتظار فحص الجودة</SelectItem>
                            <SelectItem value="مكتمل">مكتمل</SelectItem>
                            <SelectItem value="مرفوض">مرفوض</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {isProcurement && (
                        <td className="p-3 whitespace-nowrap">
                          {/* Can add more actions like linking to inventory */}
                          <span className="text-muted-foreground text-xs">تحديث من الحالة</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={newRequestDialog} onOpenChange={setNewRequestDialog}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>طلب شراء جديد</DialogTitle>
            <DialogDescription className="sr-only">أدخل بيانات طلب الشراء</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم الصنف</Label>
              <Input value={newRequest.item_name} onChange={e => setNewRequest({...newRequest, item_name: e.target.value})} placeholder="ما الذي تريد شراءه؟" />
            </div>
            <div className="space-y-2">
              <Label>الكمية المطلوبة</Label>
              <Input type="number" min="1" value={newRequest.quantity} onChange={e => setNewRequest({...newRequest, quantity: parseInt(e.target.value) || 1})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRequestDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreateRequest} disabled={isSubmitting}>
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}