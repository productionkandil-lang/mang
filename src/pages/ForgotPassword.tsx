import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-password-reset', {
        body: {
          action: 'request_code',
          payload: { phone }
        }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || 'فشل إرسال الرمز');

      toast.success('تم إرسال رمز التحقق إلى رقم الواتساب الخاص بك');
      setStep('reset');
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || newPassword.length < 6) {
      toast.error('الرجاء إدخال الرمز وكلمة مرور من 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-password-reset', {
        body: {
          action: 'reset_password',
          payload: { phone, code, new_password: newPassword }
        }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || 'فشل إعادة تعيين كلمة المرور');

      toast.success('تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="h-12 w-12 bg-primary rounded-full flex items-center justify-center">
            <Factory className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">نظام إدارة المصنع</h1>
          <p className="text-muted-foreground">استعادة كلمة المرور</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === 'request' ? 'إرسال رمز التحقق' : 'إعادة تعيين كلمة المرور'}</CardTitle>
            <CardDescription>
              {step === 'request' 
                ? 'أدخل رقم الواتساب المسجل بحسابك لإرسال رمز التحقق.'
                : 'أدخل رمز التحقق المرسل لك وكلمة المرور الجديدة.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'request' ? (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الواتساب</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    dir="ltr"
                    className="text-left"
                    placeholder="مثال: 01000000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري الإرسال...' : 'إرسال الرمز'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">رمز التحقق</Label>
                  <Input 
                    id="code" 
                    type="text" 
                    dir="ltr"
                    className="text-center tracking-widest text-lg font-bold"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    dir="ltr"
                    className="text-left"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري الحفظ...' : 'تأكيد كلمة المرور الجديدة'}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Button variant="link" className="text-muted-foreground" onClick={() => navigate('/login')}>
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
