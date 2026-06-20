import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ArchivedProjects() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchArchivedProjects();
  }, []);

  const fetchArchivedProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_archived', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب المشاريع المؤرشفة');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من استعادة هذا المشروع من الأرشيف؟')) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_archived: false })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('تمت استعادة المشروع بنجاح');
      fetchArchivedProjects();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء استعادة المشروع');
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name?.includes(search) || 
    p.client_name?.includes(search) || 
    p.order_number?.includes(search)
  );

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">أرشيف المشاريع</h2>
          <p className="text-muted-foreground">المشاريع المغلقة والمؤرشفة.</p>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="بحث..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 pr-9 w-full md:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">لا توجد مشاريع مؤرشفة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className="hover:bg-muted/50 cursor-pointer transition-colors relative"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{project.order_number}</p>
                  </div>
                  <Badge variant="outline" className="bg-muted text-muted-foreground">مؤرشف</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="font-medium">{project.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">البراند:</span>
                  <span className="font-medium">{project.brand}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={(e) => handleRestore(project.id, e)}
                  >
                    <RefreshCw className="h-4 w-4 ml-2" />
                    استعادة من الأرشيف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}