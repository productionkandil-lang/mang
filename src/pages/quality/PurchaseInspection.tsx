import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { Link } from 'react-router-dom';

export default function PurchaseInspection() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          requester:requested_by ( full_name, department )
        `)
        .eq('status', 'في انتظار فحص الجودة')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching purchase requests:', err);
      toast.error('حدث خطأ أثناء جلب طلبات الشراء');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedReq) return;
    try {
      // 1. Add to inventory
      // First check if it exists in inventory
      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('id, current_stock, received_qty')
        .eq('item_name', selectedReq.item_name)
        .maybeSingle();

      if (invError) throw invError;

      if (invData) {
        // Update existing
        await supabase
          .from('inventory')
          .update({
            current_stock: invData.current_stock + selectedReq.quantity,
            received_qty: invData.received_qty + selectedReq.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', invData.id);
      } else {
        // Insert new
        await supabase
          .from('inventory')
          .insert({
            item_code: `ITM-${Date.now().toString().slice(-6)}`,
            item_name: selectedReq.item_name,
            current_stock: selectedReq.quantity,
            received_qty: selectedReq.quantity,
            issued_qty: 0,
            min_limit: 5,
            order_limit: 10
          });
      }

      // 2. Update status
      const { error: updError } = await supabase
        .from('purchase_requests')
        .update({ status: 'تمت الإضافة للمخزن', quality_notes: notes })
        .eq('id', selectedReq.id);

      if (updError) throw updError;

      toast.success('تم قبول الطلب وإضافته للمخزن بنجاح');
      setSelectedReq(null);
      setNotes('');
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الموافقة على الطلب');
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    if (!notes) {
      toast.error('يرجى إدخال سبب الرفض في الملاحظات');
      return;
    }
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status: 'مرفوض', quality_notes: notes })
        .eq('id', selectedReq.id);

      if (error) throw error;
      toast.success('تم رفض الطلب');
      setSelectedReq(null);
      setNotes('');
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الرفض');
    }
  };

  if (profile?.role !== 'admin' && profile?.department !== 'quality') {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">فحص طلبات الشراء المكتملة</h2>
          <p className="text-muted-foreground">مراجعة طلبات الشراء قبل إضافتها للمخزن.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/quality">العودة لتذاكر الجودة</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto bg-card rounded-md border">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">التاريخ</th>
                  <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الصنف</th>
                  <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الكمية</th>
                  <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">طالب الشراء</th>
                  <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد طلبات في انتظار الفحص</td></tr>
                ) : requests.map(req => (
                  <tr key={req.id} className="hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap" dir="ltr">{format(new Date(req.created_at), 'dd MMM yyyy HH:mm', { locale: ar })}</td>
                    <td className="p-3 font-medium whitespace-nowrap">{req.item_name}</td>
                    <td className="p-3 whitespace-nowrap">{req.quantity}</td>
                    <td className="p-3 whitespace-nowrap">
                      {req.requester?.full_name} <span className="text-muted-foreground">({req.requester?.department})</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Button size="sm" onClick={() => setSelectedReq(req)}>فحص الطلب</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedReq} onOpenChange={(open) => !open && setSelectedReq(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>فحص طلب الشراء</DialogTitle>
            <DialogDescription className="sr-only">نافذة فحص الجودة لطلب الشراء</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">الصنف:</span>
                <span className="font-medium">{selectedReq?.item_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">الكمية:</span>
                <span className="font-medium">{selectedReq?.quantity}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات الجودة / سبب الرفض</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="أدخل أي ملاحظات هنا..." />
            </div>
          </div>
          <DialogFooter className="flex-row sm:justify-start gap-2">
            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleApprove}>قبول وإضافة للمخزن</Button>
            <Button variant="destructive" onClick={handleReject}>رفض وإرجاع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}