'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Globe, Plug, LockKeyhole, X, Copy, Download } from 'lucide-react';
import { propertyImportInstructions, type ImportSource } from '@/lib/property-import';

export default function PropertyImportModal({onClose}:{onClose:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [source,setSource] = useState<ImportSource>('website');
  const [url,setUrl] = useState('');
  const [json,setJson] = useState('');
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  useEffect(()=>{const el=dialog.current;const previous=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
  function reset(){setJson('');setError('');setMessage('');}
  function generate(e:FormEvent){
    e.preventDefault();setError('');setMessage('');
    try {setJson(JSON.stringify(propertyImportInstructions(source,url,window.location.origin),null,2));}
    catch(e){setJson('');setError((e as Error).message);}
  }
  async function copy(){
    try {await navigator.clipboard.writeText(json);setMessage('JSON copiado. Ya podés pasárselo a tu agente.');setError('');}
    catch {setError('No se pudo copiar. Descargá el JSON o seleccioná el texto de la vista previa.');}
  }
  function download(){
    const href=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
    const a=document.createElement('a');a.href=href;a.download=`importar-propiedades-${source}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
    setMessage('JSON descargado para tu agente.');
  }
  return <dialog ref={dialog} className="modal large property-import-modal" aria-labelledby="property-import-title" aria-describedby="property-import-help" onCancel={e=>{e.preventDefault();onClose();}}>
    <div className="modal-head"><div><h2 id="property-import-title">Importar tus propiedades</h2><p id="property-import-help">Elegí el origen y prepará las instrucciones para tu agente.</p></div><button type="button" className="icon-button" aria-label="Cerrar importación de propiedades" onClick={onClose}><X size={20}/></button></div>
    <div className="entity-form">
      <p className="notice import-locked-note"><LockKeyhole size={18} aria-hidden="true"/><span>La importación automática todavía no está disponible. Podés generar un JSON para que tu agente realice la carga.</span></p>
      <form onSubmit={generate}>
        <fieldset className="import-source-options"><legend>Origen de las propiedades</legend>{([
          ['website','Sitio web','Desde las publicaciones de tu inmobiliaria.',Globe],
          ['api','API','Desde un proveedor con acceso autorizado.',Plug],
        ] as const).map(([value,title,description,Icon])=><label className={`import-source-card ${source===value?'selected':''}`} key={value}>
          <input type="radio" name="property-import-source" value={value} checked={source===value} onChange={()=>{setSource(value);setUrl('');reset();}}/>
          <Icon size={22} aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small><small className="import-source-lock"><LockKeyhole size={12} aria-hidden="true"/>Importación automática bloqueada</small></span>
        </label>)}</fieldset>
        <label>{source==='website'?'Dirección del sitio web':'URL base de la API'}<input type="url" required maxLength={2048} autoComplete="off" placeholder={source==='website'?'https://tu-inmobiliaria.com':'https://api.proveedor.com/propiedades'} value={url} onChange={e=>{setUrl(e.target.value);reset();}}/></label>
        <p className="muted import-url-help">No ingreses contraseñas ni claves de API. El JSON indicará cómo configurarlas en el entorno de tu agente.</p>
        <div className="import-actions"><button type="button" className="secondary" disabled aria-describedby="property-import-help"><LockKeyhole size={16} aria-hidden="true"/>Importar automáticamente</button><button type="submit" className="primary">Generar JSON para mi agente</button></div>
      </form>
      {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
      {json&&<section className="import-json"><label>Instrucciones para tu agente<textarea aria-label="JSON de instrucciones de importación" readOnly rows={12} value={json} spellCheck={false}/></label><div className="import-actions"><button type="button" className="secondary" onClick={()=>void copy()}><Copy size={16}/>Copiar JSON</button><button type="button" className="primary" onClick={download}><Download size={16}/>Descargar JSON</button></div></section>}
    </div>
  </dialog>;
}
