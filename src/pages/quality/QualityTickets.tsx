import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

interface Ticket {
  id: string;
  department: string;
  status: string;
  created_at: string;
  projects: {
    id: string;
    name: string;
    order_number: string;
    client_name: string;
  };
}

export default function QualityTickets() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data, error } = await supabase
          .from('quality_tickets')
          .select(`
            id,
            department,
            status,
            created_at,
            projects ( id, name, order_number, client_name )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTickets(data as any[] || []);
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'مفتوحة': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'مقبولة': return 'bg-green-100 text-green-800 border-green-200';
      case 'مرفوضة': return 'bg-red-100 text-red-800 border-red-200';
      case 'تحتاج تصليح': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">تذاكر الجودة</h2>
          <p className="text-muted-foreground">قائمة بالتذاكر المحولة من الأقسام المختلفة لفحص الجودة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/quality/purchases">فحص طلبات الشراء</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري تحميل التذاكر...</div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">لا توجد تذاكر جودة حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="flex flex-col h-full hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline">{ticket.projects?.order_number}</Badge>
                  <Badge className={getStatusColor(ticket.status)} variant="outline">{ticket.status}</Badge>
                </div>
                <CardTitle className="text-lg line-clamp-1">{ticket.projects?.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">القسم المحول:</span>
                  <span className="font-medium">{ticket.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الإرسال:</span>
                  <span className="font-medium" dir="ltr">
                    {format(new Date(ticket.created_at), 'dd MMM HH:mm', { locale: ar })}
                  </span>
                </div>
              </CardContent>
              <div className="mt-auto p-4 pt-0 shrink-0">
                <Button variant="secondary" className="w-full" asChild>
                  <Link to={`/quality/${ticket.id}`}>عرض تفاصيل التذكرة</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}