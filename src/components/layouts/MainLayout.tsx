import { 
  Banknote, 
  Bell, 
  CheckSquare, 
  Factory,
  FileText, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  PlusCircle, 
  Settings,
  Users,
  Palette,
  Package,
  ShoppingCart,
  FileSignature
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
  departments?: string[];
}

const navItems: NavItem[] = [
  { name: 'لوحة التحكم الرئيسية', path: '/', icon: LayoutDashboard },
  { name: 'طلب إنتاج جديد', path: '/orders/new', icon: PlusCircle, departments: ['sales', 'admin', 'production_manager'] },
  { name: 'أوامر المبيعات', path: '/orders', icon: FileText, departments: ['sales', 'admin', 'production_manager'] },
  { name: 'طلبات تعديل الأوردرات', path: '/orders/edits', icon: FileSignature, departments: ['admin', 'production_manager', 'quality', 'warehouse', 'paint', 'upholstery', 'upholstery_renovation', 'upholstery_manufacturing', 'flooring', 'electric', 'steel', 'cover', 'engine'] },
  { name: 'مشاريع الإنتاج', path: '/production', icon: Factory, departments: ['production_manager', 'paint', 'upholstery', 'upholstery_renovation', 'upholstery_manufacturing', 'flooring', 'electric', 'steel', 'cover', 'engine', 'admin'] },
  { name: 'قسم التصميم', path: '/design', icon: Palette, departments: ['design', 'admin', 'production_manager'] },
  { name: 'تذاكر الجودة', path: '/quality', icon: CheckSquare, departments: ['quality', 'admin'] },
  { name: 'المخازن', path: '/warehouse', icon: Package, departments: ['warehouse', 'admin', 'sales', 'design', 'production_manager'] },
  { name: 'طلبات الشراء', path: '/purchases', icon: ShoppingCart, departments: ['procurement', 'admin', 'warehouse', 'production_manager', 'sales', 'paint', 'upholstery', 'upholstery_renovation', 'upholstery_manufacturing', 'flooring', 'electric', 'steel', 'cover', 'engine', 'quality', 'finance', 'design'] },
  { name: 'المالية والفواتير', path: '/finance', icon: Banknote, departments: ['finance', 'admin'] },
  { name: 'إدارة المهام المرجعية', path: '/tasks-setup', icon: Settings, roles: ['admin'] },
  { name: 'إدارة المستخدمين', path: '/users', icon: Users, roles: ['admin'] },
  { name: 'سجل النشاطات', path: '/audit-logs', icon: FileText, roles: ['admin'] },
  { name: 'الأرشيف', path: '/archive', icon: Factory, roles: ['admin'] },
];

export default function MainLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch initial count and latest notifications
    const fetchNotifications = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      setUnreadNotifications(count || 0);

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (data) setNotifications(data);
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setUnreadNotifications(prev => prev + 1);
        setNotifications(prev => [payload.new, ...prev].slice(0, 5));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.is_read && !payload.old.is_read) {
          setUnreadNotifications(prev => Math.max(0, prev - 1));
        } else if (!payload.new.is_read && payload.old.is_read) {
          setUnreadNotifications(prev => prev + 1);
        }
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string, link: string | null) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (link) {
      navigate(link);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(item => {
    if (!profile) return false;
    if (item.roles && !item.roles.includes(profile.role)) return false;
    if (item.departments && profile.role !== 'admin' && !item.departments.includes(profile.department)) return false;
    return true;
  });

  const NavLinks = () => (
    <>
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-l border-border bg-card shrink-0">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Factory className="h-6 w-6 text-primary ml-2" />
          <span className="text-lg font-bold">إدارة المصنع</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavLinks />
        </div>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'مستخدم'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.department === 'admin' ? 'مدير النظام' : 
                 profile?.department === 'sales' ? 'المبيعات' :
                 profile?.department === 'production_manager' ? 'مدير الإنتاج العام' :
                 profile?.department === 'paint' ? 'قسم الدهانات' :
                 profile?.department === 'upholstery_renovation' ? 'قسم الفرش التجديد' :
                 profile?.department === 'upholstery_manufacturing' ? 'قسم الفرش تصنيع' :
                 profile?.department === 'flooring' ? 'قسم الأرضيات' :
                 profile?.department === 'electric' ? 'قسم الكهرباء' :
                 profile?.department === 'steel' ? 'قسم المعادن' :
                 profile?.department === 'quality' ? 'الجودة' :
                 profile?.department === 'finance' ? 'المالية' :
                 profile?.department}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center border-b border-border bg-card px-4 lg:px-6 shrink-0">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden mr-auto">
                <Menu className="h-5 w-5" />
                <span className="sr-only">فتح القائمة</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 flex flex-col" dir="rtl">
              <div className="flex h-16 items-center border-b border-border px-6">
                <Factory className="h-6 w-6 text-primary ml-2" />
                <span className="text-lg font-bold">إدارة المصنع</span>
              </div>
              <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                <NavLinks />
              </div>
              <div className="border-t border-border p-4">
                <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4 ml-2" />
                  تسجيل الخروج
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex-1 flex justify-end items-center gap-4 lg:justify-between lg:w-full">
            <h1 className="text-lg font-semibold lg:block hidden">مرحباً، {profile?.full_name}</h1>
            
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>الإشعارات</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    لا توجد إشعارات
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem 
                      key={notification.id} 
                      className={`flex flex-col items-start p-3 cursor-pointer ${!notification.is_read ? 'bg-muted/50' : ''}`}
                      onClick={() => markAsRead(notification.id, notification.link)}
                    >
                      <span className="font-medium text-sm">{notification.title}</span>
                      <span className="text-xs text-muted-foreground mt-1">{notification.message}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}