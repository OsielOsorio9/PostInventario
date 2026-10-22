import { useState, useEffect, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { Chart, registerables } from 'chart.js';
import {
  openDB, dbGetAll, dbAdd, dbPut, dbDelete, dbClear,
  getConfig, setConfig, initDefaultConfig,
  Storage, verifyMasterKey, getLicense, saveLicense, isLicenseValid, clearLicense,
  encryptData, decryptData, fmt, fmtDate, fmtDateTime, genVentaNum,
  type Producto, type Compra, type Venta, type VentaItem, type Cliente, type Gasto, type Anulacion, type Tasa
} from './lib/db';

Chart.register(...registerables);

// ============ TOAST SYSTEM ============
type Toast = { id: number; msg: string; type: 'ok' | 'err' | 'warn' | 'info' };
let toastId = 0;
let toastListeners: ((t: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function showToast(msg: string, type: Toast['type'] = 'info') {
  const t = { id: ++toastId, msg, type };
  toasts = [...toasts, t];
  toastListeners.forEach(fn => fn(toasts));
  setTimeout(() => { toasts = toasts.filter(x => x.id !== t.id); toastListeners.forEach(fn => fn(toasts)); }, 4000);
}

function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => { toastListeners.push(setItems); return () => { toastListeners = toastListeners.filter(f => f !== setItems); }; }, []);
  return <div className="toast-container">{items.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>;
}

// ============ LICENSE SCREEN ============
function LicenseScreen({ onActivate }: { onActivate: () => void }) {
  const [step, setStep] = useState<'key' | 'plan'>('key');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');

  const handleKey = () => {
    if (verifyMasterKey(key)) { setStep('plan'); setErr(''); }
    else setErr('Clave incorrecta');
  };

  const handlePlan = (days: number, plan: string) => {
    const lic = { plan, days, start: Date.now(), expires: days === 0 ? 0 : Date.now() + days * 86400000, active: true };
    saveLicense(lic);
    onActivate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>🔧 FerreteríaPRO</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text2)' }}>Sistema de Gestión de Ferretería</p>
        </div>
        {step === 'key' ? (
          <div>
            <label className="block text-sm font-medium mb-2">Clave de activación</label>
            <input type="password" className="input mb-3" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleKey()} placeholder="Introduzca la clave..." />
            {err && <p className="text-red-500 text-sm mb-2">{err}</p>}
            <button className="btn btn-primary w-full justify-center" onClick={handleKey}>Verificar</button>
          </div>
        ) : (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>Seleccione un plan:</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ d: 30, n: 'Prueba 30 días' }, { d: 90, n: 'Trimestral' }, { d: 365, n: 'Anual' }, { d: 0, n: 'Perpetuo' }].map(p => (
                <button key={p.d} className="btn btn-ghost flex-col py-4" onClick={() => handlePlan(p.d, p.n)}>
                  <span className="font-bold">{p.n}</span>
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>{p.d === 0 ? 'Sin expiración' : `${p.d} días`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ MODAL ============
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'w-[900px]' : 'w-[500px]'}`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============ MAIN APP ============
type Page = 'dashboard' | 'inventory' | 'purchases' | 'pos' | 'sales' | 'cancellations' | 'clients' | 'metrics' | 'expenses' | 'backup' | 'settings';

export default function App() {
  const [ready, setReady] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [cfg, setCfg] = useState<Record<string, any>>({});
  const [kiosco, setKiosco] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    Storage.init();
    (async () => {
      await openDB();
      await initDefaultConfig();
      const c = await getConfig();
      setCfg(c);
      setReady(true);
      if (isLicenseValid()) setLicensed(true);
    })();
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      let isDark = false;
      if (cfg.tema === 'dark') isDark = true;
      else if (cfg.tema === 'auto') { const h = new Date().getHours(); isDark = h < 6 || h >= 18; }
      setDark(isDark);
      document.documentElement.className = isDark ? 'dark' : '';
      const sizeClass = cfg.size === 'sm' ? 'size-compact' : cfg.size === 'lg' ? 'size-large' : 'size-normal';
      document.body.className = sizeClass;
    };
    applyTheme();
  }, [cfg.tema, cfg.size]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'F1') { e.preventDefault(); showToast('F2: Nuevo producto | F3: POS | F5: Dashboard | F9: Kiosco', 'info'); }
      if (e.key === 'F3') { e.preventDefault(); setPage('pos'); }
      if (e.key === 'F5') { e.preventDefault(); setPage('dashboard'); }
      if (e.key === 'F9') { e.preventDefault(); setKiosco(k => !k); }
      if (e.key === 'Escape' && kiosco) setKiosco(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [kiosco]);

  if (!ready) return <div className="min-h-screen flex items-center justify-center"><div className="text-xl">Cargando...</div></div>;
  if (!licensed) return <LicenseScreen onActivate={() => { setLicensed(true); showToast('Licencia activada', 'ok'); }} />;

  const navItems: { id: Page; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'inventory', icon: '📦', label: 'Inventario' },
    { id: 'purchases', icon: '📥', label: 'Compras' },
    { id: 'pos', icon: '🛒', label: 'POS' },
    { id: 'sales', icon: '🧾', label: 'Ventas' },
    { id: 'cancellations', icon: '🚫', label: 'Anulaciones' },
    { id: 'clients', icon: '💳', label: 'Clientes' },
    { id: 'metrics', icon: '📈', label: 'Métricas' },
    { id: 'expenses', icon: '💸', label: 'Gastos' },
    { id: 'backup', icon: '💾', label: 'Respaldo' },
    { id: 'settings', icon: '⚙️', label: 'Ajustes' },
  ];

  const refreshCfg = async () => { setCfg(await getConfig()); };

  return (
    <div className="flex min-h-screen">
      {!kiosco && (
        <aside className="sidebar">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h1 className="font-bold text-lg" style={{ color: 'var(--primary)' }}>🔧 FerreteríaPRO</h1>
          </div>
          <nav className="flex-1 py-2">
            {navItems.map(n => (
              <div key={n.id} className={`sidebar-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
                <span>{n.icon}</span><span>{n.label}</span>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
            <button className="btn btn-ghost btn-sm w-full justify-center" onClick={() => setKiosco(true)}>⛶ Kiosco</button>
          </div>
        </aside>
      )}
      <main className="flex-1 overflow-auto">
        {!kiosco && (
          <header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
            <h2 className="font-semibold text-lg">{navItems.find(n => n.id === page)?.icon} {navItems.find(n => n.id === page)?.label}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text2)' }}>1 USD = {fmt(cfg.tasa || 350)} CUP</span>
            </div>
          </header>
        )}
        <div className="p-4 md:p-6">
          {page === 'dashboard' && <Dashboard cfg={cfg} setPage={setPage} />}
          {page === 'inventory' && <Inventory cfg={cfg} />}
          {page === 'purchases' && <Purchases cfg={cfg} />}
          {page === 'pos' && <POS cfg={cfg} />}
          {page === 'sales' && <Sales cfg={cfg} />}
          {page === 'cancellations' && <Cancellations cfg={cfg} />}
          {page === 'clients' && <Clients cfg={cfg} />}
          {page === 'metrics' && <Metrics cfg={cfg} />}
          {page === 'expenses' && <Expenses cfg={cfg} />}
          {page === 'backup' && <Backup cfg={cfg} />}
          {page === 'settings' && <Settings cfg={cfg} refreshCfg={refreshCfg} />}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard({ cfg, setPage }: { cfg: Record<string, any>; setPage: (p: Page) => void }) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const chartRef1 = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chart1 = useRef<Chart | null>(null);
  const chart2 = useRef<Chart | null>(null);

  const load = useCallback(async () => {
    setVentas(await dbGetAll<Venta>('ventas'));
    setProductos(await dbGetAll<Producto>('productos'));
    setAnulaciones(await dbGetAll<Anulacion>('anulaciones'));
    setClientes(await dbGetAll<Cliente>('clientes'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  const ventasHoy = ventas.filter(v => v.fecha >= todayTs && v.estado === 'pagada');
  const totalHoyCUP = ventasHoy.reduce((s, v) => s + v.totalCUP, 0);
  const totalHoyUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
  const gananciaHoy = ventasHoy.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad, 0), 0);
  const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= p.min);
  const agotados = productos.filter(p => p.stock <= 0);
  const anulPend = anulaciones.filter(a => a.estado === 'pendiente');
  const clientesSaldo = clientes.filter(c => c.saldoCUP > 0 || c.saldoUSD > 0);

  useEffect(() => {
    if (!chartRef1.current || !chartRef2.current) return;
    // Last 7 days sales
    const days: string[] = []; const vals: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      days.push(d.toLocaleDateString('es-CU', { weekday: 'short' }));
      vals.push(ventas.filter(v => v.fecha >= d.getTime() && v.fecha < next.getTime() && v.estado === 'pagada').reduce((s, v) => s + v.totalCUP, 0));
    }
    if (chart1.current) chart1.current.destroy();
    chart1.current = new Chart(chartRef1.current, {
      type: 'bar', data: { labels: days, datasets: [{ label: 'Ventas CUP', data: vals, backgroundColor: '#3b82f6' }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    // Category distribution
    const catMap: Record<string, number> = {};
    ventasHoy.forEach(v => v.items.forEach(it => { const p = productos.find(pr => pr.id === it.productoId); const cat = p?.categoria || 'Otros'; catMap[cat] = (catMap[cat] || 0) + it.subtotalCUP; }));
    const cats = Object.keys(catMap); const catVals = Object.values(catMap);
    if (chart2.current) chart2.current.destroy();
    chart2.current = new Chart(chartRef2.current, {
      type: 'pie', data: { labels: cats.length ? cats : ['Sin datos'], datasets: [{ data: catVals.length ? catVals : [1], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'] }] },
      options: { responsive: true }
    });
    return () => { chart1.current?.destroy(); chart2.current?.destroy(); };
  }, [ventas, productos, ventasHoy]);

  const last5 = [...ventas].filter(v => v.estado === 'pagada').sort((a, b) => b.fecha - a.fecha).slice(0, 5);

  return (
    <div>
      <div className="grid-4 mb-6">
        <div className="kpi"><div className="kpi-label">Ventas Hoy</div><div className="kpi-value">{ventasHoy.length}</div><div className="text-xs" style={{ color: 'var(--text2)' }}>{fmt(totalHoyCUP)} CUP</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Ingresos USD</div><div className="kpi-value">{fmt(totalHoyUSD)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Ganancia Hoy</div><div className="kpi-value">{fmt(gananciaHoy)}</div><div className="text-xs" style={{ color: 'var(--text2)' }}>CUP</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--err)' }}><div className="kpi-label">Stock Bajo / Agotados</div><div className="kpi-value">{stockBajo.length + agotados.length}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-4"><h3 className="font-semibold mb-3">Ventas últimos 7 días</h3><canvas ref={chartRef1}></canvas></div>
        <div className="card p-4"><h3 className="font-semibold mb-3">Ventas por Categoría (Hoy)</h3><canvas ref={chartRef2}></canvas></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Últimas Ventas</h3>
          {last5.length === 0 ? <p className="text-sm" style={{ color: 'var(--text2)' }}>Sin ventas</p> : (
            <div className="space-y-2">{last5.map(v => (
              <div key={v.id} className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg3)' }}>
                <div><span className="font-mono text-xs">{v.num}</span> <span className="text-xs" style={{ color: 'var(--text2)' }}>{fmtDateTime(v.fecha)}</span></div>
                <span className="font-semibold">{fmt(v.totalCUP)} CUP</span>
              </div>
            ))}</div>
          )}
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Alertas</h3>
          <div className="space-y-2">
            {agotados.length > 0 && <div className="flex justify-between items-center p-2 rounded cursor-pointer" style={{ background: '#fee2e2' }} onClick={() => setPage('inventory')}><span className="text-sm text-red-700">🔴 {agotados.length} productos agotados</span></div>}
            {stockBajo.length > 0 && <div className="flex justify-between items-center p-2 rounded cursor-pointer" style={{ background: '#fef3c7' }} onClick={() => setPage('inventory')}><span className="text-sm text-amber-700">🟡 {stockBajo.length} productos stock bajo</span></div>}
            {anulPend.length > 0 && <div className="flex justify-between items-center p-2 rounded cursor-pointer" style={{ background: '#fef3c7' }} onClick={() => setPage('cancellations')}><span className="text-sm text-amber-700">🚫 {anulPend.length} anulaciones pendientes</span></div>}
            {clientesSaldo.length > 0 && <div className="flex justify-between items-center p-2 rounded cursor-pointer" style={{ background: '#cffafe' }} onClick={() => setPage('clients')}><span className="text-sm text-cyan-700">💳 {clientesSaldo.length} clientes con saldo</span></div>}
            {agotados.length === 0 && stockBajo.length === 0 && anulPend.length === 0 && clientesSaldo.length === 0 && <p className="text-sm" style={{ color: 'var(--text2)' }}>Sin alertas</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ INVENTORY ============
function Inventory({ cfg }: { cfg: Record<string, any> }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<Producto | null>(null);
  const [form, setForm] = useState<Partial<Producto>>({});

  const load = useCallback(async () => { setProductos(await dbGetAll<Producto>('productos')); }, []);
  useEffect(() => { load(); }, [load]);

  const fuse = new Fuse(productos, { keys: ['nombre', 'codigo', 'categoria'], threshold: 0.4 });
  let filtered = search ? fuse.search(search).map(r => r.item) : productos;
  if (filterCat) filtered = filtered.filter(p => p.categoria === filterCat);
  if (filterStatus === 'low') filtered = filtered.filter(p => p.stock > 0 && p.stock <= p.min);
  if (filterStatus === 'out') filtered = filtered.filter(p => p.stock <= 0);
  if (filterStatus === 'ok') filtered = filtered.filter(p => p.stock > p.min);

  const openNew = () => { setEditItem(null); setForm({ nombre: '', codigo: '', categoria: cfg.cats?.[0] || '', unidad: cfg.units?.[0] || 'Unidad', compraCUP: 0, compraUSD: 0, ventaCUP: 0, ventaUSD: 0, pep: 0, pepUSD: 0, stock: 0, min: 0, foto: '' }); setModal(true); };
  const openEdit = (p: Producto) => { setEditItem(p); setForm({ ...p }); setModal(true); };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 500000) { showToast('Imagen muy grande (máx 500KB)', 'err'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, foto: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', 'err'); return; }
    if (editItem) {
      await dbPut('productos', { ...editItem, ...form });
      showToast('Producto actualizado', 'ok');
    } else {
      await dbAdd('productos', { ...form, creado: Date.now() } as Producto);
      showToast('Producto creado', 'ok');
    }
    setModal(false); load();
  };

  const del = async (p: Producto) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    await dbDelete('productos', p.id!); showToast('Producto eliminado', 'ok'); load();
  };

  const statusBadge = (p: Producto) => {
    if (p.stock <= 0) return <span className="badge badge-err">Agotado</span>;
    if (p.stock <= p.min) return <span className="badge badge-warn">Stock bajo</span>;
    return <span className="badge badge-ok">Disponible</span>;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input className="input max-w-xs" placeholder="🔍 Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[150px]" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {(cfg.cats || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-[150px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos</option><option value="ok">Disponibles</option><option value="low">Stock bajo</option><option value="out">Agotados</option>
        </select>
        <div className="flex gap-1 ml-auto">
          <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('grid')}>▦</button>
          <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('table')}>☰</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="product-card">
              {p.foto ? <img src={p.foto} alt={p.nombre} /> : <div style={{ height: 100, background: 'var(--bg3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>}
              <h4 className="font-semibold text-sm mt-2 truncate">{p.nombre}</h4>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>{p.codigo || p.categoria}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{fmt(p.ventaCUP)}</span>
                {statusBadge(p)}
              </div>
              <p className="text-xs mt-1">Stock: {p.stock} {p.unidad}</p>
              <div className="flex gap-1 mt-2">
                <button className="btn btn-ghost btn-sm flex-1" onClick={() => openEdit(p)}>✏️</button>
                <button className="btn btn-ghost btn-sm flex-1" onClick={() => del(p)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Producto</th><th>Código</th><th>Categoría</th><th>Stock</th><th>Compra</th><th>Venta</th><th>PEP</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.nombre}</td><td className="font-mono text-xs">{p.codigo}</td><td>{p.categoria}</td>
                  <td>{p.stock} {p.unidad}</td><td>{fmt(p.compraCUP)}</td><td>{fmt(p.ventaCUP)}</td><td>{fmt(p.pep)}</td>
                  <td>{statusBadge(p)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button> <button className="btn btn-ghost btn-sm" onClick={() => del(p)}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length === 0 && <p className="text-center py-8" style={{ color: 'var(--text2)' }}>No se encontraron productos</p>}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Editar Producto' : 'Nuevo Producto'}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs font-medium">Nombre *</label><input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Código</label><input className="input" value={form.codigo || ''} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Categoría</label><select className="input" value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>{(cfg.cats || []).map((c: string) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs font-medium">Unidad</label><select className="input" value={form.unidad || ''} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>{(cfg.units || []).map((u: string) => <option key={u}>{u}</option>)}</select></div>
          <div><label className="text-xs font-medium">Stock</label><input type="number" className="input" value={form.stock || 0} onChange={e => setForm(f => ({ ...f, stock: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Stock Mín.</label><input type="number" className="input" value={form.min || 0} onChange={e => setForm(f => ({ ...f, min: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Compra CUP</label><input type="number" className="input" value={form.compraCUP || 0} onChange={e => setForm(f => ({ ...f, compraCUP: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Compra USD</label><input type="number" className="input" value={form.compraUSD || 0} onChange={e => setForm(f => ({ ...f, compraUSD: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Venta CUP</label><input type="number" className="input" value={form.ventaCUP || 0} onChange={e => setForm(f => ({ ...f, ventaCUP: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Venta USD</label><input type="number" className="input" value={form.ventaUSD || 0} onChange={e => setForm(f => ({ ...f, ventaUSD: +e.target.value }))} /></div>
          <div className="col-span-2"><label className="text-xs font-medium">Foto</label><input type="file" accept="image/*" className="input" onChange={handleFoto} />{form.foto && <img src={form.foto} className="mt-2 w-20 h-20 object-cover rounded" />}</div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </Modal>
    </div>
  );
}

// ============ PURCHASES ============
function Purchases({ cfg }: { cfg: Record<string, any> }) {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ productoId: 0, cantidad: 0, precioUnitCUP: 0, precioUnitUSD: 0, nota: '' });

  const load = useCallback(async () => { setCompras(await dbGetAll<Compra>('compras')); setProductos(await dbGetAll<Producto>('productos')); }, []);
  useEffect(() => { load(); }, [load]);

  const producto = productos.find(p => p.id === form.productoId);
  const totalCUP = form.cantidad * form.precioUnitCUP;
  const totalUSD = form.cantidad * form.precioUnitUSD;

  const save = async () => {
    if (!form.productoId || !producto) { showToast('Seleccione un producto', 'err'); return; }
    if (form.cantidad <= 0) { showToast('Cantidad debe ser > 0', 'err'); return; }
    if (form.precioUnitCUP <= 0 && form.precioUnitUSD <= 0) { showToast('Al menos un precio > 0', 'err'); return; }

    // Calculate new PEP
    const newPep = (producto.stock * producto.pep + form.cantidad * form.precioUnitCUP) / (producto.stock + form.cantidad);
    const newPepUSD = (producto.stock * producto.pepUSD + form.cantidad * form.precioUnitUSD) / (producto.stock + form.cantidad);

    const compra: Compra = {
      productoId: producto.id!, productoNombre: producto.nombre, productoCodigo: producto.codigo,
      cantidad: form.cantidad, unidad: producto.unidad, precioUnitCUP: form.precioUnitCUP,
      precioUnitUSD: form.precioUnitUSD, totalCUP, totalUSD, nota: form.nota, fecha: Date.now(), creado: Date.now()
    };
    await dbAdd('compras', compra);

    // Update product
    const updated: Producto = {
      ...producto,
      stock: producto.stock + form.cantidad,
      pep: isNaN(newPep) ? form.precioUnitCUP : newPep,
      pepUSD: isNaN(newPepUSD) ? form.precioUnitUSD : newPepUSD,
      compraCUP: Math.max(producto.compraCUP, form.precioUnitCUP),
      compraUSD: Math.max(producto.compraUSD, form.precioUnitUSD),
    };
    await dbPut('productos', updated);

    showToast(`Compra registrada. Nuevo PEP: ${fmt(isNaN(newPep) ? form.precioUnitCUP : newPep)} CUP`, 'ok');
    setModal(false); setForm({ productoId: 0, cantidad: 0, precioUnitCUP: 0, precioUnitUSD: 0, nota: '' }); load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm" style={{ color: 'var(--text2)' }}>{compras.length} registros</p>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nueva Compra</button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>P. Unit CUP</th><th>P. Unit USD</th><th>Total CUP</th><th>Total USD</th><th>Nota</th></tr></thead>
          <tbody>
            {[...compras].sort((a, b) => b.fecha - a.fecha).map(c => (
              <tr key={c.id}><td className="text-xs">{fmtDate(c.fecha)}</td><td>{c.productoNombre}</td><td>{c.cantidad} {c.unidad}</td>
                <td>{fmt(c.precioUnitCUP)}</td><td>{fmt(c.precioUnitUSD)}</td><td className="font-semibold">{fmt(c.totalCUP)}</td><td>{fmt(c.totalUSD)}</td><td className="text-xs">{c.nota}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {compras.length === 0 && <p className="text-center py-8" style={{ color: 'var(--text2)' }}>Sin compras registradas</p>}

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Compra">
        <div className="space-y-3">
          <div><label className="text-xs font-medium">Producto</label>
            <select className="input" value={form.productoId} onChange={e => setForm(f => ({ ...f, productoId: +e.target.value }))}>
              <option value={0}>Seleccionar...</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.codigo ? `(${p.codigo})` : ''} - Stock: {p.stock}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Cantidad</label><input type="number" className="input" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: +e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Nota</label><input className="input" value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Precio Unit. CUP</label><input type="number" className="input" value={form.precioUnitCUP} onChange={e => setForm(f => ({ ...f, precioUnitCUP: +e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Precio Unit. USD</label><input type="number" className="input" value={form.precioUnitUSD} onChange={e => setForm(f => ({ ...f, precioUnitUSD: +e.target.value }))} /></div>
          </div>
          {producto && <div className="p-3 rounded" style={{ background: 'var(--bg3)' }}><p className="text-sm">Total: <strong>{fmt(totalCUP)} CUP</strong> / <strong>{fmt(totalUSD)} USD</strong></p></div>}
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Registrar</button>
        </div>
      </Modal>
    </div>
  );
}

// ============ POS ============
function POS({ cfg }: { cfg: Record<string, any> }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<VentaItem[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [cobrarModal, setCobrarModal] = useState(false);
  const [pagos, setPagos] = useState({ efCUP: 0, tfCUP: 0, crCUP: 0, efUSD: 0, tfUSD: 0, crUSD: 0 });
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [ticketVenta, setTicketVenta] = useState<Venta | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => { setProductos(await dbGetAll<Producto>('productos')); setClientes(await dbGetAll<Cliente>('clientes')); }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'F4') { e.preventDefault(); if (cart.length > 0) setCobrarModal(true); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart]);

  const fuse = new Fuse(productos.filter(p => p.ventaCUP > 0 || p.ventaUSD > 0), { keys: ['nombre', 'codigo', 'categoria'], threshold: 0.4 });
  const results = search ? fuse.search(search).slice(0, 100).map(r => r.item) : productos.filter(p => p.ventaCUP > 0 || p.ventaUSD > 0).slice(0, 100);

  const addToCart = (p: Producto) => {
    const existing = cart.find(c => c.productoId === p.id);
    if (existing) {
      if (existing.cantidad + 1 > p.stock) { showToast('Stock insuficiente', 'err'); return; }
      setCart(cart.map(c => c.productoId === p.id ? { ...c, cantidad: c.cantidad + 1, subtotalCUP: (c.cantidad + 1) * c.precioCUP, subtotalUSD: (c.cantidad + 1) * c.precioUSD } : c));
    } else {
      if (p.stock <= 0) { showToast('Sin stock', 'err'); return; }
      setCart([...cart, { productoId: p.id!, nombre: p.nombre, codigo: p.codigo, cantidad: 1, unidad: p.unidad, precioCUP: p.ventaCUP, precioUSD: p.ventaUSD, subtotalCUP: p.ventaCUP, subtotalUSD: p.ventaUSD, pep: p.pep, pepUSD: p.pepUSD }]);
    }
  };

  const updateQty = (pid: number, qty: number) => {
    const p = productos.find(pr => pr.id === pid);
    if (p && qty > p.stock) { showToast('Stock insuficiente', 'err'); return; }
    if (qty <= 0) { setCart(cart.filter(c => c.productoId !== pid)); return; }
    setCart(cart.map(c => c.productoId === pid ? { ...c, cantidad: qty, subtotalCUP: qty * c.precioCUP, subtotalUSD: qty * c.precioUSD } : c));
  };

  const subTotalCUP = cart.reduce((s, c) => s + c.subtotalCUP, 0);
  const subTotalUSD = cart.reduce((s, c) => s + c.subtotalUSD, 0);
  const totalCUP = subTotalCUP * (1 - descuento / 100);
  const totalUSD = subTotalUSD * (1 - descuento / 100);

  const sumaPagosCUP = pagos.efCUP + pagos.tfCUP + pagos.crCUP;
  const sumaPagosUSD = pagos.efUSD + pagos.tfUSD + pagos.crUSD;

  const confirmarVenta = async () => {
    if (cart.length === 0) { showToast('Carrito vacío', 'err'); return; }
    if (Math.abs(sumaPagosCUP - totalCUP) > 0.5 && Math.abs(sumaPagosUSD - totalUSD) > 0.01) {
      showToast('Pagos no coinciden con el total', 'err'); return;
    }
    const hasCredito = pagos.crCUP > 0 || pagos.crUSD > 0;
    if (hasCredito && !clienteId) { showToast('Seleccione un cliente para crédito', 'err'); return; }

    // Validate stock
    for (const item of cart) {
      const p = productos.find(pr => pr.id === item.productoId);
      if (!p || p.stock < item.cantidad) { showToast(`Stock insuficiente: ${item.nombre}`, 'err'); return; }
    }

    const venta: Venta = {
      num: genVentaNum(), fecha: Date.now(), items: cart, descuento,
      totalCUP, totalUSD, pagos, clienteId, clienteNombre: clientes.find(c => c.id === clienteId)?.nombre || '',
      estado: 'pagada', creditoCUP: pagos.crCUP, creditoUSD: pagos.crUSD
    };
    await dbAdd('ventas', venta);

    // Update stock
    for (const item of cart) {
      const p = productos.find(pr => pr.id === item.productoId)!;
      await dbPut('productos', { ...p, stock: p.stock - item.cantidad });
    }

    // Update client if credit
    if (hasCredito && clienteId) {
      const cl = clientes.find(c => c.id === clienteId)!;
      await dbPut('clientes', { ...cl, saldoCUP: cl.saldoCUP + pagos.crCUP, saldoUSD: cl.saldoUSD + pagos.crUSD, compras: cl.compras + 1, ultimaCompra: Date.now() });
    } else if (clienteId) {
      const cl = clientes.find(c => c.id === clienteId)!;
      await dbPut('clientes', { ...cl, compras: cl.compras + 1, ultimaCompra: Date.now() });
    }

    setTicketVenta(venta);
    showToast(`Venta ${venta.num} registrada`, 'ok');
    setCart([]); setDescuento(0); setPagos({ efCUP: 0, tfCUP: 0, crCUP: 0, efUSD: 0, tfUSD: 0, crUSD: 0 }); setClienteId(null);
    setCobrarModal(false); load();
    // Note: ticketVenta is set above for display
  };

  const printTicket = () => { window.print(); };

  return (
    <div className="pos-grid">
      <div className="flex flex-col gap-3 overflow-hidden">
        <input ref={searchRef} className="input" placeholder="🔍 Buscar producto (F3 para enfocar)..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        <div className="overflow-auto flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map(p => (
            <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
              {p.foto ? <img src={p.foto} alt={p.nombre} /> : <div style={{ height: 80, background: 'var(--bg3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>}
              <h4 className="font-semibold text-xs mt-1 truncate">{p.nombre}</h4>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{fmt(p.ventaCUP)}</span>
                <span className="text-xs" style={{ color: p.stock <= p.min ? 'var(--err)' : 'var(--text2)' }}>Stock: {p.stock}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4 flex flex-col overflow-hidden">
        <h3 className="font-bold mb-2">🛒 Carrito ({cart.length})</h3>
        <div className="flex-1 overflow-auto space-y-2 mb-3">
          {cart.map(c => (
            <div key={c.productoId} className="p-2 rounded flex items-center gap-2" style={{ background: 'var(--bg3)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.nombre}</p>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>{fmt(c.precioCUP)} × {c.cantidad}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost btn-sm" onClick={() => updateQty(c.productoId, c.cantidad - 1)}>-</button>
                <input type="number" className="input w-12 text-center text-xs" value={c.cantidad} onChange={e => updateQty(c.productoId, +e.target.value)} />
                <button className="btn btn-ghost btn-sm" onClick={() => updateQty(c.productoId, c.cantidad + 1)}>+</button>
              </div>
              <span className="text-sm font-bold w-16 text-right">{fmt(c.subtotalCUP)}</span>
              <button className="text-red-500" onClick={() => setCart(cart.filter(x => x.productoId !== c.productoId))}>✕</button>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center">
            <label className="text-sm">Descuento %</label>
            <input type="number" className="input w-20 text-right" value={descuento} onChange={e => setDescuento(Math.min(100, Math.max(0, +e.target.value)))} min={0} max={100} />
          </div>
          <div className="flex justify-between"><span>Total CUP:</span><span className="font-bold text-lg">{fmt(totalCUP)}</span></div>
          <div className="flex justify-between"><span>Total USD:</span><span className="font-bold">{fmt(totalUSD)}</span></div>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => { setCart([]); setDescuento(0); }}>Vaciar</button>
            <button className="btn btn-ok flex-1" onClick={() => cart.length > 0 && setCobrarModal(true)} disabled={cart.length === 0}>💰 COBRAR (F4)</button>
          </div>
        </div>
      </div>

      <Modal open={cobrarModal} onClose={() => setCobrarModal(false)} title="Cobrar Venta">
        <div className="space-y-3">
          <div className="p-3 rounded text-center" style={{ background: 'var(--bg3)' }}>
            <p className="text-2xl font-bold">{fmt(totalCUP)} CUP</p>
            <p className="text-sm">{fmt(totalUSD)} USD</p>
          </div>
          <div><label className="text-xs font-medium">Cliente (requerido si hay crédito)</label>
            <select className="input" value={clienteId || ''} onChange={e => setClienteId(e.target.value ? +e.target.value : null)}>
              <option value="">Sin cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <p className="text-xs font-semibold">Pagos CUP (Total: {fmt(totalCUP)})</p>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs">Efectivo</label><input type="number" className="input" value={pagos.efCUP} onChange={e => setPagos(p => ({ ...p, efCUP: +e.target.value }))} /></div>
            <div><label className="text-xs">Transfer.</label><input type="number" className="input" value={pagos.tfCUP} onChange={e => setPagos(p => ({ ...p, tfCUP: +e.target.value }))} /></div>
            <div><label className="text-xs">Crédito</label><input type="number" className="input" value={pagos.crCUP} onChange={e => setPagos(p => ({ ...p, crCUP: +e.target.value }))} /></div>
          </div>
          <p className="text-xs font-semibold">Pagos USD (Total: {fmt(totalUSD)})</p>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs">Efectivo</label><input type="number" className="input" value={pagos.efUSD} onChange={e => setPagos(p => ({ ...p, efUSD: +e.target.value }))} /></div>
            <div><label className="text-xs">Transfer.</label><input type="number" className="input" value={pagos.tfUSD} onChange={e => setPagos(p => ({ ...p, tfUSD: +e.target.value }))} /></div>
            <div><label className="text-xs">Crédito</label><input type="number" className="input" value={pagos.crUSD} onChange={e => setPagos(p => ({ ...p, crUSD: +e.target.value }))} /></div>
          </div>
          <div className="p-2 rounded text-sm" style={{ background: Math.abs(sumaPagosCUP - totalCUP) < 0.5 ? '#d1fae5' : '#fee2e2' }}>
            Suma pagos CUP: {fmt(sumaPagosCUP)} {Math.abs(sumaPagosCUP - totalCUP) < 0.5 ? '✓' : '✗'}
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setCobrarModal(false)}>Cancelar</button>
          <button className="btn btn-ok" onClick={confirmarVenta}>✓ Confirmar Venta</button>
        </div>
      </Modal>

      <Modal open={!!ticketVenta} onClose={() => setTicketVenta(null)} title="Ticket de Venta">
        {ticketVenta && (
          <div className="print-area ticket">
            <div className="text-center mb-2">
              <p className="font-bold">{cfg.biz || 'FerreteríaPRO'}</p>
              {cfg.addr && <p>{cfg.addr}</p>}
              {cfg.phone && <p>Tel: {cfg.phone}</p>}
              {cfg.nit && <p>NIT: {cfg.nit}</p>}
            </div>
            <hr />
            <p>No: {ticketVenta.num}</p>
            <p>Fecha: {fmtDateTime(ticketVenta.fecha)}</p>
            {ticketVenta.clienteNombre && <p>Cliente: {ticketVenta.clienteNombre}</p>}
            <hr />
            {ticketVenta.items.map((it, i) => (
              <div key={i} className="ticket-line"><span>{it.cantidad}× {it.nombre}</span><span>{fmt(it.subtotalCUP)}</span></div>
            ))}
            <hr />
            {ticketVenta.descuento > 0 && <div className="ticket-line"><span>Descuento {ticketVenta.descuento}%</span><span>-</span></div>}
            <div className="ticket-line font-bold"><span>TOTAL CUP</span><span>{fmt(ticketVenta.totalCUP)}</span></div>
            <div className="ticket-line"><span>TOTAL USD</span><span>{fmt(ticketVenta.totalUSD)}</span></div>
            <hr />
            <p className="text-center mt-2">¡Gracias por su compra!</p>
          </div>
        )}
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-primary" onClick={printTicket}>🖨️ Imprimir</button>
          <button className="btn btn-ghost" onClick={() => setTicketVenta(null)}>Cerrar</button>
        </div>
      </Modal>
    </div>
  );
}

// ============ SALES ============
function Sales({ cfg }: { cfg: Record<string, any> }) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [anularModal, setAnularModal] = useState<Venta | null>(null);
  const [viewTicket, setViewTicket] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');

  const load = useCallback(async () => { setVentas(await dbGetAll<Venta>('ventas')); }, []);
  useEffect(() => { load(); }, [load]);

  let filtered = [...ventas].sort((a, b) => b.fecha - a.fecha);
  if (search) filtered = filtered.filter(v => v.num.toLowerCase().includes(search.toLowerCase()) || v.clienteNombre.toLowerCase().includes(search.toLowerCase()));
  if (dateFrom) filtered = filtered.filter(v => v.fecha >= new Date(dateFrom).getTime());
  if (dateTo) filtered = filtered.filter(v => v.fecha <= new Date(dateTo).getTime() + 86400000);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ventasHoy = ventas.filter(v => v.fecha >= today.getTime() && v.estado === 'pagada');
  const totalHoy = ventasHoy.reduce((s, v) => s + v.totalCUP, 0);
  const totalUSDHoy = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
  const gananciaHoy = ventasHoy.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad, 0), 0);
  const totalHistorico = ventas.filter(v => v.estado === 'pagada').reduce((s, v) => s + v.totalCUP, 0);

  const anular = async () => {
    if (!anularModal) return;
    if (!motivo) { showToast('Seleccione un motivo', 'err'); return; }
    if (!detalle.trim()) { showToast('Detalle requerido', 'err'); return; }

    // Revert stock
    const productos = await dbGetAll<Producto>('productos');
    for (const item of anularModal.items) {
      const p = productos.find(pr => pr.id === item.productoId);
      if (p) await dbPut('productos', { ...p, stock: p.stock + item.cantidad });
    }

    // Revert client credit
    if (anularModal.creditoCUP > 0 || anularModal.creditoUSD > 0) {
      const clientes = await dbGetAll<Cliente>('clientes');
      const cl = clientes.find(c => c.id === anularModal.clienteId);
      if (cl) await dbPut('clientes', { ...cl, saldoCUP: cl.saldoCUP - anularModal.creditoCUP, saldoUSD: cl.saldoUSD - anularModal.creditoUSD });
    }

    // Update sale
    await dbPut('ventas', { ...anularModal, estado: 'anulada' as const });

    // Create cancellation record
    const anul: Anulacion = {
      ventaId: anularModal.id!, num: anularModal.num, fechaAnulacion: Date.now(), fechaOriginal: anularModal.fecha,
      totalCUP: anularModal.totalCUP, totalUSD: anularModal.totalUSD, motivo, detalle,
      estado: 'pendiente', items: anularModal.items, auditado: null
    };
    await dbAdd('anulaciones', anul);

    showToast('Venta anulada', 'ok');
    setAnularModal(null); setMotivo(''); setDetalle(''); load();
  };

  return (
    <div>
      <div className="grid-4 mb-4">
        <div className="kpi"><div className="kpi-label">Ventas Hoy</div><div className="kpi-value">{ventasHoy.length}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Ingresos Hoy</div><div className="kpi-value">{fmt(totalHoy)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">USD Hoy</div><div className="kpi-value">{fmt(totalUSDHoy)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--info)' }}><div className="kpi-label">Ganancia Hoy</div><div className="kpi-value">{fmt(gananciaHoy)}</div></div>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="input max-w-xs" placeholder="Buscar # o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" className="input max-w-[150px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" className="input max-w-[150px]" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total CUP</th><th>Total USD</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} style={{ opacity: v.estado === 'anulada' ? 0.5 : 1 }}>
                <td className="font-mono text-xs">{v.num}</td><td className="text-xs">{fmtDateTime(v.fecha)}</td>
                <td>{v.clienteNombre || '-'}</td><td>{v.items.length}</td>
                <td className="font-semibold">{fmt(v.totalCUP)}</td><td>{fmt(v.totalUSD)}</td>
                <td>{v.estado === 'pagada' ? <span className="badge badge-ok">Pagada</span> : <span className="badge badge-err">Anulada</span>}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewTicket(v)}>👁️</button>
                  {v.estado === 'pagada' && <button className="btn btn-ghost btn-sm" onClick={() => setAnularModal(v)}>🚫</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!anularModal} onClose={() => setAnularModal(null)} title="Anular Venta">
        {anularModal && (
          <div className="space-y-3">
            <p className="text-sm">Venta: <strong>{anularModal.num}</strong> - Total: {fmt(anularModal.totalCUP)} CUP</p>
            <div><label className="text-xs font-medium">Motivo *</label>
              <select className="input" value={motivo} onChange={e => setMotivo(e.target.value)}>
                <option value="">Seleccionar...</option>
                <option>Error de digitación</option><option>Cliente se arrepintió</option><option>Producto defectuoso</option><option>Otro</option>
              </select></div>
            <div><label className="text-xs font-medium">Detalle *</label><textarea className="input" rows={3} value={detalle} onChange={e => setDetalle(e.target.value)} /></div>
          </div>
        )}
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setAnularModal(null)}>Cancelar</button>
          <button className="btn btn-err" onClick={anular}>Anular Venta</button>
        </div>
      </Modal>

      <Modal open={!!viewTicket} onClose={() => setViewTicket(null)} title="Detalle de Venta">
        {viewTicket && (
          <div className="print-area ticket">
            <div className="text-center mb-2"><p className="font-bold">{cfg.biz}</p><p>No: {viewTicket.num}</p><p>{fmtDateTime(viewTicket.fecha)}</p></div>
            {viewTicket.clienteNombre && <p>Cliente: {viewTicket.clienteNombre}</p>}
            <hr className="my-2" />
            {viewTicket.items.map((it, i) => <div key={i} className="ticket-line"><span>{it.cantidad}× {it.nombre}</span><span>{fmt(it.subtotalCUP)}</span></div>)}
            <hr className="my-2" />
            {viewTicket.descuento > 0 && <p>Descuento: {viewTicket.descuento}%</p>}
            <div className="ticket-line font-bold"><span>TOTAL</span><span>{fmt(viewTicket.totalCUP)} CUP</span></div>
            <div className="ticket-line"><span>USD</span><span>{fmt(viewTicket.totalUSD)}</span></div>
            <p className="mt-2">Estado: {viewTicket.estado}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============ CANCELLATIONS ============
function Cancellations({ cfg }: { cfg: Record<string, any> }) {
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [viewDetail, setViewDetail] = useState<Anulacion | null>(null);

  const load = useCallback(async () => { setAnulaciones(await dbGetAll<Anulacion>('anulaciones')); }, []);
  useEffect(() => { load(); }, [load]);

  const pendientes = anulaciones.filter(a => a.estado === 'pendiente');
  const auditadas = anulaciones.filter(a => a.estado === 'revertida');

  const auditar = async (a: Anulacion) => {
    await dbPut('anulaciones', { ...a, estado: 'revertida' as const, auditado: Date.now() });
    showToast('Anulación auditada', 'ok'); load();
  };

  return (
    <div>
      <div className="grid-3 mb-4">
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Pendientes</div><div className="kpi-value">{pendientes.length}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Auditadas</div><div className="kpi-value">{auditadas.length}</div></div>
        <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{anulaciones.length}</div></div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Venta</th><th>Fecha Anulación</th><th>Total CUP</th><th>Total USD</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {[...anulaciones].sort((a, b) => b.fechaAnulacion - a.fechaAnulacion).map(a => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.num}</td><td className="text-xs">{fmtDateTime(a.fechaAnulacion)}</td>
                <td>{fmt(a.totalCUP)}</td><td>{fmt(a.totalUSD)}</td><td className="text-xs">{a.motivo}</td>
                <td>{a.estado === 'pendiente' ? <span className="badge badge-warn">Pendiente</span> : <span className="badge badge-ok">Revertida</span>}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewDetail(a)}>👁️</button>
                  {a.estado === 'pendiente' && <button className="btn btn-ok btn-sm" onClick={() => auditar(a)}>✓</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anulaciones.length === 0 && <p className="text-center py-8" style={{ color: 'var(--text2)' }}>Sin anulaciones</p>}

      <Modal open={!!viewDetail} onClose={() => setViewDetail(null)} title="Detalle de Anulación">
        {viewDetail && (
          <div className="space-y-3">
            <p><strong>Venta:</strong> {viewDetail.num}</p>
            <p><strong>Fecha original:</strong> {fmtDateTime(viewDetail.fechaOriginal)}</p>
            <p><strong>Fecha anulación:</strong> {fmtDateTime(viewDetail.fechaAnulacion)}</p>
            <p><strong>Motivo:</strong> {viewDetail.motivo}</p>
            <p><strong>Detalle:</strong> {viewDetail.detalle}</p>
            <p><strong>Total:</strong> {fmt(viewDetail.totalCUP)} CUP / {fmt(viewDetail.totalUSD)} USD</p>
            <hr />
            <p className="font-semibold">Items:</p>
            {viewDetail.items.map((it, i) => <div key={i} className="flex justify-between text-sm"><span>{it.cantidad}× {it.nombre}</span><span>{fmt(it.subtotalCUP)} CUP</span></div>)}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============ CLIENTS ============
function Clients({ cfg }: { cfg: Record<string, any> }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modal, setModal] = useState(false);
  const [abonoModal, setAbonoModal] = useState<Cliente | null>(null);
  const [editItem, setEditItem] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [abonoCUP, setAbonoCUP] = useState(0);
  const [abonoUSD, setAbonoUSD] = useState(0);
  const [abonoNota, setAbonoNota] = useState('');

  const load = useCallback(async () => { setClientes(await dbGetAll<Cliente>('clientes')); }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm({ nombre: '', telefono: '', email: '', direccion: '', notas: '', saldoCUP: 0, saldoUSD: 0, compras: 0, ultimaCompra: 0 }); setModal(true); };
  const openEdit = (c: Cliente) => { setEditItem(c); setForm({ ...c }); setModal(true); };

  const save = async () => {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', 'err'); return; }
    if (editItem) {
      await dbPut('clientes', { ...editItem, ...form });
      showToast('Cliente actualizado', 'ok');
    } else {
      await dbAdd('clientes', { ...form, creado: Date.now() } as Cliente);
      showToast('Cliente creado', 'ok');
    }
    setModal(false); load();
  };

  const del = async (c: Cliente) => {
    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return;
    await dbDelete('clientes', c.id!); showToast('Cliente eliminado', 'ok'); load();
  };

  const registrarAbono = async () => {
    if (!abonoModal || (abonoCUP <= 0 && abonoUSD <= 0)) { showToast('Ingrese un monto', 'err'); return; }
    const updated = { ...abonoModal, saldoCUP: Math.max(0, abonoModal.saldoCUP - abonoCUP), saldoUSD: Math.max(0, abonoModal.saldoUSD - abonoUSD) };
    await dbPut('clientes', updated);
    showToast(`Abono registrado: ${fmt(abonoCUP)} CUP / ${fmt(abonoUSD)} USD`, 'ok');
    setAbonoModal(null); setAbonoCUP(0); setAbonoUSD(0); setAbonoNota(''); load();
  };

  const conSaldo = clientes.filter(c => c.saldoCUP > 0 || c.saldoUSD > 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm" style={{ color: 'var(--text2)' }}>{clientes.length} clientes | {conSaldo.length} con saldo</p>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo Cliente</button>
      </div>

      {conSaldo.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="font-semibold mb-3">💳 Cuentas por Cobrar</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Saldo CUP</th><th>Saldo USD</th><th>Compras</th><th></th></tr></thead>
              <tbody>
                {conSaldo.map(c => (
                  <tr key={c.id}><td className="font-medium">{c.nombre}</td><td className="font-semibold">{fmt(c.saldoCUP)}</td><td>{fmt(c.saldoUSD)}</td><td>{c.compras}</td>
                    <td><button className="btn btn-ok btn-sm" onClick={() => setAbonoModal(c)}>💵 Abono</button> <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Saldo CUP</th><th>Saldo USD</th><th>Compras</th><th></th></tr></thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id}><td className="font-medium">{c.nombre}</td><td>{c.telefono}</td><td>{c.email}</td>
                <td>{fmt(c.saldoCUP)}</td><td>{fmt(c.saldoUSD)}</td><td>{c.compras}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button> <button className="btn btn-ghost btn-sm" onClick={() => del(c)}>🗑️</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <div className="space-y-3">
          <div><label className="text-xs font-medium">Nombre *</label><input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Teléfono</label><input className="input" value={form.telefono || ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Email</label><input className="input" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div><label className="text-xs font-medium">Dirección</label><input className="input" value={form.direccion || ''} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Notas</label><textarea className="input" rows={2} value={form.notas || ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </Modal>

      <Modal open={!!abonoModal} onClose={() => setAbonoModal(null)} title="Registrar Abono">
        {abonoModal && (
          <div className="space-y-3">
            <p className="text-sm">Cliente: <strong>{abonoModal.nombre}</strong></p>
            <p className="text-sm">Saldo actual: <strong>{fmt(abonoModal.saldoCUP)} CUP</strong> / <strong>{fmt(abonoModal.saldoUSD)} USD</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Abono CUP</label><input type="number" className="input" value={abonoCUP} onChange={e => setAbonoCUP(+e.target.value)} /></div>
              <div><label className="text-xs font-medium">Abono USD</label><input type="number" className="input" value={abonoUSD} onChange={e => setAbonoUSD(+e.target.value)} /></div>
            </div>
            <div><label className="text-xs font-medium">Nota</label><input className="input" value={abonoNota} onChange={e => setAbonoNota(e.target.value)} /></div>
          </div>
        )}
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setAbonoModal(null)}>Cancelar</button>
          <button className="btn btn-ok" onClick={registrarAbono}>Registrar Abono</button>
        </div>
      </Modal>
    </div>
  );
}

// ============ METRICS ============
function Metrics({ cfg }: { cfg: Record<string, any> }) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chart1 = useRef<Chart | null>(null);
  const chart2 = useRef<Chart | null>(null);

  const load = useCallback(async () => {
    setVentas(await dbGetAll<Venta>('ventas'));
    setProductos(await dbGetAll<Producto>('productos'));
    setGastos(await dbGetAll<Gasto>('gastos'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const pagadas = ventas.filter(v => v.estado === 'pagada');
  let filtered = pagadas;
  if (dateFrom) filtered = filtered.filter(v => v.fecha >= new Date(dateFrom).getTime());
  if (dateTo) filtered = filtered.filter(v => v.fecha <= new Date(dateTo).getTime() + 86400000);

  const ingresosCUP = filtered.reduce((s, v) => s + v.totalCUP, 0);
  const ingresosUSD = filtered.reduce((s, v) => s + v.totalUSD, 0);
  const ganancia = filtered.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad, 0), 0);
  const gastosTotal = gastos.filter(g => {
    if (dateFrom && g.fecha < new Date(dateFrom).getTime()) return false;
    if (dateTo && g.fecha > new Date(dateTo).getTime() + 86400000) return false;
    return true;
  }).reduce((s, g) => s + g.montoCUP, 0);
  const utilidad = ganancia - gastosTotal;

  // Top products by quantity
  const prodMap: Record<number, { nombre: string; cantidad: number; ingresoCUP: number; ingresoUSD: number; ganCUP: number; ganUSD: number }> = {};
  filtered.forEach(v => v.items.forEach(it => {
    if (!prodMap[it.productoId]) prodMap[it.productoId] = { nombre: it.nombre, cantidad: 0, ingresoCUP: 0, ingresoUSD: 0, ganCUP: 0, ganUSD: 0 };
    prodMap[it.productoId].cantidad += it.cantidad;
    prodMap[it.productoId].ingresoCUP += it.subtotalCUP;
    prodMap[it.productoId].ingresoUSD += it.subtotalUSD;
    prodMap[it.productoId].ganCUP += (it.precioCUP - it.pep) * it.cantidad;
    prodMap[it.productoId].ganUSD += (it.precioUSD - it.pepUSD) * it.cantidad;
  }));
  const topProd = Object.entries(prodMap).sort((a, b) => b[1].cantidad - a[1].cantidad).slice(0, 10);
  const topGan = Object.entries(prodMap).sort((a, b) => b[1].ganCUP - a[1].ganCUP).slice(0, 10);

  useEffect(() => {
    if (!chartRef.current || !chartRef2.current) return;
    // Daily trend
    const dayMap: Record<string, number> = {};
    filtered.forEach(v => { const d = fmtDate(v.fecha); dayMap[d] = (dayMap[d] || 0) + v.totalCUP; });
    const days = Object.keys(dayMap).sort(); const vals = days.map(d => dayMap[d]);
    if (chart1.current) chart1.current.destroy();
    chart1.current = new Chart(chartRef.current, {
      type: 'line', data: { labels: days, datasets: [{ label: 'Ventas CUP', data: vals, borderColor: '#3b82f6', tension: 0.3, fill: true, backgroundColor: 'rgba(59,130,246,0.1)' }] },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
    // Payment methods
    const pagos = { efCUP: 0, tfCUP: 0, crCUP: 0, efUSD: 0, tfUSD: 0, crUSD: 0 };
    filtered.forEach(v => { pagos.efCUP += v.pagos.efCUP; pagos.tfCUP += v.pagos.tfCUP; pagos.crCUP += v.pagos.crCUP; pagos.efUSD += v.pagos.efUSD; pagos.tfUSD += v.pagos.tfUSD; pagos.crUSD += v.pagos.crUSD; });
    const labels = ['Efectivo CUP', 'Transf. CUP', 'Crédito CUP', 'Efectivo USD', 'Transf. USD', 'Crédito USD'];
    const data = [pagos.efCUP, pagos.tfCUP, pagos.crCUP, pagos.efUSD, pagos.tfUSD, pagos.crUSD].map(v => Math.round(v));
    if (chart2.current) chart2.current.destroy();
    chart2.current = new Chart(chartRef2.current, {
      type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'] }] },
      options: { responsive: true }
    });
    return () => { chart1.current?.destroy(); chart2.current?.destroy(); };
  }, [filtered]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input type="date" className="input max-w-[150px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" className="input max-w-[150px]" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>
      <div className="grid-4 mb-4">
        <div className="kpi"><div className="kpi-label">Ingresos CUP</div><div className="kpi-value">{fmt(ingresosCUP)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Ingresos USD</div><div className="kpi-value">{fmt(ingresosUSD)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Ganancia Bruta</div><div className="kpi-value">{fmt(ganancia)}</div></div>
        <div className="kpi" style={{ borderLeftColor: utilidad >= 0 ? 'var(--ok)' : 'var(--err)' }}><div className="kpi-label">Utilidad Neta</div><div className="kpi-value">{fmt(utilidad)}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-4"><h3 className="font-semibold mb-3">Tendencia de Ventas</h3><canvas ref={chartRef}></canvas></div>
        <div className="card p-4"><h3 className="font-semibold mb-3">Métodos de Pago</h3><canvas ref={chartRef2}></canvas></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="font-semibold mb-3">🏆 Top Productos (Cantidad)</h3>
          <table><thead><tr><th>Producto</th><th>Cant.</th><th>Ingreso CUP</th><th>Ingreso USD</th></tr></thead>
            <tbody>{topProd.map(([id, d]) => <tr key={id}><td>{d.nombre}</td><td>{d.cantidad}</td><td>{fmt(d.ingresoCUP)}</td><td>{fmt(d.ingresoUSD)}</td></tr>)}</tbody></table>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">💰 Mayor Ganancia</h3>
          <table><thead><tr><th>Producto</th><th>Cant.</th><th>Gan. CUP</th><th>Gan. USD</th></tr></thead>
            <tbody>{topGan.map(([id, d]) => <tr key={id}><td>{d.nombre}</td><td>{d.cantidad}</td><td>{fmt(d.ganCUP)}</td><td>{fmt(d.ganUSD)}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

// ============ EXPENSES ============
function Expenses({ cfg }: { cfg: Record<string, any> }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<Gasto | null>(null);
  const [form, setForm] = useState<Partial<Gasto>>({});

  const cats = ['Salarios', 'Alquiler', 'Electricidad', 'Internet', 'Combustible', 'Mantenimiento', 'Otros'];

  const load = useCallback(async () => { setGastos(await dbGetAll<Gasto>('gastos')); }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm({ concepto: '', categoria: cats[0], fecha: Date.now(), nota: '', montoCUP: 0, montoUSD: 0 }); setModal(true); };
  const openEdit = (g: Gasto) => { setEditItem(g); setForm({ ...g }); setModal(true); };

  const save = async () => {
    if (!form.concepto?.trim()) { showToast('Concepto requerido', 'err'); return; }
    if ((form.montoCUP || 0) <= 0 && (form.montoUSD || 0) <= 0) { showToast('Al menos un monto > 0', 'err'); return; }
    if (editItem) {
      await dbPut('gastos', { ...editItem, ...form });
      showToast('Gasto actualizado', 'ok');
    } else {
      await dbAdd('gastos', { ...form, creado: Date.now() } as Gasto);
      showToast('Gasto registrado', 'ok');
    }
    setModal(false); load();
  };

  const del = async (g: Gasto) => {
    if (!confirm(`¿Eliminar "${g.concepto}"?`)) return;
    await dbDelete('gastos', g.id!); showToast('Gasto eliminado', 'ok'); load();
  };

  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const gastosMes = gastos.filter(g => g.fecha >= monthStart);
  const totalMesCUP = gastosMes.reduce((s, g) => s + g.montoCUP, 0);
  const totalMesUSD = gastosMes.reduce((s, g) => s + g.montoUSD, 0);
  const totalHist = gastos.reduce((s, g) => s + g.montoCUP, 0);

  return (
    <div>
      <div className="grid-3 mb-4">
        <div className="kpi"><div className="kpi-label">Gastos Mes CUP</div><div className="kpi-value">{fmt(totalMesCUP)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Gastos Mes USD</div><div className="kpi-value">{fmt(totalMesUSD)}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Total Histórico</div><div className="kpi-value">{fmt(totalHist)}</div></div>
      </div>
      <div className="flex justify-end mb-4"><button className="btn btn-primary" onClick={openNew}>+ Nuevo Gasto</button></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Monto CUP</th><th>Monto USD</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            {[...gastos].sort((a, b) => b.fecha - a.fecha).map(g => (
              <tr key={g.id}><td className="text-xs">{fmtDate(g.fecha)}</td><td className="font-medium">{g.concepto}</td><td>{g.categoria}</td>
                <td>{fmt(g.montoCUP)}</td><td>{fmt(g.montoUSD)}</td><td className="text-xs">{g.nota}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>✏️</button> <button className="btn btn-ghost btn-sm" onClick={() => del(g)}>🗑️</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {gastos.length === 0 && <p className="text-center py-8" style={{ color: 'var(--text2)' }}>Sin gastos registrados</p>}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Editar Gasto' : 'Nuevo Gasto'}>
        <div className="space-y-3">
          <div><label className="text-xs font-medium">Concepto *</label><input className="input" value={form.concepto || ''} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Categoría</label><select className="input" value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>{cats.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs font-medium">Fecha</label><input type="date" className="input" value={form.fecha ? new Date(form.fecha).toISOString().split('T')[0] : ''} onChange={e => setForm(f => ({ ...f, fecha: new Date(e.target.value).getTime() }))} /></div>
            <div><label className="text-xs font-medium">Monto CUP</label><input type="number" className="input" value={form.montoCUP || 0} onChange={e => setForm(f => ({ ...f, montoCUP: +e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Monto USD</label><input type="number" className="input" value={form.montoUSD || 0} onChange={e => setForm(f => ({ ...f, montoUSD: +e.target.value }))} /></div>
          </div>
          <div><label className="text-xs font-medium">Nota</label><input className="input" value={form.nota || ''} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </Modal>
    </div>
  );
}

// ============ BACKUP ============
function Backup({ cfg }: { cfg: Record<string, any> }) {
  const [importing, setImporting] = useState(false);

  const exportJSON = async () => {
    const data = {
      productos: await dbGetAll('productos'),
      compras: await dbGetAll('compras'),
      ventas: await dbGetAll('ventas'),
      clientes: await dbGetAll('clientes'),
      gastos: await dbGetAll('gastos'),
      anulaciones: await dbGetAll('anulaciones'),
      config: await dbGetAll('config'),
      tasas: await dbGetAll('tasas'),
      exportDate: Date.now()
    };
    const json = JSON.stringify(data);
    const encrypted = await encryptData(json);
    const blob = new Blob([encrypted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ferreteria_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Respaldo exportado (cifrado)', 'ok');
  };

  const exportCSV = async (store: string, filename: string) => {
    const data = await dbGetAll<any>(store);
    if (data.length === 0) { showToast('Sin datos', 'warn'); return; }
    const headers = Object.keys(data[0]).filter(k => k !== 'foto');
    const csv = [headers.join(','), ...data.map(row => headers.map(h => {
      const v = row[h]; if (typeof v === 'string' && v.includes(',')) return `"${v}"`; if (Array.isArray(v)) return `"${JSON.stringify(v)}"`; return v ?? '';
    }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    showToast(`${filename} exportado`, 'ok');
  };

  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!confirm('¿Restaurar datos? Esto reemplazará TODOS los datos actuales.')) return;
    setImporting(true);
    try {
      const text = await file.text();
      let json: string;
      try { json = await decryptData(text); } catch { json = text; }
      const data = JSON.parse(json);
      const stores = ['productos', 'compras', 'ventas', 'clientes', 'gastos', 'anulaciones', 'config', 'tasas'];
      for (const store of stores) {
        if (data[store]) { await dbClear(store); for (const item of data[store]) await dbPut(store, item); }
      }
      showToast('Datos restaurados correctamente', 'ok');
    } catch (err) { showToast('Error al importar: ' + (err as Error).message, 'err'); }
    setImporting(false); e.target.value = '';
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showToast('CSV vacío', 'err'); return; }
    const headers = lines[0].split(',').map(h => h.trim());
    let imported = 0, errors = 0;
    for (let i = 1; i < lines.length; i++) {
      try {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          const v = vals[idx] || '';
          if (['compraCUP', 'compraUSD', 'ventaCUP', 'ventaUSD', 'pep', 'pepUSD', 'stock', 'min'].includes(h)) obj[h] = parseFloat(v) || 0;
          else obj[h] = v;
        });
        obj.creado = Date.now();
        if (obj.nombre) { await dbAdd('productos', obj); imported++; }
        else errors++;
      } catch { errors++; }
    }
    showToast(`Importados: ${imported} | Errores: ${errors}`, imported > 0 ? 'ok' : 'warn');
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csv = 'codigo,nombre,categoria,unidad,compra_cup,compra_usd,venta_cup,venta_usd,stock,min\nCOD001,Martillo,Herramientas,Unidad,100,0,200,0,10,2\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const clearAll = async () => {
    if (!confirm('⚠️ ¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
    if (!confirm('¿Está COMPLETAMENTE seguro?')) return;
    const stores = ['productos', 'compras', 'ventas', 'clientes', 'gastos', 'anulaciones', 'tasas', 'logs'];
    for (const s of stores) await dbClear(s);
    showToast('Todos los datos han sido eliminados', 'warn');
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">📤 Exportar</h3>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={exportJSON}>📦 JSON Cifrado (Recomendado)</button>
          <button className="btn btn-ghost" onClick={() => exportCSV('productos', 'productos.csv')}>📄 CSV Productos</button>
          <button className="btn btn-ghost" onClick={() => exportCSV('ventas', 'ventas.csv')}>📄 CSV Ventas</button>
          <button className="btn btn-ghost" onClick={() => exportCSV('compras', 'compras.csv')}>📄 CSV Compras</button>
          <button className="btn btn-ghost" onClick={() => exportCSV('gastos', 'gastos.csv')}>📄 CSV Gastos</button>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">📥 Importar</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="btn btn-ok cursor-pointer">
            📦 Restaurar JSON {importing && '...'}
            <input type="file" accept=".json" className="hidden" onChange={importJSON} disabled={importing} />
          </label>
          <label className="btn btn-info cursor-pointer">
            📄 Importar Productos CSV
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
          <button className="btn btn-ghost" onClick={downloadTemplate}>📋 Descargar Plantilla CSV</button>
        </div>
      </div>
      <div className="card p-6" style={{ borderColor: 'var(--err)' }}>
        <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--err)' }}>⚠️ Zona Peligrosa</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text2)' }}>Eliminar todos los datos de la aplicación. Esta acción es irreversible.</p>
        <button className="btn btn-err" onClick={clearAll}>🗑️ Borrar Todo</button>
      </div>
    </div>
  );
}

// ============ SETTINGS ============
function Settings({ cfg, refreshCfg }: { cfg: Record<string, any>; refreshCfg: () => void }) {
  const [tasa, setTasa] = useState(cfg.tasa || 350);
  const [biz, setBiz] = useState(cfg.biz || '');
  const [addr, setAddr] = useState(cfg.addr || '');
  const [phone, setPhone] = useState(cfg.phone || '');
  const [nit, setNit] = useState(cfg.nit || '');
  const [tema, setTema] = useState(cfg.tema || 'auto');
  const [size, setSize] = useState(cfg.size || 'md');
  const [units, setUnits] = useState<string[]>(cfg.units || []);
  const [cats, setCats] = useState<string[]>(cfg.cats || []);
  const [newUnit, setNewUnit] = useState('');
  const [newCat, setNewCat] = useState('');
  const [showTasas, setShowTasas] = useState(false);
  const [tasas, setTasas] = useState<Tasa[]>([]);

  useEffect(() => { (async () => { setTasas(await dbGetAll<Tasa>('tasas')); })(); }, []);

  const saveTasa = async () => {
    const anterior = cfg.tasa || 350;
    await setConfig('tasa', tasa);
    await dbAdd('tasas', { fecha: Date.now(), anterior, nueva: tasa });
    setTasas(await dbGetAll<Tasa>('tasas'));
    await refreshCfg();
    showToast(`Tasa actualizada: ${anterior} → ${tasa}`, 'ok');
  };

  const saveBiz = async () => {
    await setConfig('biz', biz); await setConfig('addr', addr); await setConfig('phone', phone); await setConfig('nit', nit);
    await refreshCfg(); showToast('Datos del negocio guardados', 'ok');
  };

  const saveTema = async () => { await setConfig('tema', tema); await refreshCfg(); };
  const saveSize = async () => { await setConfig('size', size); await refreshCfg(); };

  const addUnit = async () => {
    if (!newUnit.trim()) return;
    const updated = [...units, newUnit.trim()];
    await setConfig('units', updated); setUnits(updated); setNewUnit(''); await refreshCfg();
  };
  const removeUnit = async (u: string) => {
    const updated = units.filter(x => x !== u);
    await setConfig('units', updated); setUnits(updated); await refreshCfg();
  };
  const addCat = async () => {
    if (!newCat.trim()) return;
    const updated = [...cats, newCat.trim()];
    await setConfig('cats', updated); setCats(updated); setNewCat(''); await refreshCfg();
  };
  const removeCat = async (c: string) => {
    const updated = cats.filter(x => x !== c);
    await setConfig('cats', updated); setCats(updated); await refreshCfg();
  };

  const lic = getLicense();

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">💱 Tasa de Cambio</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1"><label className="text-xs font-medium">1 USD = ? CUP</label><input type="number" className="input" value={tasa} onChange={e => setTasa(+e.target.value)} /></div>
          <button className="btn btn-primary" onClick={saveTasa}>Guardar</button>
          <button className="btn btn-ghost" onClick={() => setShowTasas(true)}>📋 Historial</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">🏪 Datos del Negocio</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium">Nombre</label><input className="input" value={biz} onChange={e => setBiz(e.target.value)} /></div>
          <div><label className="text-xs font-medium">Dirección</label><input className="input" value={addr} onChange={e => setAddr(e.target.value)} /></div>
          <div><label className="text-xs font-medium">Teléfono</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="text-xs font-medium">NIT / ID Fiscal</label><input className="input" value={nit} onChange={e => setNit(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary mt-3" onClick={saveBiz}>Guardar</button>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">🎨 Apariencia</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium">Tema</label>
            <select className="input" value={tema} onChange={e => { setTema(e.target.value); setConfig('tema', e.target.value); refreshCfg(); }}>
              <option value="light">Claro</option><option value="dark">Oscuro</option><option value="auto">Automático</option>
            </select></div>
          <div><label className="text-xs font-medium">Tamaño</label>
            <select className="input" value={size} onChange={e => { setSize(e.target.value); setConfig('size', e.target.value); refreshCfg(); }}>
              <option value="sm">Compacto</option><option value="md">Normal</option><option value="lg">Grande</option>
            </select></div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">📏 Unidades de Medida</h3>
        <div className="flex flex-wrap gap-2 mb-3">{units.map(u => <span key={u} className="badge badge-info flex items-center gap-1">{u} <button onClick={() => removeUnit(u)} className="text-red-500">✕</button></span>)}</div>
        <div className="flex gap-2"><input className="input max-w-[200px]" placeholder="Nueva unidad..." value={newUnit} onChange={e => setNewUnit(e.target.value)} /><button className="btn btn-primary btn-sm" onClick={addUnit}>Agregar</button></div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">📁 Categorías</h3>
        <div className="flex flex-wrap gap-2 mb-3">{cats.map(c => <span key={c} className="badge badge-ok flex items-center gap-1">{c} <button onClick={() => removeCat(c)} className="text-red-500">✕</button></span>)}</div>
        <div className="flex gap-2"><input className="input max-w-[200px]" placeholder="Nueva categoría..." value={newCat} onChange={e => setNewCat(e.target.value)} /><button className="btn btn-primary btn-sm" onClick={addCat}>Agregar</button></div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">🔑 Licencia</h3>
        {lic ? (
          <div className="space-y-2">
            <p><strong>Plan:</strong> {lic.plan}</p>
            <p><strong>Estado:</strong> {isLicenseValid() ? <span className="badge badge-ok">Activa</span> : <span className="badge badge-err">Expirada</span>}</p>
            {lic.days > 0 && <p><strong>Expira:</strong> {fmtDate(lic.expires)}</p>}
            {lic.days === 0 && <p><strong>Sin expiración</strong></p>}
            <button className="btn btn-err btn-sm mt-2" onClick={() => { clearLicense(); window.location.reload(); }}>Cerrar Licencia</button>
          </div>
        ) : <p>No hay licencia activa</p>}
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4">⌨️ Atajos de Teclado</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[['F1', 'Ayuda'], ['F2', 'Nuevo producto'], ['F3', 'Ir a POS'], ['F4', 'Cobrar (en POS)'], ['F5', 'Dashboard'], ['F9', 'Modo Kiosco'], ['Esc', 'Cerrar modal / Salir kiosco']].map(([k, v]) => (
            <div key={k} className="flex justify-between p-2 rounded" style={{ background: 'var(--bg3)' }}><kbd className="font-mono text-xs px-2 py-1 rounded" style={{ background: 'var(--bg2)' }}>{k}</kbd><span>{v}</span></div>
          ))}
        </div>
      </div>

      <Modal open={showTasas} onClose={() => setShowTasas(false)} title="Historial de Tasas">
        <table><thead><tr><th>Fecha</th><th>Anterior</th><th>Nueva</th></tr></thead>
          <tbody>{[...tasas].sort((a, b) => b.fecha - a.fecha).map(t => <tr key={t.id}><td>{fmtDateTime(t.fecha)}</td><td>{fmt(t.anterior)}</td><td>{fmt(t.nueva)}</td></tr>)}</tbody></table>
        {tasas.length === 0 && <p className="text-center py-4" style={{ color: 'var(--text2)' }}>Sin historial</p>}
      </Modal>
    </div>
  );
}
