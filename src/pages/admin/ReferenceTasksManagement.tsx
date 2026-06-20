import { Edit2, GripVertical, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

export default function ReferenceTasksManagement() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [departments] = useState([
    { id: 'paint', name: 'الدهانات' },
    { id: 'upholstery_renovation', name: 'الفرش التجديد' },
    { id: 'upholstery_manufacturing', name: 'الفرش تصنيع' },
    { id: 'flooring', name: 'الأرضيات' },
    { id: 'electric', name: 'الكهرباء والإكسسوار' },
    { id: 'steel', name: 'المعادن والاستيل' },
    { id: 'cover', name: 'الغطاء / التندة' },
    { id: 'engine', name: 'الموتور والصيانة' },
  ]);

  const [selectedDept, setSelectedDept] = useState('paint');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    option_name: '',
    requires_quantity: false,
    order_index: 0
  });

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('reference_tasks')
        .select('*')
        .order('department')
        .order('option_name')
        .order('order_index');

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      toast.error('حدث خطأ أثناء جلب المهام المرجعية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchTasks();
    }
  }, [profile]);

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }

  const handleOpenDialog = (task?: any) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        name: task.name,
        option_name: task.option_name || '',
        requires_quantity: task.requires_quantity,
        order_index: task.order_index
      });
    } else {
      setEditingTask(null);
      
      // Auto increment order index based on current list
      const deptTasks = tasks.filter(t => t.department === selectedDept);
      const nextIndex = deptTasks.length > 0 ? Math.max(...deptTasks.map(t => t.order_index)) + 1 : 1;
      
      setFormData({
        name: '',
        option_name: '',
        requires_quantity: false,
        order_index: nextIndex
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      const payload = {
        department: selectedDept,
        name: formData.name,
        option_name: formData.option_name || null,
        requires_quantity: formData.requires_quantity,
        order_index: parseInt(formData.order_index as any)
      };

      if (editingTask) {
        const { error } = await supabase.from('reference_tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;
        toast.success('تم تحديث المهمة بنجاح');
      } else {
        const { error } = await supabase.from('reference_tasks').insert([payload]);
        if (error) throw error;
        toast.success('تم إضافة المهمة بنجاح');
      }
      
      setIsDialogOpen(false);
      fetchTasks();
    } catch (err) {
      toast.error('فشل حفظ المهمة');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة؟ لن تتأثر الأوردرات السابقة.')) return;
    try {
      const { error } = await supabase.from('reference_tasks').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم حذف المهمة');
      fetchTasks();
    } catch (err) {
      toast.error('فشل حذف المهمة');
    }
  };

  const filteredTasks = tasks.filter(t => t.department === selectedDept);
  
  // Group by option_name
  const groupedTasks: Record<string, any[]> = {};
  filteredTasks.forEach(t => {
    const opt = t.option_name || 'عام (بدون خيار)';
    if (!groupedTasks[opt]) groupedTasks[opt] = [];
    groupedTasks[opt].push(t);
  });

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">إدارة المهام المرجعية</h2>
        <p className="text-muted-foreground">قم بإدارة مهام الأقسام لإنشاء الأوردرات تلقائياً بناءً على اختيارات المبيعات.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="md:w-1/4 h-fit">
          <CardHeader>
            <CardTitle>الأقسام</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`p-4 text-right border-b last:border-0 hover:bg-muted/50 transition-colors ${selectedDept === dept.id ? 'bg-primary/10 border-r-4 border-r-primary font-bold' : ''}`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle>مهام قسم: {departments.find(d => d.id === selectedDept)?.name}</CardTitle>
              <CardDescription>المهام التي ستظهر للفنيين في هذا القسم.</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة مهمة
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {loading ? (
              <div className="text-center p-8 text-muted-foreground">جاري التحميل...</div>
            ) : Object.keys(groupedTasks).length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-lg bg-muted/20 text-muted-foreground">
                لا توجد مهام لهذا القسم. قم بإضافة مهمة جديدة.
              </div>
            ) : (
              Object.keys(groupedTasks).map(optionName => (
                <div key={optionName} className="space-y-4">
                  <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                    <Badge variant="outline" className="text-sm">{optionName}</Badge>
                  </h3>
                  <div className="rounded-md border">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="p-3 w-10"></th>
                          <th className="p-3 font-medium text-muted-foreground">اسم المهمة</th>
                          <th className="p-3 font-medium text-muted-foreground">تحتاج كمية؟</th>
                          <th className="p-3 font-medium text-muted-foreground">الترتيب</th>
                          <th className="p-3 w-24">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {groupedTasks[optionName].map(task => (
                          <tr key={task.id} className="hover:bg-muted/30">
                            <td className="p-3 text-muted-foreground"><GripVertical className="h-4 w-4" /></td>
                            <td className="p-3 font-medium">{task.name}</td>
                            <td className="p-3">
                              {task.requires_quantity ? (
                                <Badge variant="secondary">نعم</Badge>
                              ) : (
                                <span className="text-muted-foreground">لا</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{task.order_index}</td>
                            <td className="p-3 flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenDialog(task)}>
                                <Edit2 className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteTask(task.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</DialogTitle>
            <DialogDescription className="sr-only">إضافة أو تعديل المهمة المرجعية</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTask} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>اسم المهمة</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                required 
                placeholder="مثال: صنفرة 1، أو رفع المقاسات"
              />
            </div>
            
            <div className="space-y-2">
              <Label>مرتبطة بخيار (Option Name)</Label>
              <Input 
                value={formData.option_name} 
                onChange={e => setFormData({...formData, option_name: e.target.value})} 
                placeholder="مثال: دهان كامل وانتي فاولينج (اتركه فارغاً للمهام العامة)"
              />
              <p className="text-xs text-muted-foreground">إذا تركت هذا الحقل فارغاً، سيتم اعتبار المهمة عامة للقسم ولن تعتمد على خيارات.</p>
            </div>
            
            <div className="space-y-2">
              <Label>الترتيب (رقم)</Label>
              <Input 
                type="number" 
                value={formData.order_index} 
                onChange={e => setFormData({...formData, order_index: Number(e.target.value)})} 
                required 
              />
            </div>
            
            <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20 mt-2">
              <div className="space-y-0.5">
                <Label>هل تتطلب كمية؟</Label>
                <p className="text-xs text-muted-foreground">تفعيل هذا سيتيح إدخال كمية رقمية لهذه المهمة.</p>
              </div>
              <Switch 
                checked={formData.requires_quantity} 
                onCheckedChange={c => setFormData({...formData, requires_quantity: c})} 
              />
            </div>
            
            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
