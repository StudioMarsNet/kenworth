"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Truck, Eye, RefreshCw, Download, Upload, ChevronDown, ChevronRight, ImageIcon, FileUp, X, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";

const ALL_STATUS_KW = ["Devuelta","Facturada","Impresa","Parcialmente Devuelta","Parcialmente Devuelta y Parcialmente Facturada","Parcialmente Facturada","Sin Imprimir"];

type RescueEvent = {
  id: number; fecha: string; folio_interno: string; tipo: "RESCATE"|"MTTO";
  destino: string; tecnico: string; unidad: string; bisonte: string; kw: string;
  vales: string; observaciones: string; imagen_url: string;
  num_items: number; total_pendiente: number; ventas_count: number;
};

type RescueItem = {
  id: number; event_id: number; numero_articulo: string; descripcion: string;
  cantidad_entregada: number; cantidad_devuelta: number; cantidad_usada: number; cantidad_pendiente: number;
  status_bisonte: string; status_kw: string; estado_venta: string;
};

type PricingItem = { numero_articulo: string; descripcion: string; existencia: number; };

const EMPTY_EVENT = { fecha: new Date().toISOString().slice(0,10), tipo:"RESCATE" as const, folio_interno:"", destino:"", tecnico:"", unidad:"", bisonte:"", kw:"", vales:"", observaciones:"", imagen_url:"" };
const EMPTY_ITEM = { numero_articulo:"", descripcion:"", cantidad_entregada:0, cantidad_devuelta:0, cantidad_usada:0, cantidad_pendiente:0, status_bisonte:"", status_kw:"" };

function skwBadge(s:string){
  if(!s) return <Badge variant="secondary" className="text-xs">—</Badge>;
  const v=s.toLowerCase();
  if(v==="facturada") return <Badge className="bg-green-500/15 text-green-400 border border-green-500/30 text-xs">{s}</Badge>;
  if(v==="devuelta") return <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">{s}</Badge>;
  if(v==="impresa") return <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs">{s}</Badge>;
  if(v==="sin imprimir") return <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs">{s}</Badge>;
  if(v.includes("parcialmente")) return <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs">Parcial</Badge>;
  return <Badge variant="outline" className="text-xs">{s}</Badge>;
}

function tipoChip(t:string){ return t==="RESCATE"
  ? <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">{t}</span>
  : <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">{t}</span>;
}

export default function RescuesPage(){
  const [events,setEvents]=useState<RescueEvent[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(false);
  const [q,setQ]=useState("");
  const [filterTipo,setFilterTipo]=useState("all");
  const [filterFechaDesde,setFilterFechaDesde]=useState("");
  const [filterFechaHasta,setFilterFechaHasta]=useState("");
  const [expanded,setExpanded]=useState<Record<number,boolean>>({});
  const [items,setItems]=useState<Record<number,RescueItem[]>>({});
  const [loadingItems,setLoadingItems]=useState<Record<number,boolean>>({});
  const [showEventForm,setShowEventForm]=useState(false);
  const [editingEvent,setEditingEvent]=useState<RescueEvent|null>(null);
  const [eventForm,setEventForm]=useState<{fecha:string;tipo:"RESCATE"|"MTTO";folio_interno:string;destino:string;tecnico:string;unidad:string;bisonte:string;kw:string;vales:string;observaciones:string;imagen_url:string}>(EMPTY_EVENT);
  const [formItems,setFormItems]=useState<typeof EMPTY_ITEM[]>([]);
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState("");
  const [deleteTarget,setDeleteTarget]=useState<RescueEvent|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [showCsvModal,setShowCsvModal]=useState(false);
  const [csvEvent,setCsvEvent]=useState<RescueEvent|null>(null);
  const [csvFile,setCsvFile]=useState<File|null>(null);
  const [csvEventForm,setCsvEventForm]=useState<{fecha:string;tipo:"RESCATE"|"MTTO";folio_interno:string;destino:string;tecnico:string;unidad:string;bisonte:string;kw:string;vales:string;observaciones:string;imagen_url:string}>(EMPTY_EVENT);
  const [csvPreview,setCsvPreview]=useState<string[][]>([]);
  const [csvUploading,setCsvUploading]=useState(false);
  const [showImageModal,setShowImageModal]=useState(false);
  const [imageEvent,setImageEvent]=useState<RescueEvent|null>(null);
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [imagePreview,setImagePreview]=useState("");
  const [imageUploading,setImageUploading]=useState(false);
  const [skuSearch,setSkuSearch]=useState("");
  const [skuResults,setSkuResults]=useState<PricingItem[]>([]);
  const [skuLoading,setSkuLoading]=useState(false);
  const [inlineEdit,setInlineEdit]=useState<Record<number,{status_kw:string;status_bisonte:string}>>({});
  const [savingItem,setSavingItem]=useState<Record<number,boolean>>({});
  const LIMIT=20;

  const fetchEvents=useCallback(async()=>{
    setLoading(true);
    const p=new URLSearchParams({page:String(page),limit:String(LIMIT)});
    if(q) p.set("q",q);
    if(filterTipo!=="all") p.set("tipo",filterTipo);
    if(filterFechaDesde) p.set("fecha_desde",filterFechaDesde);
    if(filterFechaHasta) p.set("fecha_hasta",filterFechaHasta);
    try{
      const r=await fetch(`/api/rescue-events?${p}`);
      const j=await r.json();
      if(j.success){setEvents(j.data);setTotal(j.pagination.total);}
    }finally{setLoading(false);}
  },[page,q,filterTipo,filterFechaDesde,filterFechaHasta]);

  useEffect(()=>{fetchEvents();},[fetchEvents]);

  const toggleExpand=async(id:number)=>{
    const next=!expanded[id];
    setExpanded(prev=>({...prev,[id]:next}));
    if(next && !items[id]){
      setLoadingItems(prev=>({...prev,[id]:true}));
      const r=await fetch(`/api/rescue-events/${id}`);
      const j=await r.json();
      if(j.success) setItems(prev=>({...prev,[id]:j.data.items}));
      setLoadingItems(prev=>({...prev,[id]:false}));
    }
  };

  const openCreate=()=>{ setEditingEvent(null); setEventForm(EMPTY_EVENT); setFormItems([{...EMPTY_ITEM}]); setFormError(""); setShowEventForm(true); };
  const openEdit=(e:RescueEvent)=>{ setEditingEvent(e); setEventForm({fecha:e.fecha?.slice(0,10)||"",tipo:e.tipo,folio_interno:e.folio_interno||"",destino:e.destino||"",tecnico:e.tecnico||"",unidad:e.unidad||"",bisonte:e.bisonte||"",kw:e.kw||"",vales:e.vales||"",observaciones:e.observaciones||"",imagen_url:e.imagen_url||""}); setFormItems([]); setFormError(""); setShowEventForm(true); };

  const addFormItem=()=>setFormItems(prev=>[...prev,{...EMPTY_ITEM}]);
  const removeFormItem=(i:number)=>setFormItems(prev=>prev.filter((_,idx)=>idx!==i));
  const updateFormItem=(i:number,k:string,v:any)=>setFormItems(prev=>prev.map((item,idx)=>idx===i?{...item,[k]:v}:item));

  const handleSaveEvent=async()=>{
    setSaving(true); setFormError("");
    try{
      const url=editingEvent?`/api/rescue-events/${editingEvent.id}`:"/api/rescue-events";
      const method=editingEvent?"PUT":"POST";
      const body=editingEvent?eventForm:{event:eventForm,items:formItems};
      const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const j=await r.json();
      if(!j.success){setFormError(String(j.error));return;}
      setShowEventForm(false); fetchEvents();
    }catch(e:any){setFormError(e.message);}
    finally{setSaving(false);}
  };

  const handleDelete=async()=>{
    if(!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/rescue-events/${deleteTarget.id}`,{method:"DELETE"});
    setDeleting(false); setDeleteTarget(null); fetchEvents();
  };

  // Inline item status save
  const saveItemStatus=async(eventId:number,item:RescueItem)=>{
    const edit=inlineEdit[item.id];
    if(!edit) return;
    setSavingItem(prev=>({...prev,[item.id]:true}));
    await fetch(`/api/rescue-events/${eventId}/items/${item.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status_kw:edit.status_kw,status_bisonte:edit.status_bisonte})});
    setItems(prev=>({...prev,[eventId]:prev[eventId].map(i=>i.id===item.id?{...i,...edit}:i)}));
    setInlineEdit(prev=>{const n={...prev};delete n[item.id];return n;});
    setSavingItem(prev=>({...prev,[item.id]:false}));
  };

  const deleteItem=async(eventId:number,itemId:number)=>{
    await fetch(`/api/rescue-events/${eventId}/items/${itemId}`,{method:"DELETE"});
    setItems(prev=>({...prev,[eventId]:prev[eventId].filter(i=>i.id!==itemId)}));
    setEvents(prev=>prev.map(e=>e.id===eventId?{...e,num_items:e.num_items-1}:e));
  };

  // SKU search
  const searchSku=useCallback(async(term:string)=>{
    if(!term||term.length<2){setSkuResults([]);return;}
    setSkuLoading(true);
    try{const r=await fetch(`/api/precios?search=${encodeURIComponent(term)}`);const j=await r.json();if(j.success)setSkuResults(j.data.slice(0,8));}
    finally{setSkuLoading(false);}
  },[]);

  useEffect(()=>{const t=setTimeout(()=>searchSku(skuSearch),300);return()=>clearTimeout(t);},[skuSearch,searchSku]);

  // CSV handlers
  const handleCsvFile=(file:File)=>{
    setCsvFile(file);
    const reader=new FileReader();
    reader.onload=e=>{
      const text=e.target?.result as string;
      const lines=text.split(/\r?\n/).filter(l=>l.trim()).slice(0,6);
      setCsvPreview(lines.map(l=>l.split(",").map(c=>c.replace(/^"|"$/g,"").slice(0,30))));
    };
    reader.readAsText(file);
  };

  const handleCsvUpload=async()=>{
    if(!csvFile) return;
    setCsvUploading(true);
    try{
      const fd=new FormData();
      fd.append("file",csvFile);
      Object.entries(csvEventForm).forEach(([k,v])=>{if(v) fd.append(k,String(v));});
      const r=await fetch("/api/rescue-events/bulk-csv",{method:"POST",body:fd});
      const j=await r.json();
      if(!j.success){alert("Error: "+j.error);return;}
      alert(`✅ Evento creado con ${j.data.items_created} artículos`);
      setShowCsvModal(false); setCsvFile(null); setCsvPreview([]); fetchEvents();
    }catch(e:any){alert("Error: "+e.message);}
    finally{setCsvUploading(false);}
  };

  // Image upload
  const handleImageUpload=async()=>{
    if(!imageFile||!imageEvent) return;
    setImageUploading(true);
    try{
      const fd=new FormData();
      fd.append("file",imageFile);
      fd.append("event_id",String(imageEvent.id));
      const r=await fetch("/api/rescue-events/upload-image",{method:"POST",body:fd});
      const j=await r.json();
      if(!j.success){alert("Error: "+j.error);return;}
      setEvents(prev=>prev.map(e=>e.id===imageEvent.id?{...e,imagen_url:j.data.url}:e));
      alert("✅ Imagen subida a Cloudinary");
      setShowImageModal(false); setImageFile(null); setImagePreview("");
    }catch(e:any){alert("Error: "+e.message);}
    finally{setImageUploading(false);}
  };

  const pages=Math.ceil(total/LIMIT);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20"><Truck className="h-6 w-6 text-red-400"/></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Rescates</h1>
          <p className="text-sm text-muted-foreground">Bisonte SLP · Consigna Kenworth — {total.toLocaleString()} eventos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:"Total eventos",val:total,c:"text-foreground"},
          {label:"RESCATE",val:events.filter(e=>e.tipo==="RESCATE").length,c:"text-red-400"},
          {label:"MTTO",val:events.filter(e=>e.tipo==="MTTO").length,c:"text-blue-400"},
          {label:"Con imagen",val:events.filter(e=>e.imagen_url).length,c:"text-green-400"},
        ].map(s=>(
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Buscar folio, destino, técnico, SKU…" className="pl-9" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/>
        </div>
        <Select value={filterTipo} onValueChange={v=>{setFilterTipo(v);setPage(1);}}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo"/></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="RESCATE">RESCATE</SelectItem><SelectItem value="MTTO">MTTO</SelectItem></SelectContent>
        </Select>
        <Input type="date" className="w-36" value={filterFechaDesde} onChange={e=>{setFilterFechaDesde(e.target.value);setPage(1);}}/>
        <Input type="date" className="w-36" value={filterFechaHasta} onChange={e=>{setFilterFechaHasta(e.target.value);setPage(1);}}/>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={fetchEvents}><RefreshCw className="h-4 w-4"/></Button>
          <Button variant="outline" onClick={()=>{setCsvEvent(null);setCsvEventForm(EMPTY_EVENT);setCsvFile(null);setCsvPreview([]);setShowCsvModal(true);}}><FileUp className="h-4 w-4 mr-1"/>CSV</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1"/>Nuevo evento</Button>
        </div>
      </div>

      {/* Events accordion table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="w-8 px-2 py-2.5"/>
              {["Fecha","Folio","Tipo","Destino","Técnico","Unidad","Artículos","Pendiente","Imagen","Acciones"].map(h=>(
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={11} className="text-center py-16 text-muted-foreground">Cargando…</td></tr>
            ):events.length===0?(
              <tr><td colSpan={11} className="text-center py-16 text-muted-foreground">Sin resultados. Carga un CSV o crea un evento.</td></tr>
            ):events.map(ev=>(
              <>
                <tr key={ev.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={()=>toggleExpand(ev.id)}>
                  <td className="px-2 py-2 text-muted-foreground">{expanded[ev.id]?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{ev.fecha?.slice(0,10)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{ev.folio_interno||"—"}</td>
                  <td className="px-3 py-2">{tipoChip(ev.tipo)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{ev.destino||"—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{ev.tecnico||"—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{ev.unidad||"—"}</td>
                  <td className="px-3 py-2 text-center"><Badge variant="outline" className="text-xs">{ev.num_items||0}</Badge></td>
                  <td className="px-3 py-2 text-center text-xs text-yellow-400">{Number(ev.total_pendiente||0).toFixed(0)}</td>
                  <td className="px-3 py-2 text-center">
                    {ev.imagen_url
                      ?<a href={ev.imagen_url} target="_blank" rel="noreferrer"><ImageIcon className="h-4 w-4 text-green-400 inline"/></a>
                      :<span className="text-muted-foreground/40 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar evento" onClick={()=>openEdit(ev)}><Pencil className="h-3.5 w-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Subir imagen evidencia" onClick={()=>{setImageEvent(ev);setImageFile(null);setImagePreview(ev.imagen_url||"");setShowImageModal(true);}}><ImageIcon className="h-3.5 w-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Cargar CSV al evento" onClick={()=>{setCsvEvent(ev);setCsvEventForm({...EMPTY_EVENT,fecha:ev.fecha?.slice(0,10)||"",tipo:ev.tipo,folio_interno:ev.folio_interno||"",destino:ev.destino||"",tecnico:ev.tecnico||"",unidad:ev.unidad||"",bisonte:ev.bisonte||"",kw:ev.kw||"",vales:ev.vales||"",observaciones:ev.observaciones||"",imagen_url:ev.imagen_url||""});setCsvFile(null);setCsvPreview([]);setShowCsvModal(true);}}><FileUp className="h-3.5 w-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={()=>setDeleteTarget(ev)}><Trash2 className="h-3.5 w-3.5"/></Button>
                    </div>
                  </td>
                </tr>
                {expanded[ev.id]&&(
                  <tr key={`exp-${ev.id}`} className="bg-muted/5">
                    <td colSpan={11} className="px-4 pb-3 pt-1">
                      {loadingItems[ev.id]?(
                        <div className="py-4 text-center text-muted-foreground text-xs">Cargando artículos…</div>
                      ):(items[ev.id]||[]).length===0?(
                        <div className="py-3 text-center text-muted-foreground text-xs">Sin artículos. Edita el evento o carga un CSV.</div>
                      ):(
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              {["SKU","Descripción","Ent","Dev","Usa","Pen","Status KW","Status Bisonte",""].map(h=>(
                                <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(items[ev.id]||[]).map(item=>{
                              const edit=inlineEdit[item.id];
                              return (
                                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10">
                                  <td className="px-2 py-1.5 font-mono">{item.numero_articulo||"—"}</td>
                                  <td className="px-2 py-1.5 max-w-[160px] truncate" title={item.descripcion}>{item.descripcion||"—"}</td>
                                  <td className="px-2 py-1.5 text-green-400 text-center">{item.cantidad_entregada}</td>
                                  <td className="px-2 py-1.5 text-blue-400 text-center">{item.cantidad_devuelta}</td>
                                  <td className="px-2 py-1.5 text-center">{item.cantidad_usada}</td>
                                  <td className="px-2 py-1.5 text-yellow-400 text-center">{item.cantidad_pendiente}</td>
                                  <td className="px-2 py-1.5 min-w-[160px]">
                                    <Select value={edit?.status_kw??item.status_kw??""} onValueChange={v=>setInlineEdit(prev=>({...prev,[item.id]:{status_kw:v,status_bisonte:prev[item.id]?.status_bisonte??item.status_bisonte??""}}))}>
                                      <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Estado KW"/></SelectTrigger>
                                      <SelectContent>{ALL_STATUS_KW.map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-2 py-1.5 min-w-[140px]">
                                    <Input className="h-6 text-xs" value={edit?.status_bisonte??item.status_bisonte??""} onChange={e=>setInlineEdit(prev=>({...prev,[item.id]:{status_kw:prev[item.id]?.status_kw??item.status_kw??"",status_bisonte:e.target.value}}))} placeholder="Status Bisonte"/>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex gap-1">
                                      {edit&&<Button variant="ghost" size="icon" className="h-6 w-6 text-green-400" onClick={()=>saveItemStatus(ev.id,item)} disabled={savingItem[item.id]}><Check className="h-3 w-3"/></Button>}
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={()=>deleteItem(ev.id,item.id)}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages>1&&(
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Mostrando {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} de {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Anterior</Button>
            <span className="flex items-center px-2 text-muted-foreground">{page}/{pages}</span>
            <Button variant="outline" size="sm" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEvent?"Editar Evento":"Nuevo Evento de Rescate"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Fecha *</Label><Input type="date" value={eventForm.fecha} onChange={e=>setEventForm(p=>({...p,fecha:e.target.value}))}/></div>
              <div className="space-y-1.5"><Label>Folio SITIC</Label><Input value={eventForm.folio_interno} onChange={e=>setEventForm(p=>({...p,folio_interno:e.target.value}))} placeholder="ej. 3611353"/></div>
              <div className="space-y-1.5"><Label>Tipo *</Label>
                <Select value={eventForm.tipo} onValueChange={v=>setEventForm(p=>({...p,tipo:v as any}))}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="RESCATE">RESCATE</SelectItem><SelectItem value="MTTO">MTTO</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Destino</Label><Input value={eventForm.destino} onChange={e=>setEventForm(p=>({...p,destino:e.target.value}))}/></div>
              <div className="space-y-1.5"><Label>Técnico</Label><Input value={eventForm.tecnico} onChange={e=>setEventForm(p=>({...p,tecnico:e.target.value}))}/></div>
              <div className="space-y-1.5"><Label>Unidad</Label><Input value={eventForm.unidad} onChange={e=>setEventForm(p=>({...p,unidad:e.target.value}))} placeholder="ej. T-691"/></div>
              <div className="space-y-1.5"><Label>Representante Bisonte</Label><Input value={eventForm.bisonte} onChange={e=>setEventForm(p=>({...p,bisonte:e.target.value}))}/></div>
              <div className="space-y-1.5"><Label>Vendedor KW</Label><Input value={eventForm.kw} onChange={e=>setEventForm(p=>({...p,kw:e.target.value}))}/></div>
              <div className="space-y-1.5 col-span-2"><Label>Vales</Label><Input value={eventForm.vales} onChange={e=>setEventForm(p=>({...p,vales:e.target.value}))}/></div>
              <div className="space-y-1.5 col-span-2"><Label>Observaciones</Label><Textarea rows={2} value={eventForm.observaciones} onChange={e=>setEventForm(p=>({...p,observaciones:e.target.value}))}/></div>
            </div>
            {!editingEvent&&(
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Artículos del evento</Label>
                  <Button variant="outline" size="sm" onClick={addFormItem}><Plus className="h-3.5 w-3.5 mr-1"/>Agregar artículo</Button>
                </div>
                {/* SKU Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <Input className="pl-9" placeholder="Buscar SKU en inventario…" value={skuSearch} onChange={e=>setSkuSearch(e.target.value)}/>
                  {skuResults.length>0&&(
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg max-h-48 overflow-y-auto">
                      {skuResults.map(r=>(
                        <button key={r.numero_articulo} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2" onClick={()=>{
                          setFormItems(prev=>[...prev,{...EMPTY_ITEM,numero_articulo:r.numero_articulo,descripcion:r.descripcion}]);
                          setSkuSearch(""); setSkuResults([]);
                        }}>
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                          <span className="font-mono text-primary">{r.numero_articulo}</span>
                          <span className="truncate text-muted-foreground">{r.descripcion}</span>
                          <span className="ml-auto text-green-400 shrink-0">exist:{r.existencia}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formItems.map((item,i)=>(
                  <div key={i} className="rounded-lg border p-3 space-y-2 relative">
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={()=>removeFormItem(i)}><X className="h-3 w-3"/></Button>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs">SKU</Label><Input className="h-7 text-xs" value={item.numero_articulo} onChange={e=>updateFormItem(i,"numero_articulo",e.target.value)}/></div>
                      <div className="space-y-1"><Label className="text-xs">Descripción</Label><Input className="h-7 text-xs" value={item.descripcion} onChange={e=>updateFormItem(i,"descripcion",e.target.value)}/></div>
                      <div className="space-y-1"><Label className="text-xs">Entregada</Label><Input type="number" className="h-7 text-xs" value={item.cantidad_entregada} onChange={e=>updateFormItem(i,"cantidad_entregada",parseFloat(e.target.value)||0)}/></div>
                      <div className="space-y-1"><Label className="text-xs">Pendiente</Label><Input type="number" className="h-7 text-xs" value={item.cantidad_pendiente} onChange={e=>updateFormItem(i,"cantidad_pendiente",parseFloat(e.target.value)||0)}/></div>
                      <div className="space-y-1"><Label className="text-xs">Status KW</Label>
                        <Select value={item.status_kw||""} onValueChange={v=>updateFormItem(i,"status_kw",v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Estado"/></SelectTrigger>
                          <SelectContent>{ALL_STATUS_KW.map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">Status Bisonte</Label><Input className="h-7 text-xs" value={item.status_bisonte} onChange={e=>updateFormItem(i,"status_bisonte",e.target.value)}/></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {formError&&<p className="text-xs text-destructive mt-2">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowEventForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveEvent} disabled={saving}>{saving?"Guardando…":"Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Upload Modal */}
      <Dialog open={showImageModal} onOpenChange={open=>{if(!open){setShowImageModal(false);setImageFile(null);setImagePreview("");}}}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Imagen de Evidencia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {imageEvent?.imagen_url&&!imageFile&&(
              <div className="rounded-lg overflow-hidden border">
                <img src={imageEvent.imagen_url} alt="Evidencia actual" className="w-full max-h-48 object-contain bg-muted"/>
                <p className="text-xs text-muted-foreground p-2">Imagen actual en Cloudinary</p>
              </div>
            )}
            <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){setImageFile(f);const r=new FileReader();r.onload=ev=>setImagePreview(ev.target?.result as string);r.readAsDataURL(f);}}}>
              <input type="file" accept="image/*,.pdf" className="hidden" id="img-upload" onChange={e=>{const f=e.target.files?.[0];if(f){setImageFile(f);const r=new FileReader();r.onload=ev=>setImagePreview(ev.target?.result as string);r.readAsDataURL(f);}}}/>
              <label htmlFor="img-upload" className="cursor-pointer">
                {imagePreview&&imageFile?(
                  <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-contain mb-2"/>
                ):(
                  <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2"/><p className="text-sm text-muted-foreground">Arrastra una imagen o <span className="text-primary underline">haz clic</span></p><p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, PDF — máx. 10MB</p></>
                )}
                {imageFile&&<p className="text-xs text-primary mt-2 font-medium">{imageFile.name}</p>}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setShowImageModal(false);setImageFile(null);setImagePreview("");}}>Cancelar</Button>
            <Button onClick={handleImageUpload} disabled={!imageFile||imageUploading}>{imageUploading?"Subiendo a Cloudinary…":"Subir imagen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Modal */}
      <Dialog open={showCsvModal} onOpenChange={open=>{if(!open){setShowCsvModal(false);setCsvFile(null);setCsvPreview([]);}}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{csvEvent?"Agregar artículos vía CSV":"Carga masiva SITIC (nuevo evento)"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!csvEvent&&(
              <div className="rounded-lg border bg-muted/10 p-4 grid grid-cols-2 gap-3">
                <p className="col-span-2 text-xs font-semibold text-muted-foreground">Datos del evento (opcional — se auto-detectan del CSV)</p>
                <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" className="h-7 text-xs" value={csvEventForm.fecha} onChange={e=>setCsvEventForm(p=>({...p,fecha:e.target.value}))}/></div>
                <div className="space-y-1"><Label className="text-xs">Tipo</Label>
                  <Select value={csvEventForm.tipo} onValueChange={v=>setCsvEventForm(p=>({...p,tipo:v as any}))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="RESCATE">RESCATE</SelectItem><SelectItem value="MTTO">MTTO</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Folio SITIC</Label><Input className="h-7 text-xs" value={csvEventForm.folio_interno} onChange={e=>setCsvEventForm(p=>({...p,folio_interno:e.target.value}))}/></div>
                <div className="space-y-1"><Label className="text-xs">Destino</Label><Input className="h-7 text-xs" value={csvEventForm.destino} onChange={e=>setCsvEventForm(p=>({...p,destino:e.target.value}))}/></div>
                <div className="space-y-1"><Label className="text-xs">Técnico</Label><Input className="h-7 text-xs" value={csvEventForm.tecnico} onChange={e=>setCsvEventForm(p=>({...p,tecnico:e.target.value}))}/></div>
                <div className="space-y-1"><Label className="text-xs">Unidad</Label><Input className="h-7 text-xs" value={csvEventForm.unidad} onChange={e=>setCsvEventForm(p=>({...p,unidad:e.target.value}))}/></div>
              </div>
            )}
            <div className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
              <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={e=>{const f=e.target.files?.[0];if(f) handleCsvFile(f);}}/>
              <label htmlFor="csv-upload" className="cursor-pointer">
                <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2"/>
                {csvFile?<p className="text-sm font-medium text-primary">{csvFile.name}</p>:<><p className="text-sm text-muted-foreground">Selecciona el CSV exportado de SITIC</p><p className="text-xs text-muted-foreground mt-1">Columnas detectadas automáticamente</p></>}
              </label>
            </div>
            {csvPreview.length>0&&(
              <div className="rounded-lg border overflow-x-auto">
                <p className="text-xs text-muted-foreground px-3 py-1.5 border-b bg-muted/20">Vista previa (primeras {csvPreview.length-1} filas)</p>
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted/10">{csvPreview[0]?.map((h,i)=><th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>{csvPreview.slice(1).map((row,i)=><tr key={i} className="border-b">{row.map((c,j)=><td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setShowCsvModal(false);setCsvFile(null);setCsvPreview([]);}}>Cancelar</Button>
            <Button onClick={handleCsvUpload} disabled={!csvFile||csvUploading}>{csvUploading?"Procesando…":"Crear evento con CSV"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open=>{if(!open)setDeleteTarget(null);}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar evento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Eliminar el evento <span className="font-medium text-foreground">{deleteTarget?.folio_interno||deleteTarget?.destino}</span> del {deleteTarget?.fecha?.slice(0,10)} y todos sus artículos? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting?"Eliminando…":"Eliminar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
