import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArrowRight, Check, ClipboardCheck, Filter, Minus, Plus, Upload, FileDown, Archive, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const [qualityDialog, setQualityDialog] = useState({ isOpen: false, department: '' });
  const [qualityPhotos, setQualityPhotos] = useState<string[]>([]);

  const fetchProjectData = async () => {
    if (!id) return;
    try {
      // 1. Fetch Project
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (projErr) throw projErr;
      if (!projData) throw new Error('المشروع غير موجود');
      setProject(projData);

      // 2. Fetch Financials if admin or finance
      if (profile?.role === 'admin' || profile?.department === 'finance') {
        const { data: finData } = await supabase
          .from('project_financials')
          .select('*')
          .eq('project_id', id)
          .maybeSingle();
        if (finData) setFinancials(finData);
      }

      // 3. Fetch Tasks
      let tasksQuery = supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', id)
        .order('order_index', { ascending: true });

      // If not admin or manager or sales, only fetch their department tasks
      if (profile?.role !== 'admin' && profile?.role !== 'manager' && profile?.department !== 'production_manager' && profile?.department !== 'sales') {
        tasksQuery = tasksQuery.eq('department', profile?.department);
      }

      const { data: tasksData, error: tasksErr } = await tasksQuery;
      if (tasksErr) throw tasksErr;
      setTasks(tasksData || []);

      // 4. Fetch form fields for dynamic labels
      const { data: fieldsData } = await supabase.from('order_form_fields').select('*');
      if (fieldsData) setFormFields(fieldsData);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id, profile]);

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    if (isAdminOrManager || isSales) {
      toast.error('ليس لديك صلاحية لتعديل حالة المهام');
      return;
    }
    const newStatus = currentStatus === 'مكتمل' ? 'قيد الانتظار' : 'مكتمل';
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'مكتمل' ? new Date().toISOString() : null,
          completed_by: newStatus === 'مكتمل' ? profile?.id : null
        })
        .eq('id', taskId);

      if (error) throw error;
      
      // Update local state
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      setTasks(updatedTasks);
      
      // Auto-trigger quality ticket dialog if all tasks for this department are completed
      if (newStatus === 'مكتمل' && profile && !isAdminOrManager) {
        const deptTasks = updatedTasks.filter(t => t.department === profile.department);
        const allCompleted = deptTasks.length > 0 && deptTasks.every(t => t.status === 'مكتمل');
        if (allCompleted) {
          setQualityDialog({ isOpen: true, department: profile.department });
        }
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تحديث المهمة');
    }
  };

  const handleQuantityChange = async (taskId: string, currentQty: number, delta: number) => {
    if (isAdminOrManager || isSales) {
      toast.error('ليس لديك صلاحية لتعديل الكميات');
      return;
    }
    const newQty = Math.max(0, currentQty + delta);
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ quantity: newQty })
        .eq('id', taskId);

      if (error) throw error;
      
      setTasks(tasks.map(t => t.id === taskId ? { ...t, quantity: newQty } : t));
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تحديث الكمية');
    }
  };

  const handleSubmitQualityTicket = async () => {
    if (!profile || !project || !qualityDialog.department) return;
    setSubmitting(true);
    try {
      // 1. Create a quality ticket
      const { data: ticketData, error: ticketErr } = await supabase
        .from('quality_tickets')
        .insert({
          project_id: project.id,
          department: qualityDialog.department,
          status: 'مفتوحة',
          created_by: profile.id
        })
        .select()
        .single();

      if (ticketErr) throw ticketErr;

      // 1.5 Insert photos if any
      if (qualityPhotos.length > 0 && ticketData) {
        const photoInserts = qualityPhotos.map(url => ({
          ticket_id: ticketData.id,
          photo_url: url
        }));
        await supabase.from('ticket_photos').insert(photoInserts);
      }

      // 2. Update project status
      const { error: projErr } = await supabase
        .from('projects')
        .update({ status: 'في انتظار الجودة' })
        .eq('id', project.id);

      if (projErr) throw projErr;

      // 3. Notify the sales person who created the project
      if (project.created_by) {
        const { error: notifErr } = await supabase
          .from('notifications')
          .insert({
            user_id: project.created_by,
            title: 'تحديث في المشروع',
            message: `أنهى قسم ${qualityDialog.department} المهام الخاصة به وتم إرسال التذكرة للجودة`,
            link: `/quality/${ticketData?.id}`
          });
          
        if (notifErr) {
          console.error("Failed to send notification:", notifErr);
        }
      }

      toast.success('تم إنهاء مهام القسم وإرسال التذكرة للجودة بنجاح');
      setQualityDialog({ isOpen: false, department: '' });
      setQualityPhotos([]);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء إنهاء القسم وإرسال التذكرة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishDepartment = () => {
    if (!profile) return;
    setQualityDialog({ isOpen: true, department: profile.department });
  };

  if (loading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-destructive">المشروع غير موجود</div>;
  }

  // Calculate progress for current department
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager' || profile?.department === 'production_manager';
  const isSales = profile?.department === 'sales';
  
  const renderServiceDetails = (key: string, data: any) => {
    if (!data) return null;
    
    const labels: Record<string, string> = {
      paint: 'الدهانات',
      upholstery_renovation: 'الفرش التجديد',
      upholstery_manufacturing: 'الفرش تصنيع',
      flooring: 'الأرضيات',
      graphite: 'الجرافيتو',
      electric: 'الكهرباء',
      accessories: 'الإكسسوارات',
      steel: 'المعادن والاستيل',
      cover: 'الغطاء / التندة',
      engine: 'الموتور والصيانة'
    };

    const fieldLabels: Record<string, string> = {
      workType: 'نوع العمل',
      areas: 'المناطق المحددة',
      colors: 'الألوان',
      paintType: 'نوع الدهان',
      newColorDetails: 'تفاصيل اللون الجديد',
      price: 'سعر البند',
      specs: 'المواصفات',
      diamondType: 'نوع الكابوتنيه',
      threadColor: 'لون الخيط',
      piecesCount: 'عدد القطع',
      colorCode: 'كود اللون',
      primaryColor: 'اللون الأساسي',
      secondaryColor: 'اللون الفرعي',
      sideColor: 'اللون الجانبي',
      pipingColor: 'لون الفلتو',
      notes: 'ملاحظات',
      logoEmbroideryColor: 'لون تطريزة اللوجو',
      logoPlaces: 'أماكن اللوجو',
      logoType: 'نوع اللوجو',
      materialType: 'نوع الخامة',
      boardsCount: 'عدد الألواح',
      topColor: 'الطبقة العلوية',
      middleColor: 'الطبقة الوسطى',
      bottomColor: 'الطبقة السفلية',
      hasLogo: 'يوجد لوجو؟',
      logoDetails: 'تفاصيل اللوجو',
      details: 'التفاصيل',
      requirements: 'المطلوب',
      canopyMaterial: 'خامة التندة',
      coverMaterial: 'خامة الغطاء'
    };

    // Inject dynamic labels from DB
    formFields.forEach(f => {
      fieldLabels[f.field_key] = f.field_label;
    });

    return (
      <div key={key} className="bg-muted/10 p-4 rounded-md space-y-3">
        <span className="font-bold text-lg block text-primary mb-2 border-b pb-2">بند {labels[key] || key}</span>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {Object.entries(data).map(([fieldKey, fieldValue]) => {
            if (fieldValue === null || fieldValue === '' || fieldKey === 'images' || fieldKey === 'boatImages' || fieldKey === 'designImages' || fieldKey === 'logoImage') return null;
            if (typeof fieldValue === 'boolean') {
              fieldValue = fieldValue ? 'نعم' : 'لا';
            }
            return (
              <div key={fieldKey} className="flex flex-col bg-background/50 p-2 rounded">
                <span className="text-muted-foreground text-xs">{fieldLabels[fieldKey] || fieldKey}:</span>
                <span className="font-medium mt-1">{String(fieldValue)}</span>
              </div>
            );
          })}
        </div>

        {/* Images rendering */}
        {data.images && data.images.length > 0 && (
          <div className="mt-4">
            <span className="text-muted-foreground text-xs block mb-2">صور التصميم:</span>
            <div className="flex flex-wrap gap-2">
              {data.images.map((img: string, i: number) => (
                <a href={img} target="_blank" rel="noreferrer" key={i}>
                  <img src={img} alt="تصميم" className="h-20 w-20 object-cover rounded-md border" />
                </a>
              ))}
            </div>
          </div>
        )}
        
        {data.boatImages && data.boatImages.length > 0 && (
          <div className="mt-4">
            <span className="text-muted-foreground text-xs block mb-2">صور المركب:</span>
            <div className="flex flex-wrap gap-2">
              {data.boatImages.map((img: string, i: number) => (
                <a href={img} target="_blank" rel="noreferrer" key={i}>
                  <img src={img} alt="المركب" className="h-20 w-20 object-cover rounded-md border" />
                </a>
              ))}
            </div>
          </div>
        )}
        
        {data.designImages && data.designImages.length > 0 && (
          <div className="mt-4">
            <span className="text-muted-foreground text-xs block mb-2">صور التصميم:</span>
            <div className="flex flex-wrap gap-2">
              {data.designImages.map((img: string, i: number) => (
                <a href={img} target="_blank" rel="noreferrer" key={i}>
                  <img src={img} alt="تصميم" className="h-20 w-20 object-cover rounded-md border" />
                </a>
              ))}
            </div>
          </div>
        )}
        
        {data.logoImage && data.logoImage.length > 0 && (
          <div className="mt-4">
            <span className="text-muted-foreground text-xs block mb-2">صورة اللوجو:</span>
            <div className="flex flex-wrap gap-2">
              {data.logoImage.map((img: string, i: number) => (
                <a href={img} target="_blank" rel="noreferrer" key={i}>
                  <img src={img} alt="لوجو" className="h-20 w-20 object-cover rounded-md border" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const displayedTasks = (isAdminOrManager || isSales)
    ? (selectedDepartment === 'all' ? tasks : tasks.filter(t => t.department === selectedDepartment))
    : tasks.filter(t => t.department === profile?.department);

  const completedTasks = displayedTasks.filter(t => t.status === 'مكتمل').length;
  const totalTasks = displayedTasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const canFinish = totalTasks > 0 && completedTasks === totalTasks;

  const uniqueDepartments = Array.from(new Set(tasks.map(t => t.department)));

  const handleExportPDF = async () => {
    try {
      const element = document.getElementById('project-detail-content');
      if (!element) return;
      
      setSubmitting(true);
      toast.info('جاري تجهيز ملف PDF...');
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Project_${project.order_number || project.name}.pdf`);
      
      toast.success('تم تصدير الملف بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('هل أنت متأكد من أرشفة هذا المشروع؟ لن يظهر في القوائم النشطة بعد الآن.')) return;
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('projects')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('تم أرشفة المشروع بنجاح');
      navigate('/archive');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء أرشفة المشروع');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('تم حذف المشروع بنجاح');
      navigate('/orders');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف المشروع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          <p className="text-muted-foreground">{project.order_number}</p>
        </div>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          {project.is_archived && <Badge variant="secondary" className="bg-muted">مؤرشف</Badge>}
          <Badge className="text-sm">{project.status}</Badge>
          
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={submitting}>
            <FileDown className="h-4 w-4 ml-2" />
            تصدير PDF
          </Button>
          
          {profile?.role === 'admin' && project.status === 'مغلق' && !project.is_archived && (
            <Button variant="destructive" size="sm" onClick={handleArchive} disabled={submitting}>
              <Archive className="h-4 w-4 ml-2" />
              أرشفة المشروع
            </Button>
          )}

          {(profile?.role === 'admin' || profile?.department === 'sales') && (
            <Button variant="destructive" size="sm" onClick={handleDeleteProject} disabled={submitting}>
              <Trash2 className="h-4 w-4 ml-2" />
              حذف الأوردر
            </Button>
          )}
        </div>
      </div>

      <div id="project-detail-content" className="grid gap-6 md:grid-cols-3 bg-background p-4 rounded-xl">
        {/* Left Column: Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">معلومات العميل والمشروع</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">اسم العميل:</span>
                <span className="font-medium">{project.client_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">البراند:</span>
                <span className="font-medium">{project.brand}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">تاريخ التسليم:</span>
                <span className="font-medium block" dir="ltr">
                  {format(new Date(project.delivery_date), 'dd MMM yyyy', { locale: ar })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">الأولوية:</span>
                <Badge variant="outline">{project.priority}</Badge>
              </div>
              {project.notes && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block mb-1">ملاحظات:</span>
                  <p className="font-medium text-pretty">{project.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">تفاصيل المركب والخدمات</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <span className="text-muted-foreground block mb-1">سنة التصنيع:</span>
                  <span className="font-medium">{project.product_details?.manufactureYear || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">كود الموديل:</span>
                  <span className="font-medium">{project.product_details?.modelCode || '-'}</span>
                </div>
                {formFields.filter(f => f.section_id === 'general' && !f.is_standard).map(f => {
                  const val = project.product_details?.[f.field_key];
                  if (!val) return null;
                  return (
                    <div key={f.field_key}>
                      <span className="text-muted-foreground block mb-1">{f.field_label}:</span>
                      <span className="font-medium">{String(val)}</span>
                    </div>
                  );
                })}
              </div>

              {project.product_details?.services && Object.entries(project.product_details.services).map(([key, value]) => {
                const canView = isAdminOrManager || isSales || profile?.department === key || 
                  (profile?.department === 'upholstery' && (key === 'upholstery_renovation' || key === 'upholstery_manufacturing'));
                if (!canView) return null;
                return renderServiceDetails(key, value);
              })}
              
              {(!project.product_details?.services || Object.keys(project.product_details.services).filter(k => isAdminOrManager || isSales || profile?.department === k || (profile?.department === 'upholstery' && (k === 'upholstery_renovation' || k === 'upholstery_manufacturing'))).every(k => project.product_details.services[k] === null)) && (
                <div className="text-muted-foreground">لا توجد تفاصيل خدمات للعرض</div>
              )}
            </CardContent>
          </Card>

          {financials && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3 border-b border-primary/10">
                <CardTitle className="text-lg text-primary">المعلومات التجارية (للمالية)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">السعر الإجمالي:</span>
                  <span className="font-bold text-lg">{financials.price}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">هامش الربح:</span>
                  <span className="font-medium">{financials.profit_margin}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">شروط الدفع:</span>
                  <span className="font-medium">{financials.payment_terms || '-'}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Tasks */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  مهام القسم
                  {isAdminOrManager && <span className="text-xs text-muted-foreground">(مدير)</span>}
                  {isSales && <span className="text-xs text-muted-foreground">(مبيعات - للمتابعة فقط)</span>}
                </CardTitle>
                
                {(isAdminOrManager || isSales) && (
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-[140px] h-8 text-xs" dir="rtl">
                      <SelectValue placeholder="تصفية بالقسم" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="all">كل الأقسام</SelectItem>
                      {uniqueDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {totalTasks > 0 && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">نسبة الإنجاز</span>
                    <span className="font-medium">{progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4 p-0">
              {displayedTasks.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  لا توجد مهام مخصصة لهذا القسم في المشروع.
                </div>
              ) : (
                <div className="divide-y">
                  {displayedTasks.map((task) => (
                    <div key={task.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          disabled={isAdminOrManager || isSales}
                          onClick={() => handleTaskToggle(task.id, task.status)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            task.status === 'مكتمل'
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-input hover:border-primary hover:bg-primary/10'
                          } ${(isAdminOrManager || isSales) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {task.status === 'مكتمل' && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === 'مكتمل' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.name}
                          </p>
                          {profile?.role === 'admin' && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                              {task.department}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {task.requires_quantity && (
                        <div className="flex items-center gap-3 pl-8">
                          <span className="text-xs text-muted-foreground">الكمية المنجزة:</span>
                          <div className="flex items-center border rounded-md">
                            <button 
                              type="button"
                              disabled={isAdminOrManager || isSales}
                              onClick={() => handleQuantityChange(task.id, task.quantity || 0, -1)}
                              className={`p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-r-md ${(isAdminOrManager || isSales) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-10 text-center text-sm font-medium">{task.quantity || 0}</span>
                            <button 
                              type="button"
                              disabled={isAdminOrManager || isSales}
                              onClick={() => handleQuantityChange(task.id, task.quantity || 0, 1)}
                              className={`p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-l-md ${(isAdminOrManager || isSales) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {!isAdminOrManager && displayedTasks.length > 0 && profile?.department !== 'sales' && (
              <div className="p-4 border-t bg-muted/10">
                <Button 
                  className="w-full" 
                  disabled={!canFinish || submitting}
                  onClick={handleFinishDepartment}
                >
                  {submitting ? 'جاري الإرسال...' : 'إنهاء القسم وإرسال للجودة'}
                </Button>
                {!canFinish && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    يجب إكمال جميع المهام لتتمكن من إنهاء القسم
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={qualityDialog.isOpen} onOpenChange={(open) => !open && setQualityDialog({ isOpen: false, department: '' })}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>إرسال تذكرة فحص جودة</DialogTitle>
            <DialogDescription>
              لقد أتممت جميع المهام المطلوبة. يرجى إرفاق صورة للعمل النهائي لإرسالها إلى قسم الجودة (اختياري).
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <ImageUpload 
              images={qualityPhotos} 
              onChange={setQualityPhotos} 
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setQualityDialog({ isOpen: false, department: '' })}>
              إلغاء
            </Button>
            <Button onClick={handleSubmitQualityTicket} disabled={submitting}>
              {submitting ? 'جاري الإرسال...' : 'تأكيد وإرسال للجودة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}