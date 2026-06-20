import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

import { FileText, Printer } from 'lucide-react';

export default function FinanceDashboard() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, order_number, client_name, name, status, created_at,
          project_financials ( price, profit_margin, payment_terms )
        `)
        .in('status', ['مكتمل', 'مغلق'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching finance projects:', err);
      toast.error('حدث خطأ أثناء جلب البيانات المالية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCloseProject = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من إغلاق هذا المشروع؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'مغلق' })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('تم إغلاق المشروع بنجاح');
      fetchProjects();
    } catch (err) {
      toast.error('حدث خطأ أثناء إغلاق المشروع');
    }
  };

  const handlePrintInvoice = (project: any) => {
    const price = project.project_financials?.[0]?.price || 0;
    const paymentTerms = project.project_financials?.[0]?.payment_terms || '';
    
    const invoiceHTML = `
      <html dir="rtl" lang="ar">
        <head>
          <title>فاتورة - ${project.order_number}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .details-col { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { padding: 12px; border: 1px solid #ddd; text-align: right; }
            th { background-color: #f8fafc; }
            .total { text-align: left; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; font-size: 14px; color: #666; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">نظام إدارة المصنع</div>
            <h2>فاتورة ضريبية</h2>
          </div>
          <div class="details">
            <div class="details-col">
              <p><strong>رقم الفاتورة:</strong> INV-${project.id.substring(0, 8).toUpperCase()}</p>
              <p><strong>تاريخ الإصدار:</strong> ${format(new Date(), 'dd MMMM yyyy', { locale: ar })}</p>
              <p><strong>رقم الأوردر:</strong> ${project.order_number}</p>
            </div>
            <div class="details-col">
              <p><strong>اسم العميل:</strong> ${project.client_name}</p>
              <p><strong>المشروع:</strong> ${project.name}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>الوصف</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>أعمال صيانة وتجهيز مشروع: ${project.name}</td>
                <td>${price.toLocaleString()} ج.م</td>
              </tr>
            </tbody>
          </table>
          <div class="total">
            <p>الإجمالي المستحق: ${price.toLocaleString()} ج.م</p>
          </div>
          ${paymentTerms ? `<div style="margin-top: 30px;"><p><strong>شروط الدفع:</strong><br/>${paymentTerms}</p></div>` : ''}
          <div class="footer">
            <p>شكراً لتعاملكم معنا.</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(invoiceHTML);
      win.document.close();
    } else {
      toast.error('يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة الفاتورة');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">الإدارة المالية</h2>
        <p className="text-muted-foreground">مراجعة المشاريع المكتملة وإغلاقها مالياً.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري تحميل البيانات...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">لا توجد مشاريع مكتملة في الوقت الحالي</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className={`flex flex-col h-full ${project.status === 'مغلق' ? 'opacity-70 bg-muted/50' : 'hover:border-primary/50'} transition-colors`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline">{project.order_number}</Badge>
                  <Badge 
                    className={project.status === 'مغلق' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'} 
                    variant="outline"
                  >
                    {project.status}
                  </Badge>
                </div>
                <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                <CardDescription className="line-clamp-1">{project.client_name}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-3 space-y-4 text-sm">
                <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">السعر الإجمالي:</span>
                    <span className="font-bold text-primary">{project.project_financials?.price || 0}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">هامش الربح:</span>
                    <span className="font-medium">{project.project_financials?.profit_margin || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">شروط الدفع:</span>
                    <span className="font-medium text-xs line-clamp-1">{project.project_financials?.payment_terms || '-'}</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs pt-2">
                  <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                  <span dir="ltr">
                    {format(new Date(project.created_at), 'dd MMM yyyy', { locale: ar })}
                  </span>
                </div>
              </CardContent>
              <div className="mt-auto p-4 pt-0 shrink-0 flex gap-2">
                <Button variant="secondary" className="flex-1" asChild>
                  <Link to={`/projects/${project.id}`}>عرض التفاصيل</Link>
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handlePrintInvoice(project)}
                  title="طباعة الفاتورة"
                  className="px-3"
                >
                  <Printer className="h-4 w-4" />
                </Button>
                {project.status !== 'مغلق' && (
                  <Button 
                    className="flex-1" 
                    onClick={() => handleCloseProject(project.id)}
                  >
                    إغلاق المشروع
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}