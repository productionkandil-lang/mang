import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

export default function DesignDashboard() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  
  // Materials state
  const [materials, setMaterials] = useState<any[]>([]);
  const [newMaterial, setNewMaterial] = useState({ item_name: '', quantity: 1, notes: '' });
  const [addingMaterial, setAddingMaterial] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('status', ['في انتظار اعتماد التصميم', 'جديد', 'قيد التنفيذ', 'في انتظار الجودة'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب المشاريع');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_materials')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب الخامات');
    }
  };

  const navigate = useNavigate();

  const handleOpenProject = (project: any) => {
    if (project.status === 'في انتظار اعتماد التصميم') {
      navigate(`/design/approve/${project.id}`);
    } else {
      setSelectedProject(project);
      fetchMaterials(project.id);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.item_name || newMaterial.quantity <= 0) {
      toast.error('يرجى إدخال اسم الخامة والكمية');
      return;
    }
    
    setAddingMaterial(true);
    try {
      const { data, error } = await supabase
        .from('project_materials')
        .insert({
          project_id: selectedProject.id,
          item_name: newMaterial.item_name,
          quantity: newMaterial.quantity,
          notes: newMaterial.notes,
          created_by: profile?.id
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setMaterials([...materials, data]);
      setNewMaterial({ item_name: '', quantity: 1, notes: '' });
      toast.success('تم إضافة الخامة بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة الخامة');
    } finally {
      setAddingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الخامة؟')) return;
    
    try {
      const { error } = await supabase
        .from('project_materials')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setMaterials(materials.filter(m => m.id !== id));
      toast.success('تم حذف الخامة');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  if (profile?.role !== 'admin' && profile?.department !== 'design') {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">لوحة تحكم التصميم</h2>
        <p className="text-muted-foreground">عرض الأوردرات الجديدة وإضافة الخامات المطلوبة (BOM).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-10">جاري التحميل...</div>
        ) : projects.length === 0 ? (
          <div className="col-span-full text-center py-10 text-muted-foreground">لا توجد مشاريع حالياً</div>
        ) : (
          projects.map(project => (
            <Card key={project.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleOpenProject(project)}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={project.status === 'جديد' ? 'default' : 'secondary'}>{project.status}</Badge>
                  <Badge variant="outline" className={
                    project.priority === 'عاجل' ? 'border-amber-500 text-amber-500' :
                    project.priority === 'VIP' ? 'border-purple-500 text-purple-500' : ''
                  }>
                    {project.priority}
                  </Badge>
                </div>
                <CardTitle>{project.client_name}</CardTitle>
                <CardDescription>{project.brand} - {project.model_code}</CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>الخامات المطلوبة للمشروع: {selectedProject?.client_name}</DialogTitle>
            <DialogDescription className="sr-only">تحديد الخامات المطلوبة للمشروع</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">إضافة خامة جديدة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2 md:col-span-2">
                    <Label>اسم الخامة</Label>
                    <Input 
                      value={newMaterial.item_name}
                      onChange={e => setNewMaterial({...newMaterial, item_name: e.target.value})}
                      placeholder="أدخل اسم الخامة..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الكمية</Label>
                    <Input 
                      type="number"
                      min="1"
                      value={newMaterial.quantity}
                      onChange={e => setNewMaterial({...newMaterial, quantity: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <Button onClick={handleAddMaterial} disabled={addingMaterial} className="w-full">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  <Label>ملاحظات (اختياري)</Label>
                  <Input 
                    value={newMaterial.notes}
                    onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})}
                    placeholder="أي تفاصيل إضافية عن الخامة..."
                  />
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-lg font-medium mb-4">قائمة الخامات المسجلة ({materials.length})</h3>
              {materials.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-md">لم يتم تسجيل أي خامات بعد</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-3 font-medium text-muted-foreground">الخامة</th>
                        <th className="p-3 font-medium text-muted-foreground">الكمية</th>
                        <th className="p-3 font-medium text-muted-foreground">ملاحظات</th>
                        <th className="p-3 font-medium text-muted-foreground">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {materials.map(mat => (
                        <tr key={mat.id}>
                          <td className="p-3 font-medium">{mat.item_name}</td>
                          <td className="p-3">{mat.quantity}</td>
                          <td className="p-3 text-muted-foreground">{mat.notes || '-'}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteMaterial(mat.id)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSelectedProject(null)} className="w-full sm:w-auto">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}