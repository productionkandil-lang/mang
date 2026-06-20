import { format } from 'date-fns';
import { Edit2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

import * as XLSX from 'xlsx';

export default function UsersManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    department: 'sales',
    role: 'staff'
  });

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch emails
      const { data: authData, error: authError } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list_users' }
      });

      if (authError || authData?.error) {
        console.error('Failed to fetch auth users:', authError || authData?.error);
      }

      const authUsers = authData?.users || [];
      
      const mergedUsers = (profiles || []).map(p => {
        const authInfo = authUsers.find((u: any) => u.id === p.id);
        return {
          ...p,
          email: authInfo?.email || 'غير متوفر'
        };
      });

      setUsers(mergedUsers);
    } catch (err) {
      toast.error('حدث خطأ أثناء جلب بيانات المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers();
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_user',
          payload: {
            email: formData.email,
            password: formData.password,
            full_name: formData.fullName,
            department: formData.department,
            role: formData.role
          }
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('تم إنشاء المستخدم بنجاح');
      setFormData({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        department: 'sales',
        role: 'staff'
      });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء إنشاء المستخدم');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setUpdating(true);
    try {
      // 1. Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          department: editingUser.department,
          phone: editingUser.phone,
          role: editingUser.role
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      // 2. Update auth (email/password) if changed
      if (editingUser.newEmail !== editingUser.email || editingUser.newPassword) {
        const payload: any = { uid: editingUser.id };
        if (editingUser.newEmail && editingUser.newEmail !== editingUser.email) {
          payload.email = editingUser.newEmail;
        }
        if (editingUser.newPassword) {
          if (editingUser.newPassword.length < 6) {
            toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
            setUpdating(false);
            return;
          }
          payload.password = editingUser.newPassword;
        }

        const { data: authData, error: authError } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'update_user_auth',
            payload
          }
        });

        if (authError || authData?.error) {
          throw new Error(authData?.error || 'فشل تحديث البريد أو كلمة المرور');
        }
      }

      toast.success('تم تحديث بيانات المستخدم بنجاح');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء تحديث المستخدم');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete_user',
          payload: { uid }
        }
      });

      if (error || data?.error) throw new Error(data?.error || 'فشل حذف المستخدم');

      toast.success('تم حذف المستخدم بنجاح');
      if (editingUser?.id === uid) setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء حذف المستخدم');
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = users.map(u => ({
        'الاسم': u.full_name,
        'البريد الإلكتروني': u.email,
        'القسم': getDepartmentName(u.department),
        'الهاتف': u.phone || '-',
        'الصلاحية': u.role === 'admin' ? 'مدير نظام' : u.role === 'manager' ? 'مدير إدارة' : 'موظف',
        'تاريخ الانضمام': format(new Date(u.created_at), 'yyyy-MM-dd')
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'المستخدمين');
      
      XLSX.writeFile(workbook, 'المستخدمين.xlsx');
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية للوصول إلى هذه الصفحة.</div>;
  }

  const getDepartmentName = (dept: string) => {
    const names: Record<string, string> = {
      'sales': 'المبيعات',
      'production_manager': 'مدير الإنتاج العام',
      'paint': 'الدهانات',
      'upholstery_renovation': 'الفرش التجديد',
      'upholstery_manufacturing': 'الفرش تصنيع',
      'flooring': 'الأرضيات',
      'electric': 'الكهرباء والإكسسوار',
      'steel': 'المعادن والاستيل',
      'cover': 'الغطاء / التندة',
      'engine': 'الموتور والصيانة',
      'quality': 'الجودة',
      'finance': 'المالية',
      'design': 'التصميم',
      'procurement': 'المشتريات',
      'warehouse': 'المخازن',
      'admin': 'الإدارة العليا'
    };
    return names[dept] || dept;
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">إدارة المستخدمين والأقسام</h2>
        <p className="text-muted-foreground">أضف مستخدمين جدد للنظام وحدد صلاحياتهم وأقسامهم.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>إضافة مستخدم جديد</CardTitle>
            <CardDescription>أدخل بيانات الموظف لإنشاء حسابه.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم بالكامل</Label>
                <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" className="text-left" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور (المبدئية)</Label>
                <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} dir="ltr" className="text-left" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف (WhatsApp)</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} dir="ltr" className="text-left" required />
              </div>
              
              <div className="space-y-2">
                <Label>القسم التابع له</Label>
                <Select value={formData.department} onValueChange={(v) => handleSelectChange('department', v)}>
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="sales">المبيعات</SelectItem>
                    <SelectItem value="production_manager">مدير الإنتاج العام</SelectItem>
                    <SelectItem value="paint">الدهانات</SelectItem>
                    <SelectItem value="upholstery_renovation">الفرش التجديد</SelectItem><SelectItem value="upholstery_manufacturing">الفرش تصنيع</SelectItem>
                    <SelectItem value="flooring">الأرضيات</SelectItem>
                    <SelectItem value="electric">الكهرباء والإكسسوار</SelectItem>
                    <SelectItem value="steel">المعادن والاستيل</SelectItem>
                    <SelectItem value="cover">الغطاء / التندة</SelectItem>
                    <SelectItem value="engine">الموتور والصيانة</SelectItem>
                    <SelectItem value="quality">الجودة</SelectItem>
                    <SelectItem value="finance">المالية</SelectItem>
                    <SelectItem value="design">التصميم</SelectItem>
                    <SelectItem value="procurement">المشتريات</SelectItem>
                    <SelectItem value="warehouse">المخازن</SelectItem>
                    <SelectItem value="admin">الإدارة العليا</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الصلاحية (الدور)</Label>
                <Select value={formData.role} onValueChange={(v) => handleSelectChange('role', v)}>
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر الصلاحية" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="staff">موظف / مدير قسم (Staff)</SelectItem>
                    <SelectItem value="manager">مدير إدارة (Manager)</SelectItem>
                    <SelectItem value="admin">مدير نظام (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={creating}>
                {creating ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>المستخدمون الحاليون</CardTitle>
            </div>
            <Button variant="outline" onClick={handleExportExcel}>
              تصدير لـ Excel
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">جاري التحميل...</div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 font-medium text-muted-foreground">الاسم</th>
                      <th className="p-3 font-medium text-muted-foreground">البريد الإلكتروني</th>
                      <th className="p-3 font-medium text-muted-foreground">القسم</th>
                      <th className="p-3 font-medium text-muted-foreground">الهاتف</th>
                      <th className="p-3 font-medium text-muted-foreground">الصلاحية</th>
                      <th className="p-3 font-medium text-muted-foreground">تاريخ الانضمام</th>
                      <th className="p-3 font-medium text-muted-foreground">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{user.full_name}</td>
                        <td className="p-3" dir="ltr">{user.email}</td>
                        <td className="p-3">
                          <Badge variant="outline">{getDepartmentName(user.department)}</Badge>
                        </td>
                        <td className="p-3" dir="ltr">{user.phone || '-'}</td>
                        <td className="p-3">
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'}>
                            {user.role === 'admin' ? 'مدير نظام' : user.role === 'manager' ? 'مدير إدارة' : 'موظف'}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground" dir="ltr">
                          {format(new Date(user.created_at), 'dd MMM yyyy')}
                        </td>
                        <td className="p-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingUser({
                              ...user, 
                              newEmail: user.email === 'غير متوفر' ? '' : user.email, 
                              newPassword: ''
                            })}
                          >
                            <Edit2 className="h-4 w-4 text-primary" />
                            <span className="sr-only">تعديل</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription className="sr-only">نافذة تعديل بيانات المستخدم</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName">الاسم بالكامل</Label>
                <Input 
                  id="editFullName" 
                  value={editingUser.full_name} 
                  onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail">البريد الإلكتروني</Label>
                <Input 
                  id="editEmail" 
                  type="email"
                  dir="ltr"
                  className="text-left"
                  value={editingUser.newEmail} 
                  onChange={(e) => setEditingUser({...editingUser, newEmail: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPassword">كلمة المرور الجديدة (اختياري)</Label>
                <Input 
                  id="editPassword" 
                  type="password"
                  dir="ltr"
                  className="text-left"
                  placeholder="اتركه فارغاً لعدم التغيير"
                  value={editingUser.newPassword} 
                  onChange={(e) => setEditingUser({...editingUser, newPassword: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPhone">رقم الهاتف (WhatsApp)</Label>
                <Input 
                  id="editPhone" 
                  dir="ltr"
                  className="text-left"
                  value={editingUser.phone || ''} 
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})} 
                />
              </div>
              
              <div className="space-y-2">
                <Label>القسم التابع له</Label>
                <Select 
                  value={editingUser.department} 
                  onValueChange={(v) => setEditingUser({...editingUser, department: v})}
                >
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="sales">المبيعات</SelectItem>
                    <SelectItem value="production_manager">مدير الإنتاج العام</SelectItem>
                    <SelectItem value="paint">الدهانات</SelectItem>
                    <SelectItem value="upholstery_renovation">الفرش التجديد</SelectItem><SelectItem value="upholstery_manufacturing">الفرش تصنيع</SelectItem>
                    <SelectItem value="flooring">الأرضيات</SelectItem>
                    <SelectItem value="cover">الغطاء / التندة</SelectItem>
                    <SelectItem value="engine">الموتور والصيانة</SelectItem>
                    <SelectItem value="electric">الكهرباء والإكسسوار</SelectItem>
                    <SelectItem value="steel">المعادن والاستيل</SelectItem>
                    <SelectItem value="quality">الجودة</SelectItem>
                    <SelectItem value="finance">المالية</SelectItem>
                    <SelectItem value="design">التصميم</SelectItem>
                    <SelectItem value="procurement">المشتريات</SelectItem>
                    <SelectItem value="warehouse">المخازن</SelectItem>
                    <SelectItem value="admin">الإدارة العليا</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الصلاحية (الدور)</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(v) => setEditingUser({...editingUser, role: v})}
                >
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر الصلاحية" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="staff">موظف / مدير قسم (Staff)</SelectItem>
                    <SelectItem value="manager">مدير إدارة (Manager)</SelectItem>
                    <SelectItem value="admin">مدير نظام (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="mt-6 flex items-center justify-between sm:justify-between w-full">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => handleDeleteUser(editingUser.id)}
                >
                  حذف المستخدم
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={updating}>
                    {updating ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}