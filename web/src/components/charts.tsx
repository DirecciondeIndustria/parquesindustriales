interface Item { label: string; valor: number; color: string; }

export function Donut({ datos, titulo }: { datos: Item[]; titulo: string }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  const R = 60, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="bg-white rounded-2xl card-elev p-5">
      <h3 className="font-semibold text-slate-700 mb-4">{titulo}</h3>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 160 160" className="w-36 h-36 -rotate-90 shrink-0" style={{ filter: 'drop-shadow(0 6px 10px rgba(15,23,42,.12))' }}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--chart-track)" strokeWidth="22" />
          {total === 0
            ? null
            : datos.map((d, i) => {
                const frac = d.valor / total;
                const dash = frac * C;
                const el = (
                  <circle key={i} cx="80" cy="80" r={R} fill="none" stroke={d.color} strokeWidth="22"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(dash - 1.5, 0)} ${C - Math.max(dash - 1.5, 0)}`}
                    strokeDashoffset={-offset}
                    style={{ transition: 'stroke-dasharray .6s cubic-bezier(.16,1,.3,1)' }} />
                );
                offset += dash;
                return el;
              })}
        </svg>
        <ul className="text-sm space-y-2">
          {datos.map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-slate-600">
              <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: d.color }} />
              {d.label}: <strong className="text-slate-800">{d.valor}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Barras({ datos, titulo }: { datos: Item[]; titulo: string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <div className="bg-white rounded-2xl card-elev p-5">
      <h3 className="font-semibold text-slate-700 mb-4">{titulo}</h3>
      <div className="space-y-3.5">
        {datos.map((d, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">{d.label}</span>
              <span className="font-semibold text-slate-800 tabular-nums">{d.valor}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div className="h-full rounded-full"
                style={{
                  width: `${(d.valor / max) * 100}%`,
                  background: `linear-gradient(90deg, ${d.color}cc, ${d.color})`,
                  boxShadow: `0 1px 4px ${d.color}66`,
                  transition: 'width .7s cubic-bezier(.16,1,.3,1)',
                }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
