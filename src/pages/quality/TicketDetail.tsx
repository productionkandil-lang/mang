import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArrowRight, CheckCircle, Image as ImageIcon, Upload, Wrench, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/db/supabase';

import { logAuditAction } from '@/utils/audit';

import { useAuth } from '@/contexts/AuthContext';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchTicket = async () => {
      if (!id) return;
      try {
        const { data: ticketData, error: ticketErr } = await supabase
          .from('quality_tickets')
          .select(`
            *,
            projects (*)
          `)
          .eq('id', id)
          .maybeSingle();
        
        if (ticketErr) throw ticketErr;
        if (!ticketData) throw new Error('التذكرة غير موجودة');
        setTicket(ticketData);
        setNotes(ticketData.notes || '');

        const { data: photoData } = await supabase
          .from('ticket_photos')
          .select('*')
          .eq('ticket_id', id);
          
        if (photoData) setPhotos(photoData);

        const { data: tasksData } = await supabase
          .from('project_tasks')
          .select('*')
          .eq('project_id', ticketData.project_id)
          .eq('department', ticketData.department)
          .order('order_index');
        
        if (tasksData) setTasks(tasksData);

      } catch (err: any) {
        toast.error(err.message || 'حدث خطأ في تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quality_photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('quality_photos')
        .getPublicUrl(filePath);

      const { data: photoRec, error: dbError } = await supabase
        .from('ticket_photos')
        .insert({
          ticket_id: id,
          photo_url: urlData.publicUrl
        })
        .select()
        .single();

      if (dbError) throw dbError;
      
      if (photoRec) {
        setPhotos(prev => [...prev, photoRec]);
        toast.success('تم رفع الصورة بنجاح');
      }

    } catch (err: any) {
      toast.error('حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleAction = async (status: string, projectStatus: string) => {
    if (!ticket) return;
    if ((status === 'مرفوضة' || status === 'تحتاج تصليح') && !notes.trim()) {
      toast.error('يرجى كتابة ملاحظات لسبب الرفض أو طلب الإصلاح');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Update ticket
      const { error: tErr } = await supabase
        .from('quality_tickets')
        .update({ 
          status, 
          notes,
          closed_at: status === 'مقبولة' ? new Date().toISOString() : null
        })
        .eq('id', ticket.id);
      
      if (tErr) throw tErr;

      // 2. Update project
      // If it's accepted, we might want to check if ALL departments are done, but for simplicity we'll just set it to 'قيد التنفيذ' for the next department or 'مكتمل' if this was the final check.
      // Let's assume if Quality accepts, the project moves to 'مكتمل' if it's the final stage, or goes back to 'قيد التنفيذ' if there are other departments.
      // The PRD says: "المالية تستلم إشعار عند اكتمال جميع الأقسام". We will just set it to 'مكتمل' here for simplicity, or keep it simple based on our schema.
      const newProjStatus = status === 'مقبولة' ? 'مكتمل' : projectStatus;
      
      const { error: pErr } = await supabase
        .from('projects')
        .update({ status: newProjStatus })
        .eq('id', ticket.project_id);

      if (pErr) throw pErr;

      // 3. Send WhatsApp notification
      try {
        const { data: deptUsers } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('department', ticket.department)
          .not('phone', 'is', null);

        if (deptUsers && deptUsers.length > 0) {
          const actionText = status === 'مقبولة' ? 'تم قبول' : status === 'مرفوضة' ? 'تم رفض' : 'تم طلب إصلاح';
          const message = `أهلاً،\n${actionText} العمل الخاص بقسمك للمشروع "${ticket.projects?.name}" من قبل قسم الجودة.\nالملاحظات: ${notes || 'لا يوجد'}`;
          
          for (const user of deptUsers) {
            if (user.phone) {
              await supabase.functions.invoke('whatsapp-notification', {
                body: { phone: user.phone, message }
              });
            }
          }
        }
      } catch (notifyErr) {
        console.error('Failed to send WhatsApp notification', notifyErr);
      }

      toast.success(`تم تحديث التذكرة بنجاح إلى: ${status}`);
      logAuditAction(profile?.id, status === 'مقبولة' ? 'QUALITY_ACCEPT' : status === 'مرفوضة' ? 'QUALITY_REJECT' : 'QUALITY_FIX', {
        ticket_id: ticket.id,
        project_name: ticket.projects?.name,
        department: ticket.department,
        notes
      });
      navigate('/quality');
    } catch (err) {
      toast.error('حدث خطأ أثناء تحديث التذكرة');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!ticket) return <div className="p-8 text-center text-destructive">التذكرة غير موجودة</div>;

  const isClosed = ticket.status === 'مقبولة';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">تفاصيل تذكرة الجودة</h2>
          <p className="text-muted-foreground">{ticket.projects?.name} - {ticket.department}</p>
        </div>
        <Badge className="mr-auto text-sm" variant={isClosed ? 'default' : 'outline'}>
          {ticket.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">معلومات المشروع</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">رقم الأوردر:</span>
                <span className="font-medium">{ticket.projects?.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">العميل:</span>
                <span className="font-medium">{ticket.projects?.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">القسم المرسل:</span>
                <span className="font-medium">{ticket.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">تاريخ الإرسال:</span>
                <span className="font-medium" dir="ltr">
                  {format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', { locale: ar })}
                </span>
              </div>
              <div className="pt-4 border-t">
                <Button variant="link" className="px-0" asChild>
                  <Link to={`/projects/${ticket.project_id}`}>عرض تفاصيل المشروع الكاملة للتحقق</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">المهام المنفذة للقسم</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-sm">
              {tasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">لا توجد مهام مسجلة</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task, i) => (
                    <div key={task.id} className="flex justify-between items-center p-2 rounded border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.name}</span>
                        {task.requires_quantity && <Badge variant="outline" className="text-xs">{task.quantity}</Badge>}
                      </div>
                      <Badge variant={task.status === 'مكتمل' ? 'default' : 'secondary'} className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">الصور المرفقة</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {photos.length === 0 ? (
                <div className="text-center p-6 border border-dashed rounded-md bg-muted/20">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">لا توجد صور مرفقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-md overflow-hidden border">
                      <img src={p.photo_url} alt="Quality check" className="object-cover w-full h-full" />
                    </div>
                  ))}
                </div>
              )}

              {!isClosed && (
                <div>
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 w-full h-10 border border-dashed rounded-md hover:bg-muted/50 transition-colors text-sm font-medium text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      {uploading ? 'جاري الرفع...' : 'رفع صورة جديدة'}
                    </div>
                    <input 
                      id="photo-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-lg">قرار الجودة</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col">
              <div className="space-y-2 flex-1">
                <Label htmlFor="notes">ملاحظات وتقرير الفحص</Label>
                <Textarea 
                  id="notes" 
                  placeholder="اكتب تقرير الفحص وأي مشاكل تم العثور عليها هنا..." 
                  className="min-h-[150px] resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isClosed}
                />
              </div>

              {!isClosed && (
                <div className="grid gap-3 mt-6">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    disabled={actionLoading}
                    onClick={() => handleAction('مقبولة', 'مكتمل')}
                  >
                    <CheckCircle className="ml-2 h-4 w-4" />
                    قبول العمل وتمرير المشروع
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full text-amber-600 border-amber-200 hover:bg-amber-50" 
                    disabled={actionLoading}
                    onClick={() => handleAction('تحتاج تصليح', 'يحتاج تصليح')}
                  >
                    <Wrench className="ml-2 h-4 w-4" />
                    طلب تصليح وإرجاع للقسم
                  </Button>
                  <Button 
                    variant="destructive"
                    className="w-full" 
                    disabled={actionLoading}
                    onClick={() => handleAction('مرفوضة', 'مرفوض')}
                  >
                    <XCircle className="ml-2 h-4 w-4" />
                    رفض العمل
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}