import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

export default function EditOrder() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [taskOptions, setTaskOptions] = useState<Record<string, string[]>>({});
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [originalProject, setOriginalProject] = useState<any>(null);
  const [originalDetails, setOriginalDetails] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [showEditTypeDialog, setShowEditTypeDialog] = useState(false);

  useEffect(() => {
    async function loadData() {
      // 1. Load options and custom fields
      const [tasksRes, fieldsRes] = await Promise.all([
        supabase.from('reference_tasks').select('department, option_name'),
        supabase.from('order_form_fields').select('*').eq('is_standard', false).order('order_index')
      ]);

      if (fieldsRes.data) {
        setCustomFields(fieldsRes.data);
      }

      if (tasksRes.data) {
        const optionsMap: Record<string, Set<string>> = {};
        tasksRes.data.forEach(t => {
          if (t.option_name) {
            if (!optionsMap[t.department]) optionsMap[t.department] = new Set();
            optionsMap[t.department].add(t.option_name);
          }
        });
        const finalOptions: Record<string, string[]> = {};
        for (const [dept, set] of Object.entries(optionsMap)) {
          finalOptions[dept] = Array.from(set);
        }
        setTaskOptions(finalOptions);
      }

      // 2. Load order data
      if (id) {
        const { data: project, error: pError } = await supabase.from('projects').select('*').eq('id', id).single();
        if (pError) {
          toast.error('لا يمكن تحميل بيانات المشروع');
          setInitialLoading(false);
          return;
        }

        setOriginalProject(project);
        setOriginalDetails(project.product_details || {});

        const pd = project.product_details || {};
        
        let initialCustomFields: any = {};
        if (fieldsRes.data) {
          fieldsRes.data.forEach(f => {
            if (f.section_id === 'general') {
              initialCustomFields[f.field_key] = pd[f.field_key] || '';
            } else if (pd.services && pd.services[f.section_id]) {
              initialCustomFields[f.field_key] = pd.services[f.section_id][f.field_key] || '';
            } else {
              initialCustomFields[f.field_key] = '';
            }
          });
        }

        setFormData({
          ...initialCustomFields,
          clientName: project.client_name || '',
          brand: project.brand || '',
          manufactureYear: pd.manufactureYear || '',
          modelCode: project.model_code || '',
          deliveryDate: project.delivery_date ? project.delivery_date.split('T')[0] : '',
          totalCost: pd.totalCost?.toString() || '',
          depositAmount: pd.depositAmount?.toString() || '',
          priority: project.priority || 'عادي',
          notes: project.notes || '',

          hasPaint: !!pd.paint,
          paintWorkType: pd.paint?.workType || '',
          paintAreas: pd.paint?.areas || '',
          paintColors: pd.paint?.colors || '',
          paintType: pd.paint?.type || '',
          paintDetails: pd.paint?.details || '',
          paintImages: pd.paint?.images || [],
          paintPrice: pd.paint?.price?.toString() || '',

          hasUpholsteryRenovation: !!pd.upholstery_renovation,
          upholsteryWorkType: pd.upholstery_renovation?.workType || '',
          upholsterySpecs: pd.upholstery_renovation?.specs || '',
          upholsteryCapitoneType: pd.upholstery_renovation?.capitoneType || '',
          upholsteryThreadColor: pd.upholstery_renovation?.threadColor || '',
          upholsteryColors: pd.upholstery_renovation?.colors || '',
          upholsteryPieces: pd.upholstery_renovation?.piecesCount?.toString() || '',
          upholsteryColorCode: pd.upholstery_renovation?.colorCode || '',
          upholsteryImages: pd.upholstery_renovation?.images || [],
          upholsteryMainColor: pd.upholstery_renovation?.mainColor || '',
          upholsterySubColor: pd.upholstery_renovation?.subColor || '',
          upholsterySideColor: pd.upholstery_renovation?.sideColor || '',
          upholsteryFeltoColor: pd.upholstery_renovation?.feltoColor || '',
          upholsteryDescNotes: pd.upholstery_renovation?.descNotes || '',
          upholsteryLogoThreadColor: pd.upholstery_renovation?.logoThreadColor || '',
          upholsteryLogoPositions: pd.upholstery_renovation?.logoPositions || '',
          upholsteryLogoType: pd.upholstery_renovation?.logoType || '',
          upholsteryLogoFiles: pd.upholstery_renovation?.logoFiles || [],
          upholsteryPrice: pd.upholstery_renovation?.price?.toString() || '',
          hasUpholsteryManufacturing: !!pd.upholstery_manufacturing,
          uphManuWorkType: pd.upholstery_manufacturing?.workType || '',
          uphManuSpecs: pd.upholstery_manufacturing?.specs || '',
          uphManuCapitoneType: pd.upholstery_manufacturing?.capitoneType || '',
          uphManuThreadColor: pd.upholstery_manufacturing?.threadColor || '',
          uphManuColors: pd.upholstery_manufacturing?.colors || '',
          uphManuPieces: pd.upholstery_manufacturing?.piecesCount?.toString() || '',
          uphManuColorCode: pd.upholstery_manufacturing?.colorCode || '',
          uphManuImages: pd.upholstery_manufacturing?.images || [],
          uphManuMainColor: pd.upholstery_manufacturing?.mainColor || '',
          uphManuSubColor: pd.upholstery_manufacturing?.subColor || '',
          uphManuSideColor: pd.upholstery_manufacturing?.sideColor || '',
          uphManuFeltoColor: pd.upholstery_manufacturing?.feltoColor || '',
          uphManuDescNotes: pd.upholstery_manufacturing?.descNotes || '',
          uphManuLogoThreadColor: pd.upholstery_manufacturing?.logoThreadColor || '',
          uphManuLogoPositions: pd.upholstery_manufacturing?.logoPositions || '',
          uphManuLogoType: pd.upholstery_manufacturing?.logoType || '',
          uphManuLogoFiles: pd.upholstery_manufacturing?.logoFiles || [],
          uphManuPrice: pd.upholstery_manufacturing?.price?.toString() || '',

          hasFlooring: !!pd.flooring,
          flooringWorkType: pd.flooring?.workType || '',
          flooringMaterialType: pd.flooring?.materialType || '',
          flooringBoardsCount: pd.flooring?.boardsCount?.toString() || '',
          flooringTopColor: pd.flooring?.topColor || '',
          flooringMidColor: pd.flooring?.midColor || '',
          flooringBotColor: pd.flooring?.botColor || '',
          flooringBoatImages: pd.flooring?.boatImages || [],
          flooringDesignImages: pd.flooring?.designImages || [],
          flooringLogoDetails: pd.flooring?.logoDetails || '',
          flooringLogoFiles: pd.flooring?.logoFiles || [],
          flooringPrice: pd.flooring?.price?.toString() || '',

          hasGraphite: !!pd.graphite,
          graphiteWorkType: pd.graphite?.workType || '',
          graphiteDetails: pd.graphite?.details || '',
          graphiteDesignImages: pd.graphite?.designImages || [],
          graphiteLogoDetails: pd.graphite?.logoDetails || '',
          graphiteLogoFiles: pd.graphite?.logoFiles || [],
          graphitePrice: pd.graphite?.price?.toString() || '',

          hasElectric: !!pd.electric,
          elecWorkType: pd.electric?.workType || '',
          elecDetails: pd.electric?.details || '',
          elecPrice: pd.electric?.price?.toString() || '',

          hasAccessories: !!pd.accessories,
          accWorkType: pd.accessories?.workType || '',
          accDetails: pd.accessories?.details || '',
          accPrice: pd.accessories?.price?.toString() || '',

          hasSteel: !!pd.steel,
          steelWorkType: pd.steel?.workType || '',
          steelDetails: pd.steel?.details || '',
          steelPrice: pd.steel?.price?.toString() || '',

          hasCover: !!pd.cover,
          coverWorkType: pd.cover?.workType || '',
          coverRequirements: pd.cover?.requirements || '',
          coverCanopyMaterial: pd.cover?.canopyMaterial || '',
          coverMaterial: pd.cover?.material || '',
          coverPrice: pd.cover?.price?.toString() || '',

          hasEngine: !!pd.engine,
          engineWorkType: pd.engine?.workType || '',
          engineDetails: pd.engine?.details || '',
          enginePrice: pd.engine?.price?.toString() || '',
        });
      }
      setInitialLoading(false);
    }
    loadData();
  }, [id]);

  if (initialLoading) {
    return <div className="p-8 text-center">جاري تحميل بيانات الأوردر...</div>;
  }


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name: string, checked: boolean) => {
    setFormData((prev: any) => ({ ...prev, [name]: checked }));
  };

  const handleImagesChange = (name: string, urls: string[]) => {
    setFormData((prev: any) => ({ ...prev, [name]: urls }));
  };

  const renderWorkTypeSelect = (deptKey: string, fieldName: string, label: string) => {
    const options = taskOptions[deptKey] || [];
    if (options.length === 0) {
      return null;
    }
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select value={(formData as any)[fieldName]} onValueChange={(val) => setFormData((prev: any) => ({ ...prev, [fieldName]: val }))}>
          <SelectTrigger dir="rtl"><SelectValue placeholder="اختر المطلوب" /></SelectTrigger>
          <SelectContent dir="rtl">
            {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderCustomFields = (sectionId: string) => {
    const sectionFields = customFields.filter(f => f.section_id === sectionId);
    if (sectionFields.length === 0) return null;

    return sectionFields.map(f => {
      const value = (formData as any)[f.field_key] || '';
      return (
        <div key={f.id} className="space-y-2 col-span-full md:col-span-1">
          <Label>{f.field_label} {f.is_required && <span className="text-destructive">*</span>}</Label>
          {f.field_type === 'text' && (
            <Input 
              value={value} 
              onChange={e => setFormData((prev: any) => ({ ...prev, [f.field_key]: e.target.value }))} 
              required={f.is_required}
            />
          )}
          {f.field_type === 'textarea' && (
            <Textarea 
              value={value} 
              onChange={e => setFormData((prev: any) => ({ ...prev, [f.field_key]: e.target.value }))} 
              required={f.is_required}
            />
          )}
          {f.field_type === 'number' && (
            <Input 
              type="number"
              value={value} 
              onChange={e => setFormData((prev: any) => ({ ...prev, [f.field_key]: e.target.value }))} 
              required={f.is_required}
            />
          )}
          {f.field_type === 'date' && (
            <Input 
              type="date"
              value={value} 
              onChange={e => setFormData((prev: any) => ({ ...prev, [f.field_key]: e.target.value }))} 
              required={f.is_required}
              dir="ltr"
              className="text-right"
            />
          )}
          {f.field_type === 'select' && f.options && (
            <Select value={value} onValueChange={val => setFormData((prev: any) => ({ ...prev, [f.field_key]: val }))} required={f.is_required}>
              <SelectTrigger dir="rtl"><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent dir="rtl">
                {f.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {f.field_type === 'image' && (
            <ImageUpload 
              images={Array.isArray(value) ? value : []} 
              onChange={urls => setFormData((prev: any) => ({ ...prev, [f.field_key]: urls }))} 
            />
          )}
        </div>
      );
    });
  };

  const extractCustomFieldsData = (sectionId: string) => {
    const sectionFields = customFields.filter(f => f.section_id === sectionId);
    const data: Record<string, any> = {};
    sectionFields.forEach(f => {
      data[f.field_key] = (formData as any)[f.field_key];
    });
    return data;
  };

  const processSubmit = async (editType: 'direct' | 'approval') => {
    setLoading(true);
    setShowEditTypeDialog(false);
    try {
      const product_details = {
        manufactureYear: formData.manufactureYear,
        modelCode: formData.modelCode,
        totalCost: Number(formData.totalCost) || 0,
        depositAmount: Number(formData.depositAmount) || 0,
        services: {
          paint: formData.hasPaint ? {
            workType: formData.paintWorkType,
            areas: formData.paintAreas,
            colors: formData.paintColors,
            paintType: formData.paintType,
            newColorDetails: formData.paintNewColorDetails,
            images: formData.paintImages,
            price: Number(formData.paintPrice) || 0,
            ...extractCustomFieldsData('paint')
          } : null,
          upholstery_renovation: formData.hasUpholsteryRenovation ? {
            workType: formData.uphWorkType,
            specs: formData.uphSpecs,
            diamondType: formData.uphDiamondType,
            threadColor: formData.uphThreadColor,
            colors: formData.uphColors,
            piecesCount: formData.uphPiecesCount,
            colorCode: formData.uphColorCode,
            images: formData.uphImages,
            primaryColor: formData.uphPrimaryColor,
            secondaryColor: formData.uphSecondaryColor,
            sideColor: formData.uphSideColor,
            pipingColor: formData.uphPipingColor,
            notes: formData.uphNotes,
            logoEmbroideryColor: formData.uphLogoEmbroideryColor,
            logoPlaces: formData.uphLogoPlaces,
            logoType: formData.uphLogoType,
            logoImage: formData.uphLogoImage,
            price: Number(formData.uphPrice) || 0,
            ...extractCustomFieldsData('upholstery_renovation')
          } : null,
          upholstery_manufacturing: formData.hasUpholsteryManufacturing ? {
            workType: formData.uphManuWorkType,
            specs: formData.uphManuSpecs,
            diamondType: formData.uphManuDiamondType,
            threadColor: formData.uphManuThreadColor,
            colors: formData.uphManuColors,
            piecesCount: formData.uphManuPiecesCount,
            colorCode: formData.uphManuColorCode,
            images: formData.uphManuImages,
            primaryColor: formData.uphManuPrimaryColor,
            secondaryColor: formData.uphManuSecondaryColor,
            sideColor: formData.uphManuSideColor,
            pipingColor: formData.uphManuPipingColor,
            notes: formData.uphManuNotes,
            logoEmbroideryColor: formData.uphManuLogoEmbroideryColor,
            logoPlaces: formData.uphManuLogoPlaces,
            logoType: formData.uphManuLogoType,
            logoImage: formData.uphManuLogoImage,
            price: Number(formData.uphManuPrice) || 0,
            ...extractCustomFieldsData('upholstery_manufacturing')
          } : null,
          flooring: formData.hasFlooring ? {
            workType: formData.floorWorkType,
            materialType: formData.floorMaterialType,
            boardsCount: formData.floorBoardsCount,
            topColor: formData.floorTopColor,
            middleColor: formData.floorMiddleColor,
            bottomColor: formData.floorBottomColor,
            boatImages: formData.floorBoatImages,
            designImages: formData.floorDesignImages,
            hasLogo: formData.floorHasLogo,
            logoDetails: formData.floorLogoDetails,
            logoType: formData.floorLogoType,
            logoImage: formData.floorLogoImage,
            price: Number(formData.floorPrice) || 0,
            ...extractCustomFieldsData('flooring')
          } : null,
          graphite: formData.hasGraphite ? {
            workType: formData.graphiteWorkType,
            materialType: formData.graphMaterialType,
            boardsCount: formData.graphBoardsCount,
            topColor: formData.graphTopColor,
            middleColor: formData.graphMiddleColor,
            bottomColor: formData.graphBottomColor,
            designImages: formData.graphDesignImages,
            price: Number(formData.graphPrice) || 0,
            ...extractCustomFieldsData('graphite')
          } : null,
          electric: formData.hasElectric ? {
            workType: formData.elecWorkType,
            details: formData.elecDetails,
            price: Number(formData.elecPrice) || 0,
            ...extractCustomFieldsData('electric')
          } : null,
          accessories: formData.hasAccessories ? {
            workType: formData.accWorkType,
            details: formData.accDetails,
            price: Number(formData.accPrice) || 0,
            ...extractCustomFieldsData('accessories')
          } : null,
          steel: formData.hasSteel ? {
            workType: formData.steelWorkType,
            details: formData.steelDetails,
            price: Number(formData.steelPrice) || 0,
            ...extractCustomFieldsData('steel')
          } : null,
          cover: formData.hasCover ? {
            workType: formData.coverWorkType,
            requirements: formData.coverRequirements,
            canopyMaterial: formData.coverCanopyMaterial,
            coverMaterial: formData.coverMaterial,
            price: Number(formData.coverPrice) || 0,
            ...extractCustomFieldsData('cover')
          } : null,
          engine: formData.hasEngine ? {
            workType: formData.engineWorkType,
            details: formData.engineDetails,
            price: Number(formData.enginePrice) || 0,
            ...extractCustomFieldsData('engine')
          } : null,
        },
        ...extractCustomFieldsData('general')
      };

      const projectName = `${formData.clientName} - ${formData.brand}`;

      if (editType === 'direct') {
        // Direct update
        const { error: projectError } = await supabase
          .from('projects')
          .update({
            client_name: formData.clientName,
            name: projectName,
            delivery_date: formData.deliveryDate,
            brand: formData.brand,
            priority: formData.priority,
            notes: formData.notes,
            product_details,
          })
          .eq('id', originalProject.id);

        if (projectError) throw projectError;

        // Update Financials
        await supabase
          .from('project_financials')
          .update({
            price: Number(formData.totalCost) || 0,
            payment_terms: `مقدم: ${formData.depositAmount}`
          })
          .eq('project_id', originalProject.id);

        // Map toggles to tasks
        const activeDepartments: string[] = [];
        if (formData.hasPaint) activeDepartments.push('paint');
        if (formData.hasUpholsteryRenovation) activeDepartments.push('upholstery_renovation');
      if (formData.hasUpholsteryManufacturing) activeDepartments.push('upholstery_manufacturing');
        if (formData.hasFlooring || formData.hasGraphite) activeDepartments.push('flooring');
        if (formData.hasElectric) activeDepartments.push('electric');
        if (formData.hasSteel || formData.hasAccessories) activeDepartments.push('steel');
        if (formData.hasCover) activeDepartments.push('cover');
        if (formData.hasEngine) activeDepartments.push('engine');

        // Delete old tasks and recreate
        await supabase.from('project_tasks').delete().eq('project_id', originalProject.id);

        // Fetch base tasks
        const { data: refTasks, error: refError } = await supabase.from('reference_tasks').select('*');
        if (refError) throw refError;

        if (refTasks && refTasks.length > 0) {
          const deptOptions: Record<string, string[]> = {
            'paint': [formData.paintWorkType],
            'upholstery_renovation': [formData.uphWorkType],
            'upholstery_manufacturing': [formData.uphManuWorkType],
            'flooring': [formData.floorWorkType, formData.graphiteWorkType],
            'electric': [formData.elecWorkType],
            'steel': [formData.steelWorkType, formData.accWorkType],
            'cover': [formData.coverWorkType],
            'engine': [formData.engineWorkType]
          };

          const filteredTasks = refTasks.filter(rt => {
            if (!activeDepartments.includes(rt.department)) return false;
            if (!rt.option_name || rt.option_name.trim() === '') return true;
            const selectedForDept = deptOptions[rt.department] || [];
            return selectedForDept.includes(rt.option_name);
          });
          
          if (filteredTasks.length > 0) {
            const tasksToInsert = filteredTasks.map(rt => ({
              project_id: originalProject.id,
              task_id: rt.id,
              department: rt.department,
              name: rt.name,
              requires_quantity: rt.requires_quantity,
              order_index: rt.order_index,
              status: 'قيد الانتظار'
            }));
            await supabase.from('project_tasks').insert(tasksToInsert);
          }
        }

        // Notify
        const { data: profiles } = await supabase.from('profiles').select('id, department, phone').in('department', activeDepartments);
        if (profiles && profiles.length > 0) {
          const notificationsToInsert = profiles.map(p => ({
            user_id: p.id,
            title: 'تعديل أوردر',
            message: `تم تعديل الأوردر الجديد: ${projectName}`,
            link: `/projects/${originalProject.id}`
          }));
          await supabase.from('notifications').insert(notificationsToInsert);
          
          profiles.forEach(p => {
            if (p.phone) {
              supabase.functions.invoke('whatsapp-notification', {
                body: { phone: p.phone, message: `تم تعديل الأوردر الجديد: ${projectName}` }
              });
            }
          });
        }

        toast.success('تم التعديل بنجاح');
        navigate('/orders');
      } else {
        // Needs approval
        const { data: editReq, error: reqError } = await supabase
          .from('order_edit_requests')
          .insert({
            project_id: originalProject.id,
            requested_by: profile!.id,
            new_data: {
              client_name: formData.clientName,
              delivery_date: formData.deliveryDate,
              brand: formData.brand,
              priority: formData.priority,
              notes: formData.notes,
              totalCost: Number(formData.totalCost) || 0,
              depositAmount: Number(formData.depositAmount) || 0,
              product_details,
            }
          })
          .select()
          .single();

        if (reqError) throw reqError;

        const requiredApprovals = ['admin', 'quality', 'warehouse'];
        const oldPd = originalProject.product_details?.services || {};
        const newPd = product_details.services || {};
        
        ['paint', 'upholstery_renovation', 'upholstery_manufacturing', 'flooring', 'graphite', 'electric', 'accessories', 'steel', 'cover', 'engine'].forEach(dept => {
          if (JSON.stringify(oldPd[dept]) !== JSON.stringify(newPd[dept as keyof typeof newPd])) {
            requiredApprovals.push(dept);
          }
        });

        const approvalsToInsert = requiredApprovals.map(dept => ({
          request_id: editReq.id,
          department: dept
        }));

        await supabase.from('order_edit_approvals').insert(approvalsToInsert);

        toast.success('تم إرسال طلب تعديل الأوردر لانتظار الموافقات');
        navigate('/orders');
      }

    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error(error.message || 'حدث خطأ أثناء تعديل المشروع');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!formData.clientName || !formData.brand || !formData.deliveryDate) {
      toast.error('يرجى تعبئة الحقول الإجبارية (الاسم، البراند، تاريخ الاستلام)');
      return;
    }

    if (originalProject.status === 'جديد') {
      await processSubmit('direct');
    } else {
      setShowEditTypeDialog(true);
    }
  };

  if (!profile || (profile.department !== 'sales' && profile.department !== 'admin' && profile.department !== 'production_manager')) {
    return <div className="p-8 text-center text-muted-foreground">ليس لديك صلاحية.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">تعديل أوردر: {originalProject?.name}</h2>
        <p className="text-muted-foreground">تعديل طلبات الإنتاج والصيانة.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. General Info */}
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle>البيانات العامة</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="clientName">1- اسم العميل <span className="text-destructive">*</span></Label>
              <Input id="clientName" name="clientName" value={formData.clientName} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">2- براند المركب <span className="text-destructive">*</span></Label>
              <Input id="brand" name="brand" value={formData.brand} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufactureYear">3- سنة التصنيع</Label>
              <Input id="manufactureYear" name="manufactureYear" value={formData.manufactureYear} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelCode">4- كود الموديل</Label>
              <Input id="modelCode" name="modelCode" value={formData.modelCode} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">70- الميعاد المتوقع للاستلام <span className="text-destructive">*</span></Label>
              <Input id="deliveryDate" name="deliveryDate" type="date" value={formData.deliveryDate} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={formData.priority} onValueChange={(val) => handleSelectChange('priority', val)}>
                <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="عادي">عادي</SelectItem>
                  <SelectItem value="عاجل">عاجل</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalCost">إجمالي التكلفة</Label>
              <Input id="totalCost" name="totalCost" type="number" value={formData.totalCost} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositAmount">مبلغ التقديمة (المقدم)</Label>
              <Input id="depositAmount" name="depositAmount" type="number" value={formData.depositAmount} onChange={handleChange} />
            </div>
            <div className="col-span-full space-y-2">
              <Label htmlFor="notes">71- أي ملاحظات أخرى</Label>
              <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={2} />
            </div>
            {renderCustomFields('general')}
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {/* 2. Paint */}
          <AccordionItem value="paint" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الدهانات (Paint)</span>
                <Switch 
                  checked={formData.hasPaint} 
                  onCheckedChange={(c) => handleToggle('hasPaint', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasPaint && (
              <AccordionContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                {renderWorkTypeSelect('paint', 'paintWorkType', '6- نوع العمل المطلوب (يحدد المهام للفني)')}
                <div className="space-y-2">
                  <Label>7- تحديد المناطق للدهان</Label>
                  <Input name="paintAreas" value={formData.paintAreas} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>8- ألوان الدهان</Label>
                  <Input name="paintColors" value={formData.paintColors} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>9- نوع الدهان</Label>
                  <Input name="paintType" value={formData.paintType} onChange={handleChange} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>10- تفاصيل اللون الجديد</Label>
                  <Textarea name="paintNewColorDetails" value={formData.paintNewColorDetails} onChange={handleChange} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>11- إرفاق صور للتصميم</Label>
                  <ImageUpload images={formData.paintImages} onChange={(urls) => handleImagesChange('paintImages', urls)} />
                </div>
                <div className="space-y-2">
                  <Label>12- سعر بند الدهان</Label>
                  <Input name="paintPrice" type="number" value={formData.paintPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('paint')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 3. Upholstery */}
          <AccordionItem value="upholstery_renovation" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>الفرش التجديد (Upholstery Renovation)</span>
                <Switch 
                  checked={formData.hasUpholsteryRenovation} 
                  onCheckedChange={(c) => handleToggle('hasUpholsteryRenovation', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasUpholsteryRenovation && (
              <AccordionContent className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('upholstery_renovation', 'uphWorkType', 'نوع العمل المطلوب للفرش (يحدد المهام للفنيين)')}
                </div>
                <div className="col-span-full space-y-2">
                  <Label>14- مواصفات أعمال الفرش</Label>
                  <Textarea name="uphSpecs" value={formData.uphSpecs} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>15- نوع الكابوتنيه</Label>
                  <Input name="uphDiamondType" value={formData.uphDiamondType} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>16- لون الخيط</Label>
                  <Input name="uphThreadColor" value={formData.uphThreadColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>17- الألوان المطلوبة في التصميم</Label>
                  <Input name="uphColors" value={formData.uphColors} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>18- عدد القطع</Label>
                  <Input name="uphPiecesCount" type="number" value={formData.uphPiecesCount} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>19- كود اللون المطلوب</Label>
                  <Input name="uphColorCode" value={formData.uphColorCode} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>21- اللون الأساسي</Label>
                  <Input name="uphPrimaryColor" value={formData.uphPrimaryColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>22- اللون الفرعي</Label>
                  <Input name="uphSecondaryColor" value={formData.uphSecondaryColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>23- اللون الجانبي</Label>
                  <Input name="uphSideColor" value={formData.uphSideColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>24- لون الفلتو</Label>
                  <Input name="uphPipingColor" value={formData.uphPipingColor} onChange={handleChange} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>25- اختلاف الوصف عن الصورة وملاحظات</Label>
                  <Textarea name="uphNotes" value={formData.uphNotes} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>26- لون تطريزة اللوجو</Label>
                  <Input name="uphLogoEmbroideryColor" value={formData.uphLogoEmbroideryColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>27- أماكن اللوجو ووصفهم</Label>
                  <Input name="uphLogoPlaces" value={formData.uphLogoPlaces} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>28- لوجو خاص أم المصنعة؟</Label>
                  <Input name="uphLogoType" value={formData.uphLogoType} onChange={handleChange} />
                </div>
                <div className="col-span-full md:col-span-2 space-y-2">
                  <Label>20- رفع صورة للتصميم</Label>
                  <ImageUpload images={formData.uphImages} onChange={(urls) => handleImagesChange('uphImages', urls)} />
                </div>
                <div className="col-span-full md:col-span-1 space-y-2">
                  <Label>29- إضافة صورة اللوجو</Label>
                  <ImageUpload maxFiles={1} images={formData.uphLogoImage} onChange={(urls) => handleImagesChange('uphLogoImage', urls)} />
                </div>
                <div className="space-y-2">
                  <Label>30- سعر بند الفرش</Label>
                  <Input name="uphPrice" type="number" value={formData.uphPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('upholstery_renovation')}
              </AccordionContent>
            )}
          </AccordionItem>

<AccordionItem value="upholstery_manufacturing" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>الفرش تصنيع (Upholstery Manufacturing)</span>
                <Switch 
                  checked={formData.hasUpholsteryManufacturing} 
                  onCheckedChange={(c) => handleToggle('hasUpholsteryManufacturing', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasUpholsteryManufacturing && (
              <AccordionContent className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('upholstery_manufacturing', 'uphManuWorkType', 'نوع العمل المطلوب للفرش (يحدد المهام للفنيين)')}
                </div>
                <div className="col-span-full space-y-2">
                  <Label>14- مواصفات أعمال الفرش</Label>
                  <Textarea name="uphManuSpecs" value={formData.uphManuSpecs} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>15- نوع الكابوتنيه</Label>
                  <Input name="uphManuDiamondType" value={formData.uphManuDiamondType} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>16- لون الخيط</Label>
                  <Input name="uphManuThreadColor" value={formData.uphManuThreadColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>17- الألوان المطلوبة في التصميم</Label>
                  <Input name="uphManuColors" value={formData.uphManuColors} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>18- عدد القطع</Label>
                  <Input name="uphManuPiecesCount" type="number" value={formData.uphManuPiecesCount} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>19- كود اللون المطلوب</Label>
                  <Input name="uphManuColorCode" value={formData.uphManuColorCode} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>21- اللون الأساسي</Label>
                  <Input name="uphManuPrimaryColor" value={formData.uphManuPrimaryColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>22- اللون الفرعي</Label>
                  <Input name="uphManuSecondaryColor" value={formData.uphManuSecondaryColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>23- اللون الجانبي</Label>
                  <Input name="uphManuSideColor" value={formData.uphManuSideColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>24- لون الفلتو</Label>
                  <Input name="uphManuPipingColor" value={formData.uphManuPipingColor} onChange={handleChange} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>25- اختلاف الوصف عن الصورة وملاحظات</Label>
                  <Textarea name="uphManuNotes" value={formData.uphManuNotes} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>26- لون تطريزة اللوجو</Label>
                  <Input name="uphManuLogoEmbroideryColor" value={formData.uphManuLogoEmbroideryColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>27- أماكن اللوجو ووصفهم</Label>
                  <Input name="uphManuLogoPlaces" value={formData.uphManuLogoPlaces} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>28- لوجو خاص أم المصنعة؟</Label>
                  <Input name="uphManuLogoType" value={formData.uphManuLogoType} onChange={handleChange} />
                </div>
                <div className="col-span-full md:col-span-2 space-y-2">
                  <Label>20- رفع صورة للتصميم</Label>
                  <ImageUpload images={formData.uphManuImages} onChange={(urls) => handleImagesChange('uphImages', urls)} />
                </div>
                <div className="col-span-full md:col-span-1 space-y-2">
                  <Label>29- إضافة صورة اللوجو</Label>
                  <ImageUpload maxFiles={1} images={formData.uphManuLogoImage} onChange={(urls) => handleImagesChange('uphLogoImage', urls)} />
                </div>
                <div className="space-y-2">
                  <Label>30- سعر بند الفرش</Label>
                  <Input name="uphManuPrice" type="number" value={formData.uphManuPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('upholstery_manufacturing')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 4. Flooring */}
          <AccordionItem value="flooring" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الأرضيات (Flooring)</span>
                <Switch 
                  checked={formData.hasFlooring} 
                  onCheckedChange={(c) => handleToggle('hasFlooring', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasFlooring && (
              <AccordionContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('flooring', 'floorWorkType', 'نوع العمل المطلوب للأرضيات (يحدد المهام للفنيين)')}
                </div>
                <div className="space-y-2">
                  <Label>32- نوع الخامة</Label>
                  <Input name="floorMaterialType" value={formData.floorMaterialType} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>33- عدد الألواح المتوقعة (للتسعير)</Label>
                  <Input name="floorBoardsCount" type="number" value={formData.floorBoardsCount} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>34- لون الطبقة العلوية</Label>
                  <Input name="floorTopColor" value={formData.floorTopColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>35- لون الطبقة الوسطى</Label>
                  <Input name="floorMiddleColor" value={formData.floorMiddleColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>36- لون الطبقة السفلية</Label>
                  <Input name="floorBottomColor" value={formData.floorBottomColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>51- سعر الأرضية</Label>
                  <Input name="floorPrice" type="number" value={formData.floorPrice} onChange={handleChange} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>37 & 38- صور المركب كاملة</Label>
                  <ImageUpload images={formData.floorBoatImages} onChange={(urls) => handleImagesChange('floorBoatImages', urls)} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>39- صور تصميم الأرضية</Label>
                  <ImageUpload images={formData.floorDesignImages} onChange={(urls) => handleImagesChange('floorDesignImages', urls)} />
                </div>
                
                <div className="col-span-full p-4 border rounded-md bg-muted/20 space-y-4">
                  <div className="flex items-center gap-4">
                    <Label className="font-semibold">40- هل يوجد لوجو؟</Label>
                    <Switch checked={formData.floorHasLogo} onCheckedChange={(c) => handleToggle('floorHasLogo', c)} />
                  </div>
                  {formData.floorHasLogo && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>41- تفاصيل اللوجو</Label>
                        <Input name="floorLogoDetails" value={formData.floorLogoDetails} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <Label>42- لوجو خاص أم مصنعة؟</Label>
                        <Input name="floorLogoType" value={formData.floorLogoType} onChange={handleChange} />
                      </div>
                      <div className="col-span-full space-y-2">
                        <Label>43- صورة اللوجو</Label>
                        <ImageUpload maxFiles={1} images={formData.floorLogoImage} onChange={(urls) => handleImagesChange('floorLogoImage', urls)} />
                      </div>
                    </div>
                  )}
                </div>
                {renderCustomFields('flooring')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 5. Graphite */}
          <AccordionItem value="graphite" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الجرافيتو (Graphite)</span>
                <Switch 
                  checked={formData.hasGraphite} 
                  onCheckedChange={(c) => handleToggle('hasGraphite', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasGraphite && (
              <AccordionContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('flooring', 'graphiteWorkType', 'نوع العمل المطلوب للجرافيتو (يحدد المهام للفنيين)')}
                </div>
                <div className="space-y-2">
                  <Label>45- نوع الخامة</Label>
                  <Input name="graphMaterialType" value={formData.graphMaterialType} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>46- عدد الألواح المتوقعة</Label>
                  <Input name="graphBoardsCount" type="number" value={formData.graphBoardsCount} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>47- لون الطبقة العلوية</Label>
                  <Input name="graphTopColor" value={formData.graphTopColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>48- لون الطبقة الوسطى</Label>
                  <Input name="graphMiddleColor" value={formData.graphMiddleColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>49- لون الطبقة السفلية</Label>
                  <Input name="graphBottomColor" value={formData.graphBottomColor} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>52- سعر الجرافيتو</Label>
                  <Input name="graphPrice" type="number" value={formData.graphPrice} onChange={handleChange} />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>50- صور تصميم الجرافيتو</Label>
                  <ImageUpload images={formData.graphDesignImages} onChange={(urls) => handleImagesChange('graphDesignImages', urls)} />
                </div>
                {renderCustomFields('graphite')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 6. Electric */}
          <AccordionItem value="electric" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الكهرباء (Electric)</span>
                <Switch 
                  checked={formData.hasElectric} 
                  onCheckedChange={(c) => handleToggle('hasElectric', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasElectric && (
              <AccordionContent className="grid gap-4 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('electric', 'elecWorkType', 'نوع العمل المطلوب للكهرباء (يحدد المهام للفنيين)')}
                </div>
                <div className="space-y-2">
                  <Label>54- تفاصيل المطلوب للكهرباء</Label>
                  <Textarea name="elecDetails" value={formData.elecDetails} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>55- سعر بند الكهرباء</Label>
                  <Input name="elecPrice" type="number" value={formData.elecPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('electric')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 7. Accessories */}
          <AccordionItem value="accessories" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الإكسسوارات (Accessories)</span>
                <Switch 
                  checked={formData.hasAccessories} 
                  onCheckedChange={(c) => handleToggle('hasAccessories', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasAccessories && (
              <AccordionContent className="grid gap-4 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('steel', 'accWorkType', 'نوع العمل المطلوب للإكسسوارات (يحدد المهام للفنيين)')}
                </div>
                <div className="space-y-2">
                  <Label>57- تفاصيل الإكسسوارات المطلوبة</Label>
                  <Textarea name="accDetails" value={formData.accDetails} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>58- سعر بند الإكسسوارات</Label>
                  <Input name="accPrice" type="number" value={formData.accPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('accessories')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 8. Steel */}
          <AccordionItem value="steel" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند المعادن والاستيل (Steel)</span>
                <Switch 
                  checked={formData.hasSteel} 
                  onCheckedChange={(c) => handleToggle('hasSteel', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasSteel && (
              <AccordionContent className="grid gap-4 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('steel', 'steelWorkType', 'نوع العمل المطلوب للاستيل (يحدد المهام للفنيين)')}
                </div>
                <div className="space-y-2">
                  <Label>60- تفاصيل المطلوب للاستيل</Label>
                  <Textarea name="steelDetails" value={formData.steelDetails} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>61- سعر بند الاستيل</Label>
                  <Input name="steelPrice" type="number" value={formData.steelPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('steel')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 9. Cover */}
          <AccordionItem value="cover" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الغطاء / التندة (Cover)</span>
                <Switch 
                  checked={formData.hasCover} 
                  onCheckedChange={(c) => handleToggle('hasCover', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasCover && (
              <AccordionContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('cover', 'coverWorkType', 'نوع العمل المطلوب للغطاء/التندة (يحدد المهام للفنيين)')}
                </div>
                <div className="col-span-full space-y-2">
                  <Label>63- اختيار المطلوب</Label>
                  <Input name="coverRequirements" value={formData.coverRequirements} onChange={handleChange} placeholder="تندة، كفر خارجي، كفر كراسي..." />
                </div>
                <div className="space-y-2">
                  <Label>64- خامة التندة</Label>
                  <Input name="coverCanopyMaterial" value={formData.coverCanopyMaterial} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>65- خامة الـ Cover</Label>
                  <Input name="coverMaterial" value={formData.coverMaterial} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>66- سعر البند</Label>
                  <Input name="coverPrice" type="number" value={formData.coverPrice} onChange={handleChange} />
                </div>
                {renderCustomFields('cover')}
              </AccordionContent>
            )}
          </AccordionItem>

          {/* 10. Engine */}
          <AccordionItem value="engine" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <span>بند الموتور والصيانة (Engine)</span>
                <Switch 
                  checked={formData.hasEngine} 
                  onCheckedChange={(c) => handleToggle('hasEngine', c)} 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </AccordionTrigger>
            {formData.hasEngine && (
              <AccordionContent className="grid gap-4 pt-4 border-t">
                <div className="col-span-full">
                  {renderWorkTypeSelect('engine', 'engineWorkType', 'نوع العمل المطلوب للموتور والصيانة (يحدد المهام للفنيين)')}
                </div>
                <div className="space-y-2">
                  <Label>68- تفاصيل الموتور/الصيانة</Label>
                  <Textarea name="engineDetails" value={formData.engineDetails} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>69- سعر الموتور/الصيانة</Label>
                  <Input name="enginePrice" type="number" value={formData.enginePrice} onChange={handleChange} />
                </div>
                {renderCustomFields('engine')}
              </AccordionContent>
            )}
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>إلغاء</Button>
          <Button type="submit" disabled={loading} className="w-48 text-lg font-bold">
            {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </form>

      <Dialog open={showEditTypeDialog} onOpenChange={setShowEditTypeDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>خيارات حفظ التعديل</DialogTitle>
            <DialogDescription>
              الرجاء اختيار طريقة حفظ التعديل على هذا الأوردر
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button variant="outline" onClick={() => processSubmit('approval')} className="h-auto p-4 flex flex-col items-start gap-2">
              <span className="font-bold">العرض على الأقسام للموافقة</span>
              <span className="text-sm font-normal text-muted-foreground text-right">
                سيتم إرسال طلب للأقسام المعنية (مثل الجودة، المخازن، الأقسام الفنية المتأثرة) ولن يطبق التعديل إلا بعد موافقة الجميع.
              </span>
            </Button>
            <Button variant="default" onClick={() => processSubmit('direct')} className="h-auto p-4 flex flex-col items-start gap-2">
              <span className="font-bold text-primary-foreground">تعديل مباشر (إجباري)</span>
              <span className="text-sm font-normal text-primary-foreground/80 text-right">
                سيتم تطبيق التعديلات فوراً وتحديث الأوردر وإرسال إشعار للأقسام المعنية.
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
