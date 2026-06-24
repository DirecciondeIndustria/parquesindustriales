import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Boton, inputCls } from './ui';

interface Mensaje {
  id: string; emisor: 'empresa' | 'oficina'; tipo: string;
  autor_nombre: string | null; mensaje: string; created_at: string;
}

/** Hilo de consultas empresa ↔ oficina (solo texto). */
export function Consultas({
  empresaId, expedienteId, emisor, autorNombre,
}: {
  empresaId: string; expedienteId: string;
  emisor: 'empresa' | 'oficina'; autorNombre?: string;
}) {
  const qc = useQueryClient();
  const { session, perfil } = useAuth();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'respuesta' | 'solicitud'>('respuesta');

  const nombre = autorNombre ?? (emisor === 'oficina' ? perfil?.nombre ?? 'Oficina' : 'Empresa');

  const { data: mensajes = [] } = useQuery({
    queryKey: ['consultas', expedienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultas').select('*')
        .eq('expediente_id', expedienteId).order('created_at');
      if (error) throw error;
      return data as Mensaje[];
    },
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('consultas').insert({
        empresa_id: empresaId, expediente_id: expedienteId, emisor,
        tipo: emisor === 'empresa' ? 'consulta' : tipo,
        autor_id: session?.user.id ?? null, autor_nombre: nombre, mensaje: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setTexto(''); qc.invalidateQueries({ queryKey: ['consultas', expedienteId] }); },
  });

  return (
    <div>
      <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
        {mensajes.length === 0 && <p className="text-sm text-slate-400">Todavía no hay consultas en este expediente.</p>}
        {mensajes.map((m) => {
          const mio = m.emisor === emisor;
          return (
            <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mio ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 text-slate-800'}`}>
                <div className={`text-[11px] mb-0.5 ${mio ? 'text-white/80' : 'text-slate-500'}`}>
                  {m.autor_nombre ?? (m.emisor === 'oficina' ? 'Oficina' : 'Empresa')}
                  {m.tipo === 'solicitud' && <span className="ml-1 font-semibold">· Solicitud de información</span>}
                  <span className="ml-1">· {new Date(m.created_at).toLocaleString('es-AR')}</span>
                </div>
                <div className="whitespace-pre-wrap">{m.mensaje}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (texto.trim()) enviar.mutate(); }} className="space-y-2">
        {emisor === 'oficina' && (
          <select className={`${inputCls} max-w-xs`} value={tipo} onChange={(e) => setTipo(e.target.value as 'respuesta' | 'solicitud')}>
            <option value="respuesta">Respuesta / aclaración</option>
            <option value="solicitud">Solicitud de información</option>
          </select>
        )}
        <textarea className={inputCls} rows={2} value={texto} placeholder={emisor === 'empresa' ? 'Escribí tu consulta sobre el trámite…' : 'Responder o aclarar…'}
          onChange={(e) => setTexto(e.target.value)} />
        <div className="flex justify-end">
          <Boton type="submit" disabled={enviar.isPending || !texto.trim()}>{enviar.isPending ? 'Enviando…' : 'Enviar'}</Boton>
        </div>
      </form>

      {emisor === 'empresa' && (
        <p className="text-xs text-slate-500 mt-2">
          Este canal es solo para <strong>consultas</strong>. La documentación de respuesta a un pedido debe presentarse por <strong>vía postal o presencial en Mesa de Entrada</strong> del Ministerio; no se adjunta por el sistema.
        </p>
      )}
    </div>
  );
}
