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
import { Plus, Minus, FileText, Search, Image as ImageIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, Upload as UploadIcon, FileDown } from 'lucide-react';

export default function WarehouseDashboard() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add new item dialog
  const [newItemDialog, setNewItemDialog] = useState(false);
  const [newItem, setNewItem] = useState({ code: '', name: '', min_threshold: 10, reorder_qty: 50, supplier_name: '', supplier_phone: '' });

  // Transaction dialog
  const [transactionDialog, setTransactionDialog] = useState<{ open: boolean; type: 'in' | 'out'; item: any | null }>({ open: false, type: 'in', item: null });
  const [transactionData, setTransactionData] = useState({ quantity: 1, method: 'manual', ocrImage: null as File | null, ocrText: '' });
  const [processingTransaction, setProcessingTransaction] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء جلب بيانات المخزون');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!newItem.code || !newItem.name) {
      toast.error('كود واسم الخامة مطلوبان');
      return;
    }
    try {
      const { error } = await supabase.from('inventory_items').insert([newItem]);
      if (error) throw error;
      toast.success('تمت الإضافة بنجاح');
      setNewItemDialog(false);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'خطأ أثناء الإضافة');
    }
  };

  const processOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result as string;
        const { data, error } = await supabase.functions.invoke("ocr-parse-image", {
          body: { base64Image, language: "ara" },
        });
        
        if (error) throw error;
        if (data.IsErroredOnProcessing) throw new Error(data.ParsedResults?.[0]?.ErrorMessage);
        
        const text = data.ParsedResults?.[0]?.ParsedText || '';
        setTransactionData(prev => ({ ...prev, ocrText: text }));
        toast.success('تم استخراج النص، يرجى مراجعته واستخراج الكمية');
        setOcrLoading(false);
      };
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء قراءة الصورة');
      setOcrLoading(false);
    }
  };

  const handleTransaction = async () => {
    if (!transactionDialog.item) return;
    if (transactionData.quantity <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    if (transactionDialog.type === 'out' && transactionData.quantity > transactionDialog.item.balance) {
      toast.error('الكمية المنصرفة أكبر من الرصيد المتاح');
      return;
    }

    setProcessingTransaction(true);
    try {
      let imageUrl = null;
      if (transactionData.ocrImage) {
        // Upload image to storage
        const ext = transactionData.ocrImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-files') // Reusing existing bucket
          .upload(`inventory/${fileName}`, transactionData.ocrImage);
          
        if (!uploadError && uploadData) {
          const { data } = supabase.storage.from('project-files').getPublicUrl(uploadData.path);
          imageUrl = data.publicUrl;
        }
      }

      const { error } = await supabase.from('inventory_transactions').insert([{
        item_id: transactionDialog.item.id,
        type: transactionDialog.type,
        quantity: transactionData.quantity,
        user_id: profile?.id,
        document_url: imageUrl,
        ocr_text: transactionData.ocrText
      }]);

      if (error) throw error;
      
      toast.success(transactionDialog.type === 'in' ? 'تمت إضافة الكمية بنجاح' : 'تم صرف الكمية بنجاح');
      setTransactionDialog({ open: false, type: 'in', item: null });
      setTransactionData({ quantity: 1, method: 'manual', ocrImage: null, ocrText: '' });
      fetchItems();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ أثناء تنفيذ العملية');
    } finally {
      setProcessingTransaction(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.includes(search) || item.code.includes(search)
  );

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredItems.map(item => ({
        'الكود': item.code,
        'الاسم': item.name,
        'الرصيد': item.balance,
        'الحد الأدنى': item.min_threshold,
        'المورد': item.supplier_name || '-',
        'كمية إعادة الطلب': item.reorder_qty || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'المخزون');
      
      XLSX.writeFile(workbook, 'المخزون.xlsx');
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  const handleExportPDF = () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      // For Arabic support in jsPDF, we either need a custom font or use a simple fallback.
      // jsPDF autoTable doesn't support Arabic text out of the box unless we load a custom font.
      // But we will use the standard table to generate it.
      
      pdf.text('Inventory Report', 14, 15);
      
      const tableData = filteredItems.map(item => [
        item.code,
        item.name, // Note: Arabic might not render correctly without custom font in jsPDF text, but we'll try
        item.balance.toString(),
        item.min_threshold.toString(),
        item.supplier_name || '-'
      ]);

      (pdf as any).autoTable({
        head: [['Code', 'Name', 'Balance', 'Min Threshold', 'Supplier']],
        body: tableData,
        startY: 20,
        styles: { font: 'helvetica', fontSize: 10 },
      });
      
      pdf.save('Inventory.pdf');
      toast.success('تم تصدير PDF بنجاح');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('حدث خطأ أثناء تصدير PDF');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info('جاري معالجة الملف...');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      for (const row of jsonData) {
        // Map Arabic/English columns to database fields
        const code = row['الكود'] || row['Code'] || row['code'] || String(Math.random()).substring(2, 8);
        const name = row['الاسم'] || row['Name'] || row['name'];
        const balance = parseInt(row['الرصيد'] || row['Balance'] || row['balance'] || 0, 10);
        const min_threshold = parseInt(row['الحد الأدنى'] || row['Min Threshold'] || 10, 10);
        const supplier_name = row['المورد'] || row['Supplier'] || '';

        if (!name) continue; // Skip rows without name

        // Check if item exists
        const { data: existing } = await supabase.from('inventory_items').select('id, balance').eq('code', code).maybeSingle();
        
        if (existing) {
          // Update balance if it's imported
          await supabase.from('inventory_items').update({
            balance: existing.balance + balance,
            min_threshold,
            supplier_name
          }).eq('id', existing.id);
          successCount++;
        } else {
          // Insert new
          const { error } = await supabase.from('inventory_items').insert({
            code: String(code),
            name: String(name),
            balance: isNaN(balance) ? 0 : balance,
            min_threshold: isNaN(min_threshold) ? 10 : min_threshold,
            supplier_name: String(supplier_name),
            reorder_qty: 50
          });
          if (!error) successCount++;
        }
      }

      toast.success(`تم استيراد/تحديث ${successCount} صنف بنجاح`);
      fetchItems();
    } catch (err) {
      console.error('Error importing Excel:', err);
      toast.error('حدث خطأ أثناء معالجة ملف الإكسل. يرجى التأكد من التنسيق.');
    }
    
    // Reset file input
    if (e.target) e.target.value = '';
  };

  const canManage = profile?.role === 'admin' || profile?.department === 'warehouse';

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">إدارة المخزون</h2>
          <p className="text-muted-foreground">رصيد الخامات، الإضافة والصرف.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث بالكود أو الاسم..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-3 pr-9 w-full md:w-64"
            />
          </div>
          
          <Button variant="outline" onClick={handleExportExcel} title="تصدير لـ Excel">
            <Download className="h-4 w-4 ml-1" /> إكسل
          </Button>
          <Button variant="outline" onClick={handleExportPDF} title="تصدير لـ PDF">
            <FileDown className="h-4 w-4 ml-1" /> PDF
          </Button>

          {canManage && (
            <>
              <div className="relative">
                <Input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleImportExcel} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="رفع ملف إكسل"
                />
                <Button variant="outline" asChild>
                  <span><UploadIcon className="h-4 w-4 ml-1" /> استيراد</span>
                </Button>
              </div>
              <Button onClick={() => setNewItemDialog(true)}>
                <Plus className="ml-2 h-4 w-4" />
                صنف جديد
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <div className="w-full max-w-full overflow-x-auto bg-card">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الكود</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الاسم</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الرصيد</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">الحد الأدنى</th>
                    <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">المورد</th>
                    {canManage && <th className="p-3 font-medium text-muted-foreground whitespace-nowrap">إجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد أصناف مطابقة</td></tr>
                  ) : filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium whitespace-nowrap">{item.code}</td>
                      <td className="p-3 whitespace-nowrap">{item.name}</td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant={item.balance <= item.min_threshold ? "destructive" : "secondary"}>
                          {item.balance}
                        </Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap">{item.min_threshold}</td>
                      <td className="p-3 whitespace-nowrap">{item.supplier_name || '-'}</td>
                      {canManage && (
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setTransactionDialog({ open: true, type: 'in', item })}>
                              <Plus className="h-4 w-4 ml-1" /> إضافة
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setTransactionDialog({ open: true, type: 'out', item })}>
                              <Minus className="h-4 w-4 ml-1" /> صرف
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={newItemDialog} onOpenChange={setNewItemDialog}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة صنف جديد</DialogTitle>
            <DialogDescription className="sr-only">إضافة صنف جديد للمخزن</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>كود الصنف</Label>
              <Input value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} dir="ltr" className="text-right" />
            </div>
            <div className="space-y-2">
              <Label>اسم الصنف</Label>
              <Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>الحد الأدنى (تنبيه الشراء)</Label>
              <Input type="number" value={newItem.min_threshold} onChange={e => setNewItem({...newItem, min_threshold: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label>كمية إعادة الطلب التلقائية</Label>
              <Input type="number" value={newItem.reorder_qty} onChange={e => setNewItem({...newItem, reorder_qty: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>اسم المورد</Label>
              <Input value={newItem.supplier_name} onChange={e => setNewItem({...newItem, supplier_name: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewItemDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreateItem}>إضافة الصنف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transactionDialog.open} onOpenChange={(open) => !open && setTransactionDialog({...transactionDialog, open: false})}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-2rem)] md:max-w-xl">
          <DialogHeader>
            <DialogTitle>{transactionDialog.type === 'in' ? 'إضافة رصيد' : 'صرف خامة'}: {transactionDialog.item?.name}</DialogTitle>
            <DialogDescription>
              الرصيد الحالي: {transactionDialog.item?.balance}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>طريقة الإدخال</Label>
              <Select value={transactionData.method} onValueChange={v => setTransactionData({...transactionData, method: v})}>
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="manual">إدخال يدوي</SelectItem>
                  <SelectItem value="ocr">إضافة صورة الإذن (استخراج النص)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {transactionData.method === 'ocr' && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                <div className="space-y-2">
                  <Label>صورة إذن {transactionDialog.type === 'in' ? 'الإضافة' : 'الصرف'}</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setTransactionData({...transactionData, ocrImage: file});
                          processOCR(file);
                        }
                      }} 
                    />
                  </div>
                </div>

                {ocrLoading && <div className="text-sm text-primary animate-pulse">جاري قراءة الصورة...</div>}
                
                {transactionData.ocrText && (
                  <div className="space-y-2">
                    <Label>النص المستخرج (راجع واستخرج الكمية)</Label>
                    <textarea 
                      className="w-full min-h-24 p-2 text-sm border rounded-md bg-background"
                      value={transactionData.ocrText}
                      readOnly
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>الكمية {transactionDialog.type === 'in' ? 'المضافة' : 'المنصرفة'}</Label>
              <Input 
                type="number" 
                min="1" 
                value={transactionData.quantity} 
                onChange={e => setTransactionData({...transactionData, quantity: parseInt(e.target.value) || 0})} 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionDialog({...transactionDialog, open: false})}>إلغاء</Button>
            <Button onClick={handleTransaction} disabled={processingTransaction}>
              {processingTransaction ? 'جاري التنفيذ...' : 'تأكيد العملية'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}