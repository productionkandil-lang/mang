import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckSquare, Send, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

interface Project {
  id: string;
  order_number: string;
  client_name: string;
  name: string;
  brand: string;
  delivery_date: string;
  priority: string;
  status: string;
  project_tasks?: any[];
}

export default function ProjectList() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager' || profile?.department === 'production_manager';
        
        let selectStr = 'id, order_number, client_name, name, brand, delivery_date, priority, status, project_tasks(id, name, department, status, order_index)';
        
        let query = supabase
          .from('projects')
          // @ts-ignore
          .select(selectStr)
          .or('is_archived.eq.false,is_archived.is.null')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!isAdminOrManager && profile?.department !== 'sales' && profile?.department !== 'design') {
          if (profile?.department === 'upholstery') {
            query = query.in('project_tasks.department', ['upholstery', 'upholstery_renovation', 'upholstery_manufacturing']);
          } else {
            query = query.eq('project_tasks.department', profile?.department);
          }
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // When using .eq on joined table, supabase filters the parent rows that don't match, 
        // but it still might return empty array for project_tasks if using outer join. 
        // If we want inner join filtering: `project_tasks!inner(...)` but we used normal join and eq.
        // It's safer to filter in memory for unique projects.
        let filteredData = (data || []) as any[];
        if (!isAdminOrManager && profile?.department !== 'sales' && profile?.department !== 'design') {
          filteredData = filteredData.filter((p: any) => p.project_tasks && p.project_tasks.some((t: any) => {
            if (profile?.department === 'upholstery') {
              return ['upholstery', 'upholstery_renovation', 'upholstery_manufacturing'].includes(t.department);
            }
            return t.department === profile?.department;
          }));
        }

        // Sort tasks within each project
        filteredData.forEach((p: any) => {
          if (p.project_tasks) {
            p.project_tasks.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
          }
        });

        // @ts-ignore
        const uniqueProjects = filteredData ? Array.from(new Set(filteredData.map((p: any) => p.id)))
          .map(id => filteredData.find((p: any) => p.id === id)) as Project[] : [];
          
        setProjects(uniqueProjects);
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [profile]);

  const markTaskComplete = async (e: React.MouseEvent, taskId: string, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ status: 'مكتمل' })
        .eq('id', taskId);
      
      if (error) throw error;
      
      toast.success('تم إنجاز المهمة');
      setProjects(prev => prev.map(p => {
        if (p.id === projectId && p.project_tasks) {
          return {
            ...p,
            project_tasks: p.project_tasks.map((t: any) => t.id === taskId ? { ...t, status: 'مكتمل' } : t)
          };
        }
        return p;
      }));
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث المهمة');
    }
  };

  const sendToQuality = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile || !profile.department) return;
    
    try {
      // 1. Create a quality ticket
      const { error: ticketErr } = await supabase
        .from('quality_tickets')
        .insert({
          project_id: projectId,
          department: profile.department,
          status: 'مفتوحة',
          created_by: profile.id
        });

      if (ticketErr) throw ticketErr;

      // 2. Update project status
      const { error: projErr } = await supabase
        .from('projects')
        .update({ status: 'في انتظار الجودة' })
        .eq('id', projectId);

      if (projErr) throw projErr;

      toast.success('تم إرسال الأوردر للجودة بنجاح');
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'في انتظار الجودة' } : p));
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الإرسال للجودة');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'VIP': return 'bg-purple-500 hover:bg-purple-600';
      case 'عاجل': return 'bg-destructive hover:bg-destructive';
      default: return 'bg-secondary text-secondary-foreground hover:bg-secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'جديد': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'قيد التنفيذ': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'في انتظار الجودة': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'مكتمل': return 'bg-green-100 text-green-800 border-green-200';
      case 'مرفوض': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">المشاريع والأوردرات</h2>
          <p className="text-muted-foreground">قائمة بالمشاريع المفتوحة والتي تتطلب العمل.</p>
        </div>
        {(profile?.department === 'sales' || profile?.department === 'admin' || profile?.department === 'production_manager') && (
          <Button asChild>
            <Link to="/orders/new">أوردر جديد</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري تحميل المشاريع...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 space-y-4">
            <p className="text-muted-foreground">لا توجد مشاريع حالياً</p>
            {(profile?.department === 'sales' || profile?.department === 'admin' || profile?.department === 'production_manager') && (
              <Button variant="outline" asChild>
                <Link to="/orders/new">إنشاء أوردر جديد</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col h-full hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline">{project.order_number}</Badge>
                  <Badge className={getPriorityColor(project.priority)}>{project.priority}</Badge>
                </div>
                <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                <CardDescription className="line-clamp-1">{project.client_name} - {project.brand}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ التسليم:</span>
                    <span className="font-medium" dir="ltr">
                      {format(new Date(project.delivery_date), 'dd MMM yyyy', { locale: ar })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الحالة:</span>
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                </div>
                
                {profile && profile.department !== 'sales' && profile.department !== 'admin' && profile.department !== 'production_manager' && profile.department !== 'design' && profile.department !== 'quality' && project.project_tasks && project.project_tasks.length > 0 && (
                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border/50">
                    {(() => {
                      const currentTask = project.project_tasks.find((t: any) => t.status !== 'مكتمل' && t.department === profile.department);
                      if (!currentTask) {
                        return (
                          <>
                            <div className="flex items-center text-green-600 gap-2 text-sm font-medium mb-1">
                              <CheckSquare className="h-4 w-4" />
                              تم إنجاز جميع مهام القسم
                            </div>
                            <Button size="sm" variant="outline" className="w-full text-xs" onClick={(e) => sendToQuality(e, project.id)}>
                              <Send className="h-3 w-3 ml-2" /> إرسال الأوردر للجودة
                            </Button>
                          </>
                        );
                      }
                      return (
                        <>
                          <div className="text-xs text-muted-foreground">المهمة الحالية:</div>
                          <div className="flex items-start gap-2 bg-muted/30 p-2 rounded-md border border-border/50">
                            <button 
                              onClick={(e) => markTaskComplete(e, currentTask.id, project.id)}
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                              title="تعليم كمكتملة"
                            >
                              <Square className="h-4 w-4" />
                            </button>
                            <span className="text-sm line-clamp-2">{currentTask.name}</span>
                          </div>
                          <Button size="sm" variant="outline" className="w-full text-xs mt-1" onClick={(e) => sendToQuality(e, project.id)}>
                            <Send className="h-3 w-3 ml-2" /> إرسال للجودة قبل الاكتمال
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
              <div className="mt-auto p-4 pt-0 shrink-0 space-y-2">
                <Button variant="secondary" className="w-full" asChild>
                  <Link to={`/projects/${project.id}`}>عرض التفاصيل والمهام</Link>
                </Button>
                {(profile?.department === 'sales' || profile?.role === 'admin' || profile?.department === 'production_manager') && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={`/orders/edit/${project.id}`}>تعديل الأوردر</Link>
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