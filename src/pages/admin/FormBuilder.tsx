import React, { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';

export default function FormBuilder() {
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const sections = [
    { id: 'general', name: 'البيانات العامة' },
    { id: 'paint', name: 'الدهان' },
    { id: 'upholstery_renovation', name: 'الفرش (تجديد)' },
    { id: 'upholstery_manufacturing', name: 'الفرش (تصنيع)' },
    { id: 'flooring', name: 'الأرضيات' },
    { id: 'graphite', name: 'الجرافيت' },
    { id: 'electric', name: 'الكهرباء' },
    { id: 'accessories', name: 'الإكسسوارات' },
    { id: 'steel', name: 'الحدادة' },
    { id: 'cover', name: 'الأغطية' },
    { id: 'engine', name: 'الموتور والصيانة' }
  ];

  const fieldTypes = [
    { id: 'text', name: 'نص قصير' },
    { id: 'textarea', name: 'نص طويل' },
    { id: 'number', name: 'رقم' },
    { id: 'date', name: 'تاريخ' },
    { id: 'select', name: 'قائمة منسدلة' },
    { id: 'image', name: 'رفع صورة' },
    { id: 'reference_select', name: 'قائمة مهام القسم' }
  ];

  const loadFields = async () => {
    const { data, error } = await supabase.from('order_form_fields').select('*').order('order_index');
    if (error) toast.error('خطأ في تحميل الحقول');
    else setFields(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadFields();
  }, []);

  const [newField, setNewField] = useState({
    section_id: 'general',
    field_key: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    options: ''
  });

  const handleAddField = async () => {
    if (!newField.field_key || !newField.field_label) {
      toast.error('الرجاء إدخال الكود والاسم');
      return;
    }
    
    try {
      const { error } = await supabase.from('order_form_fields').insert({
        section_id: newField.section_id,
        field_key: newField.field_key,
        field_label: newField.field_label,
        field_type: newField.field_type,
        is_required: newField.is_required,
        is_standard: false,
        options: newField.field_type === 'select' ? newField.options.split(',').map(o => o.trim()) : null,
        order_index: fields.filter(f => f.section_id === newField.section_id).length + 1
      });
      
      if (error) throw error;
      toast.success('تمت إضافة الحقل بنجاح');
      loadFields();
      setNewField({ ...newField, field_key: '', field_label: '', options: '' });
    } catch (e: any) {
      toast.error('حدث خطأ أثناء إضافة الحقل');
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحقل؟')) return;
    const { error } = await supabase.from('order_form_fields').delete().eq('id', id);
    if (error) toast.error('خطأ في الحذف');
    else {
      toast.success('تم الحذف');
      loadFields();
    }
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">بناء نموذج الأوردر</h2>
          <p className="text-muted-foreground">تخصيص الحقول والأسئلة لصفحة إنشاء وتعديل الأوردر.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>إضافة حقل جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select value={newField.section_id} onValueChange={v => setNewField({...newField, section_id: v})}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>اسم الحقل (يظهر للمستخدم)</Label>
                <Input value={newField.field_label} onChange={e => setNewField({...newField, field_label: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>البرمجي (كود الحقل بالإنجليزي)</Label>
                <Input dir="ltr" value={newField.field_key} onChange={e => setNewField({...newField, field_key: e.target.value})} placeholder="e.g. customNotes" />
              </div>
              <div className="space-y-2">
                <Label>نوع الحقل</Label>
                <Select value={newField.field_type} onValueChange={v => setNewField({...newField, field_type: v})}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {fieldTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              {newField.field_type === 'select' && (
                <div className="space-y-2">
                  <Label>خيارات (مفصولة بفاصلة)</Label>
                  <Input value={newField.options} onChange={e => setNewField({...newField, options: e.target.value})} placeholder="خيار 1, خيار 2, خيار 3" />
                </div>
              )}
              
              <div className="flex items-center space-x-2 space-x-reverse pt-8">
                <Switch 
                  checked={newField.is_required} 
                  onCheckedChange={v => setNewField({...newField, is_required: v})} 
                  id="isRequired" 
                />
                <Label htmlFor="isRequired">حقل إجباري</Label>
              </div>
            </div>
            <Button className="mt-6" onClick={handleAddField}>
              <Plus className="ml-2 h-4 w-4" /> إضافة الحقل
            </Button>
          </CardContent>
        </Card>

        {sections.map(section => {
          const sectionFields = fields.filter(f => f.section_id === section.id);
          if (sectionFields.length === 0) return null;
          
          return (
            <Card key={section.id}>
              <CardHeader className="bg-muted/30">
                <CardTitle>{section.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sectionFields.map(f => (
                    <div key={f.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <GripVertical className="text-muted-foreground h-4 w-4" />
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {f.field_label}
                            {f.is_required && <span className="text-destructive text-xs">*</span>}
                            {f.is_standard && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">أساسي</span>}
                          </p>
                          <p className="text-sm text-muted-foreground" dir="ltr">
                            {f.field_key} | {f.field_type} {f.field_type === 'select' && `[${f.options?.join(', ')}]`}
                          </p>
                        </div>
                      </div>
                      {!f.is_standard && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteField(f.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
  );
}
