import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, Plus, ArrowRight, CheckCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function ApproveOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeDepartments, setActiveDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New task and material states
  const [newTask, setNewTask] = useState({ name: '', department: 'paint', requires_quantity: false });
  const [newMaterial, setNewMaterial] = useState({ item_name: '', quantity: 1, notes: '' });

  const ALL_DEPARTMENTS = [
    { id: 'paint', name: 'الدهانات' },
    { id: 'upholstery_renovation', name: 'الفرش التجديد' },
    { id: 'upholstery_manufacturing', name: 'الفرش تصنيع' },
    { id: 'flooring', name: 'الأرضيات' },
    { id: 'graphite', name: 'الجرافيتو' },
    { id: 'electric', name: 'الكهرباء' },
    { id: 'accessories', name: 'الإكسسوارات' },
    { id: 'steel', name: 'المعادن والاستيل' },
    { id: 'cover', name: 'الغطاء / التندة' },
    { id: 'engine', name: 'الموتور والصيانة' }
  ];

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // 1. Fetch Project
      const { data: projData, error: projError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      if (projError) throw projError;
      setProject(projData);

      // Extract initially active departments from JSON
      const initialActiveDepts = projData.product_details?.services 
        ? Object.keys(projData.product_details.services).filter(k => projData.product_details.services[k]) 
        : [];
      setActiveDepartments(initialActiveDepts);

      // 2. Fetch Tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', id)
        .order('order_index');
      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

      // 3. Fetch Materials
      const { data: matData, error: matError } = await supabase
        .from('project_materials')
        .select('*')
        .eq('project_id', id);
      if (matError) throw matError;
      setMaterials(matData || []);

    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.name) return;
    try {
      const orderIndex = tasks.filter(t => t.department === newTask.department).length + 1;
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({
          project_id: id,
          department: newTask.department,
          name: newTask.name,
          requires_quantity: newTask.requires_quantity,
          order_index: orderIndex,
          status: 'قيد الانتظار'
        })
        .select()
        .single();
        
      if (error) throw error;
      setTasks([...tasks, data]);
      setNewTask({ ...newTask, name: '' });
      
      // Auto-check department
      if (!activeDepartments.includes(newTask.department)) {
        setActiveDepartments([...activeDepartments, newTask.department]);
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة المهمة');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف المهمة');
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.item_name || newMaterial.quantity <= 0) return;
    try {
      const { data, error } = await supabase
        .from('project_materials')
        .insert({
          project_id: id,
          item_name: newMaterial.item_name,
          quantity: newMaterial.quantity,
          notes: newMaterial.notes
        })
        .select()
        .single();
        
      if (error) throw error;
      setMaterials([...materials, data]);
      setNewMaterial({ item_name: '', quantity: 1, notes: '' });
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة الخامة');
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    try {
      const { error } = await supabase.from('project_materials').delete().eq('id', matId);
      if (error) throw error;
      setMaterials(materials.filter(m => m.id !== matId));
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف الخامة');
    }
  };

  const toggleDepartment = (dept: string) => {
    if (activeDepartments.includes(dept)) {
      setActiveDepartments(activeDepartments.filter(d => d !== dept));
    } else {
      setActiveDepartments([...activeDepartments, dept]);
    }
  };

  const handleApprove = async () => {
    if (!confirm('هل أنت متأكد من اعتماد الأوردر؟ سيتم إرساله للأقسام المحددة للبدء فيه.')) return;
    try {
      setSubmitting(true);

      // Clean up tasks for unselected departments
      const tasksToDelete = tasks.filter(t => !activeDepartments.includes(t.department));
      if (tasksToDelete.length > 0) {
        await supabase
          .from('project_tasks')
          .delete()
          .in('id', tasksToDelete.map(t => t.id));
      }

      // Update project status to 'جديد'
      const { error } = await supabase
        .from('projects')
        .update({ status: 'جديد' })
        .eq('id', id);

      if (error) throw error;

      toast.success('تم اعتماد الأوردر بنجاح وإرساله للأقسام');
      navigate('/design');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء اعتماد الأوردر');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!project) return <div className="p-8 text-center text-destructive">المشروع غير موجود</div>;
  if (profile?.department !== 'design' && profile?.role !== 'admin') return <div className="p-8 text-center text-destructive">غير مصرح لك</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">اعتماد الأوردر: {project.name}</h2>
          <p className="text-muted-foreground">{project.order_number}</p>
        </div>
        <div className="mr-auto">
          <Button onClick={handleApprove} disabled={submitting} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            اعتماد وتوزيع الأوردر
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">الأقسام المشاركة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ALL_DEPARTMENTS.map(dept => (
                <div key={dept.id} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox 
                    id={`dept-${dept.id}`} 
                    checked={activeDepartments.includes(dept.id)}
                    onCheckedChange={() => toggleDepartment(dept.id)}
                  />
                  <Label htmlFor={`dept-${dept.id}`} className="cursor-pointer">{dept.name}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">إضافة الخامات المطلوبة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>الخامة</Label>
                <Input value={newMaterial.item_name} onChange={e => setNewMaterial({...newMaterial, item_name: e.target.value})} placeholder="اسم الخامة" />
              </div>
              <div className="space-y-2">
                <Label>الكمية</Label>
                <Input type="number" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: Number(e.target.value)})} min="1" />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input value={newMaterial.notes} onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})} placeholder="اختياري" />
              </div>
              <Button className="w-full" onClick={handleAddMaterial} disabled={!newMaterial.item_name}>إضافة خامة</Button>

              {materials.length > 0 && (
                <div className="mt-4 border-t pt-4 space-y-2">
                  <h4 className="font-semibold text-sm mb-2">الخامات المضافة:</h4>
                  {materials.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                      <div>
                        <span className="font-medium">{m.item_name}</span> (x{m.quantity})
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteMaterial(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تعديل المهام والمراحل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Form to add a new task manually */}
              <div className="flex gap-2 items-end bg-muted/30 p-4 rounded-lg border">
                <div className="flex-1 space-y-2">
                  <Label>اسم المهمة</Label>
                  <Input value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} placeholder="مثال: تنظيف الأسطح" />
                </div>
                <div className="w-40 space-y-2">
                  <Label>القسم</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newTask.department} 
                    onChange={e => setNewTask({...newTask, department: e.target.value})}
                  >
                    {ALL_DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse pb-2">
                  <Checkbox 
                    id="req-qty" 
                    checked={newTask.requires_quantity}
                    onCheckedChange={(c) => setNewTask({...newTask, requires_quantity: !!c})}
                  />
                  <Label htmlFor="req-qty">تحتاج كمية</Label>
                </div>
                <Button onClick={handleAddTask} disabled={!newTask.name}>
                  <Plus className="h-4 w-4 ml-2" /> إضافة
                </Button>
              </div>

              {/* Display tasks grouped by department, only for active departments */}
              <div className="space-y-6 mt-6">
                {activeDepartments.map(deptId => {
                  const deptTasks = tasks.filter(t => t.department === deptId);
                  const deptName = ALL_DEPARTMENTS.find(d => d.id === deptId)?.name;
                  
                  return (
                    <div key={deptId} className="space-y-2">
                      <h3 className="font-semibold text-primary border-b pb-2">{deptName}</h3>
                      {deptTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">لا توجد مهام مضافة لهذا القسم.</p>
                      ) : (
                        <ul className="space-y-2">
                          {deptTasks.map(t => (
                            <li key={t.id} className="flex items-center justify-between bg-card border rounded p-3 text-sm hover:border-primary/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{t.name}</span>
                                {t.requires_quantity && <Badge variant="outline" className="text-[10px]">كمية</Badge>}
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTask(t.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {activeDepartments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded border border-dashed">
                    لم يتم تحديد أي أقسام مشاركة في هذا الأوردر.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}