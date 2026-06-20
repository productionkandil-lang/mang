import { AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    issues: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('status, is_archived');
          
        if (error) throw error;
        
        if (data) {
          const activeProjects = data.filter(p => !p.is_archived);
          const active = activeProjects.filter(p => p.status === 'جديد' || p.status === 'قيد التنفيذ' || p.status === 'في انتظار الجودة').length;
          const completed = activeProjects.filter(p => p.status === 'مكتمل' || p.status === 'مغلق').length;
          const issues = activeProjects.filter(p => p.status === 'مرفوض' || p.status === 'يحتاج تصليح').length;
          
          setStats({
            active,
            completed,
            issues,
            total: activeProjects.length
          });
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchStats();
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">نظرة عامة</h2>
        <p className="text-muted-foreground">ملخص لجميع المشاريع والأوردرات في المصنع.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المشاريع</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشاريع نشطة</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشاريع مكتملة</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشاكل ومرفوضات</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.issues}</div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>مرحباً بك في نظام إدارة المصنع</CardTitle>
            <CardDescription>
              يمكنك التنقل بين لوحات التحكم المختلفة من خلال القائمة الجانبية بناءً على صلاحيات قسمك.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
            {/* Chart placeholder or recent activity */}
            الرسم البياني للمشاريع سيظهر هنا
          </CardContent>
        </Card>
      </div>
    </div>
  );
}