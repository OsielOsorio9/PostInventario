import { useState, useEffect, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { Chart, registerables } from 'chart.js';
import * as XLSX from 'xlsx';
import {
  openDB, dbGetAll, dbAdd, dbPut, dbDelete, dbClear,
  getConfig, setConfig, initDefaultConfig,
  Storage, verifyMasterKey, getLicense, saveLicense, isLicenseValid, clearLicense,
  encryptData, decryptData, fmt, fmtDate, fmtDateTime, genVentaNum,
  type Producto, type Compra, type Venta, type VentaItem, type Cliente, type Gasto, type Anulacion, type Tasa
} from './lib/db';

Chart.register(...registerables);

const toUSD = (cup: number, tasa: number) => tasa > 0 ? cup / tasa : 0;
const toCUP = (usd: number, tasa: number) => usd * tasa;

// ============ TOAST ============
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

// ============ LICENSE ============
function LicenseScreen({ onActivate }: { onActivate: () => void }) {
  const [step, setStep] = useState<'key' | 'plan'>('key');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const handleKey = () => { if (verifyMasterKey(key)) { setStep('plan'); setErr(''); } else setErr('Clave incorrecta'); };
  const handlePlan = (days: number, plan: string) => { saveLicense({ plan, days, start: Date.now(), expires: days === 0 ? 0 : Date.now() + days * 86400000, active: true }); onActivate(); };
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-6"><h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>🔧 FerreteríaPRO</h1><p className="text-sm mt-2" style={{ color: 'var(--text2)' }}>Sistema de Gestión</p></div>
        {step === 'key' ? (<div><label className="block text-sm font-medium mb-2">Clave de activación</label><input type="password" className="input mb-3" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleKey()} />{err && <p className="text-red-500 text-sm mb-2">{err}</p>}<button className="btn btn-primary w-full justify-center" onClick={handleKey}>Verificar</button></div>) : (<div><p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>Seleccione un plan:</p><div className="grid grid-cols-2 gap-3">{[{ d: 30, n: 'Prueba' }, { d: 90, n: 'Trimestral' }, { d: 365, n: 'Anual' }, { d: 0, n: 'Perpetuo' }].map(p => (<button key={p.d} className="btn btn-ghost flex-col py-4" onClick={() => handlePlan(p.d, p.n)}><span className="font-bold">{p.n}</span><span className="text-xs" style={{ color: 'var(--text2)' }}>{p.d === 0 ? 'Sin expiración' : `${p.d} días`}</span></button>))}</div></div>)}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (<div className="modal-backdrop" onClick={onClose}><div className={`modal ${wide ? 'w-[900px]' : 'w-[500px]'}`} onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">{title}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>{children}</div></div>);
}

// ============ HELP BUTTON ============
function HelpBtn({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (<><button className="help-btn" onClick={() => setShow(true)} title="Ayuda">?</button><Modal open={show} onClose={() => setShow(false)} title="📖 Ayuda"><p className="text-sm whitespace-pre-line" style={{ color: 'var(--text)' }}>{text}</p><div className="flex justify-end mt-4"><button className="btn btn-primary" onClick={() => setShow(false)}>Entendido</button></div></Modal></>);
}

// ============ MAIN APP ============
type Page = 'dashboard' | 'inventory' | 'purchases' | 'pos' | 'sales' | 'cancellations' | 'clients' | 'metrics' | 'expenses' | 'backup' | 'settings' | 'weekly';

export default function App() {
  const [ready, setReady] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [cfg, setCfg] = useState<Record<string, any>>({});
  const [kiosco, setKiosco] = useState(false);

  useEffect(() => {
    Storage.init();
    (async () => { await openDB(); await initDefaultConfig(); const c = await getConfig(); setCfg(c); setReady(true); if (isLicenseValid()) setLicensed(true); })();
  }, []);

  useEffect(() => {
    let isDark = cfg.tema === 'dark' || (cfg.tema === 'auto' && (new Date().getHours() < 6 || new Date().getHours() >= 18));
    document.documentElement.className = isDark ? 'dark' : '';
    document.body.className = cfg.size === 'sm' ? 'size-compact' : cfg.size === 'lg' ? 'size-large' : 'size-normal';
  }, [cfg.tema, cfg.size]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
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
    { id: 'weekly', icon: '📅', label: 'Cierre Semanal' },
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
      {!kiosco && (<aside className="sidebar"><div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}><h1 className="font-bold text-lg" style={{ color: 'var(--primary)' }}>🔧 FerreteríaPRO</h1></div><nav className="flex-1 py-2">{navItems.map(n => (<div key={n.id} className={`sidebar-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}><span>{n.icon}</span><span>{n.label}</span></div>))}</nav><div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}><button className="btn btn-ghost btn-sm w-full justify-center" onClick={() => setKiosco(true)}>⛶ Kiosco</button></div></aside>)}
      <main className="flex-1 overflow-auto">
        {!kiosco && (<header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}><div className="flex items-center gap-3"><h2 className="font-semibold text-lg">{navItems.find(n => n.id === page)?.icon} {navItems.find(n => n.id === page)?.label}</h2></div><div className="flex items-center gap-3"><span className="text-xs" style={{ color: 'var(--text2)' }}>1 USD = {fmt(cfg.tasa || 350)} CUP</span></div></header>)}
        <div className="p-4 md:p-6">
          {page === 'dashboard' && <Dashboard cfg={cfg} setPage={setPage} />}
          {page === 'inventory' && <Inventory cfg={cfg} />}
          {page === 'purchases' && <Purchases cfg={cfg} />}
          {page === 'pos' && <POS cfg={cfg} />}
          {page === 'sales' && <Sales cfg={cfg} />}
          {page === 'weekly' && <WeeklyClose cfg={cfg} />}
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

// ============ HELP TEXTS ============
const HELP = {
  dashboard: '📊 DASHBOARD\n\n• Muestra resumen del día: ventas, ingresos y ganancia\n• Caja en CUP y USD separados con equivalente debajo\n• Inversión total en inventario (valor PEP)\n• Alertas de stock bajo, agotados, clientes con saldo\n• Gráficos de ventas de los últimos 7 días',
  inventory: '📦 INVENTARIO\n\n• CRUD completo de productos\n• Búsqueda por nombre, código o categoría\n• Filtros por estado (disponible, stock bajo, agotado)\n• Inversión total = Stock × PEP\n• Al eliminar: se borra directamente (sin registro en anulaciones)\n• Los precios se convierten automáticamente USD↔CUP',
  purchases: '📥 COMPRAS\n\n• Registra entradas de mercancía\n• Calcula automáticamente el PEP (Precio Promedio Ponderado)\n• Actualiza stock del producto\n• Los precios se convierten automáticamente USD↔CUP\n• ⚠️ La tasa actual se usa para la conversión',
  pos: '🛒 PUNTO DE VENTA\n\n• Busca productos y agrégalos al carrito\n• Botones de pago: Efectivo, Tarjeta, Crédito (CUP/USD)\n• Si hay crédito → requiere cliente seleccionado\n• F4 para cobrar rápido\n• El crédito es cuenta por cobrar (CxC)',
  sales: '🧾 VENTAS\n\n• Historial completo de ventas\n• Muestra lo que hay en caja (CUP y USD separados)\n• Equivalente en la otra moneda debajo\n• KPIs del día: ventas, ingresos, ganancia\n• Se puede anular (revierte stock y crédito)',
  weekly: '📅 CIERRE SEMANAL\n\n• Resumen de la semana (Lunes-Sábado)\n• Ventas totales en CUP y USD\n• Inversión en inventario\n• Ganancia bruta\n• Distribución entre inversionistas\n• Porcentaje de la dependienta\n• Los domingos se descansa',
  cancellations: '🚫 ANULACIONES\n\n• Registro de ventas anuladas\n• Muestra motivo y detalle\n• Se puede auditar (marcar como revisada)\n• Al anular: se revierte stock y crédito del cliente',
  clients: '💳 CLIENTES / CUENTAS POR COBRAR\n\n• Gestión de clientes\n• Cuentas por cobrar = ventas a crédito\n• Registrar abonos parciales\n• El crédito en POS genera saldo aquí',
  metrics: '📈 MÉTRICAS SEMANALES\n\n• Solo datos de la semana actual (Lun-Sáb)\n• Venta total CUP y USD\n• Inversión en inventario\n• Ganancia bruta\n• Distribución: 50% Inv1 + 50% Inv2\n• % de dependienta sobre parte del Inv1',
  expenses: '💸 GASTOS OPERATIVOS\n\n• Registro de gastos por categoría\n• Montos en CUP y USD (conversión automática)\n• KPIs del mes y total histórico\n• Se descuentan de la ganancia en métricas',
  backup: '💾 RESPALDO\n\n• Exportar JSON cifrado (respaldo completo)\n• Exportar Excel con todas las tablas\n• Restaurar desde JSON\n• ⚠️ Borrar todo elimina todos los datos',
  settings: '⚙️ AJUSTES\n\n• Tasa de cambio USD/CUP (con historial)\n• Datos del negocio (aparecen en tickets)\n• Tema claro/oscuro/automático\n• Unidades y categorías personalizables\n• Configuración de inversionistas y dependienta\n• Licencia',
};

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
  const tasa = cfg.tasa || 350;

  const load = useCallback(async () => { setVentas(await dbGetAll<Venta>('ventas')); setProductos(await dbGetAll<Producto>('productos')); setAnulaciones(await dbGetAll<Anulacion>('anulaciones')); setClientes(await dbGetAll<Cliente>('clientes')); }, []);
  useEffect(() => { load(); }, [load]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ventasHoy = ventas.filter(v => v.fecha >= today.getTime() && v.estado === 'pagada');
  
  // Caja real: lo que entró hoy separado por moneda
  const cajaCUP = ventasHoy.reduce((s, v) => s + v.pagos.efCUP + v.pagos.tfCUP, 0);
  const cajaUSD = ventasHoy.reduce((s, v) => s + v.pagos.efUSD + v.pagos.tfUSD, 0);
  const creditoHoyCUP = ventasHoy.reduce((s, v) => s + v.pagos.crCUP, 0);
  const creditoHoyUSD = ventasHoy.reduce((s, v) => s + v.pagos.crUSD, 0);
  const totalHoyCUP = ventasHoy.reduce((s, v) => s + v.totalCUP, 0);
  const totalHoyUSD = ventasHoy.reduce((s, v) => s + v.totalUSD, 0);
  const gananciaHoy = ventasHoy.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad * (1 - v.descuento / 100), 0), 0);
  
  const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= p.min);
  const agotados = productos.filter(p => p.stock <= 0);
  const inversionTotal = productos.reduce((s, p) => s + (p.stock * p.pep), 0);
  const anulPend = anulaciones.filter(a => a.estado === 'pendiente');
  const clientesSaldo = clientes.filter(c => c.saldoCUP > 0 || c.saldoUSD > 0);

  useEffect(() => {
    if (!chartRef1.current || !chartRef2.current) return;
    const days: string[] = []; const vals: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      days.push(d.toLocaleDateString('es-CU', { weekday: 'short' }));
      vals.push(ventas.filter(v => v.fecha >= d.getTime() && v.fecha < next.getTime() && v.estado === 'pagada').reduce((s, v) => s + v.totalCUP, 0));
    }
    if (chart1.current) chart1.current.destroy();
    chart1.current = new Chart(chartRef1.current, { type: 'bar', data: { labels: days, datasets: [{ label: 'Ventas CUP', data: vals, backgroundColor: '#3b82f6' }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    const catMap: Record<string, number> = {};
    ventasHoy.forEach(v => v.items.forEach(it => { const p = productos.find(pr => pr.id === it.productoId); catMap[p?.categoria || 'Otros'] = (catMap[p?.categoria || 'Otros'] || 0) + it.subtotalCUP; }));
    if (chart2.current) chart2.current.destroy();
    chart2.current = new Chart(chartRef2.current, { type: 'pie', data: { labels: Object.keys(catMap).length ? Object.keys(catMap) : ['Sin datos'], datasets: [{ data: Object.values(catMap).length ? Object.values(catMap) : [1], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'] }] }, options: { responsive: true } });
    return () => { chart1.current?.destroy(); chart2.current?.destroy(); };
  }, [ventas, productos, ventasHoy]);

  return (
    <div>
      <div className="flex justify-end mb-3"><HelpBtn text={HELP.dashboard} /></div>
      
      {/* CAJA REAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4" style={{ borderLeft: '4px solid #059669' }}>
          <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--ok)' }}>💵 CAJA CUP HOY</h3>
          <p className="text-2xl font-bold">{fmt(cajaCUP)} CUP</p>
          <p className="equivalent">≈ {fmt(toUSD(cajaCUP, tasa))} USD</p>
          <div className="mt-2 text-xs space-y-1" style={{ color: 'var(--text2)' }}>
            <p>Efectivo: {fmt(ventasHoy.reduce((s, v) => s + v.pagos.efCUP, 0))}</p>
            <p>Transferencia: {fmt(ventasHoy.reduce((s, v) => s + v.pagos.tfCUP, 0))}</p>
            <p>Crédito (CxC): {fmt(creditoHoyCUP)}</p>
          </div>
        </div>
        <div className="card p-4" style={{ borderLeft: '4px solid #0891b2' }}>
          <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--info)' }}>💵 CAJA USD HOY</h3>
          <p className="text-2xl font-bold">{fmt(cajaUSD)} USD</p>
          <p className="equivalent">≈ {fmt(toCUP(cajaUSD, tasa))} CUP</p>
          <div className="mt-2 text-xs space-y-1" style={{ color: 'var(--text2)' }}>
            <p>Efectivo: {fmt(ventasHoy.reduce((s, v) => s + v.pagos.efUSD, 0))}</p>
            <p>Transferencia: {fmt(ventasHoy.reduce((s, v) => s + v.pagos.tfUSD, 0))}</p>
            <p>Crédito (CxC): {fmt(creditoHoyUSD)}</p>
          </div>
        </div>
      </div>

      <div className="grid-4 mb-6">
        <div className="kpi"><div className="kpi-label">Ventas Hoy</div><div className="kpi-value">{ventasHoy.length}</div><p className="equivalent">CUP: {fmt(totalHoyCUP)} | USD: {fmt(totalHoyUSD)}</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Ganancia Hoy</div><div className="kpi-value">{fmt(gananciaHoy)}</div><p className="equivalent">≈ {fmt(toUSD(gananciaHoy, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--info)' }}><div className="kpi-label">Inversión Inventario</div><div className="kpi-value">{fmt(inversionTotal)}</div><p className="equivalent">≈ {fmt(toUSD(inversionTotal, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--err)' }}><div className="kpi-label">Stock Bajo / Agotados</div><div className="kpi-value">{stockBajo.length + agotados.length}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-4"><h3 className="font-semibold mb-3">Ventas últimos 7 días</h3><canvas ref={chartRef1}></canvas></div>
        <div className="card p-4"><h3 className="font-semibold mb-3">Ventas por Categoría (Hoy)</h3><canvas ref={chartRef2}></canvas></div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3">Alertas</h3>
        <div className="space-y-2">
          {agotados.length > 0 && <div className="p-2 rounded cursor-pointer" style={{ background: '#fee2e2' }} onClick={() => setPage('inventory')}><span className="text-sm text-red-700">🔴 {agotados.length} productos agotados</span></div>}
          {stockBajo.length > 0 && <div className="p-2 rounded cursor-pointer" style={{ background: '#fef3c7' }} onClick={() => setPage('inventory')}><span className="text-sm text-amber-700">🟡 {stockBajo.length} productos stock bajo</span></div>}
          {anulPend.length > 0 && <div className="p-2 rounded cursor-pointer" style={{ background: '#fef3c7' }} onClick={() => setPage('cancellations')}><span className="text-sm text-amber-700">🚫 {anulPend.length} anulaciones pendientes</span></div>}
          {clientesSaldo.length > 0 && <div className="p-2 rounded cursor-pointer" style={{ background: '#cffafe' }} onClick={() => setPage('clients')}><span className="text-sm text-cyan-700">💳 {clientesSaldo.length} clientes con saldo pendiente</span></div>}
          {agotados.length === 0 && stockBajo.length === 0 && anulPend.length === 0 && clientesSaldo.length === 0 && <p className="text-sm" style={{ color: 'var(--text2)' }}>✅ Sin alertas</p>}
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
  const [mermaModal, setMermaModal] = useState<Producto | null>(null);
  const [mermaQty, setMermaQty] = useState(0);
  const [mermaNota, setMermaNota] = useState('');
  const [editItem, setEditItem] = useState<Producto | null>(null);
  const [form, setForm] = useState<Partial<Producto>>({});
  const tasa = cfg.tasa || 350;

  const load = useCallback(async () => { setProductos(await dbGetAll<Producto>('productos')); }, []);
  useEffect(() => { load(); }, [load]);

  const fuse = new Fuse(productos, { keys: ['nombre', 'codigo', 'categoria'], threshold: 0.4 });
  let filtered = search ? fuse.search(search).map(r => r.item) : productos;
  if (filterCat) filtered = filtered.filter(p => p.categoria === filterCat);
  if (filterStatus === 'low') filtered = filtered.filter(p => p.stock > 0 && p.stock <= p.min);
  if (filterStatus === 'out') filtered = filtered.filter(p => p.stock <= 0);
  if (filterStatus === 'ok') filtered = filtered.filter(p => p.stock > p.min);

  const inversionTotal = filtered.reduce((s, p) => s + (p.stock * p.pep), 0);

  const openNew = () => { setEditItem(null); setForm({ nombre: '', codigo: '', categoria: cfg.cats?.[0] || '', unidad: cfg.units?.[0] || 'Unidad', compraCUP: 0, compraUSD: 0, ventaCUP: 0, ventaUSD: 0, pep: 0, pepUSD: 0, stock: 0, min: 0, foto: '' }); setModal(true); };
  const openEdit = (p: Producto) => { setEditItem(p); setForm({ ...p }); setModal(true); };

  const handleVentaCUP = (val: number) => setForm(f => ({ ...f, ventaCUP: val, ventaUSD: toUSD(val, tasa) }));
  const handleVentaUSD = (val: number) => setForm(f => ({ ...f, ventaUSD: val, ventaCUP: toCUP(val, tasa) }));
  const handleCompraCUP = (val: number) => setForm(f => ({ ...f, compraCUP: val, compraUSD: toUSD(val, tasa) }));
  const handleCompraUSD = (val: number) => setForm(f => ({ ...f, compraUSD: val, compraCUP: toCUP(val, tasa) }));

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 500000) { showToast('Máximo 500KB', 'err'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, foto: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', 'err'); return; }
    if (editItem) { await dbPut('productos', { ...editItem, ...form }); showToast('Actualizado', 'ok'); }
    else { await dbAdd('productos', { ...form, creado: Date.now() } as Producto); showToast('Creado', 'ok'); }
    setModal(false); load();
  };

  const del = async (p: Producto) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    await dbDelete('productos', p.id!); showToast('Eliminado', 'ok'); load();
  };

  const registrarMerma = async () => {
    if (!mermaModal || mermaQty <= 0) { showToast('Cantidad inválida', 'err'); return; }
    if (mermaQty > mermaModal.stock) { showToast('No puede ser mayor al stock', 'err'); return; }
    await dbPut('productos', { ...mermaModal, stock: mermaModal.stock - mermaQty });
    showToast(`Merma registrada: ${mermaQty} ${mermaModal.unidad} de ${mermaModal.nombre}`, 'warn');
    setMermaModal(null); setMermaQty(0); setMermaNota(''); load();
  };

  const statusBadge = (p: Producto) => {
    if (p.stock <= 0) return <span className="badge badge-err">Agotado</span>;
    if (p.stock <= p.min) return <span className="badge badge-warn">Bajo</span>;
    return <span className="badge badge-ok">OK</span>;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div></div>
        <HelpBtn text={HELP.inventory} />
      </div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input className="input max-w-xs" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[150px]" value={filterCat} onChange={e => setFilterCat(e.target.value)}><option value="">Categorías</option>{(cfg.cats || []).map((c: string) => <option key={c}>{c}</option>)}</select>
        <select className="input max-w-[150px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">Todos</option><option value="ok">Disponibles</option><option value="low">Stock bajo</option><option value="out">Agotados</option></select>
        <div className="flex gap-1 ml-auto">
          <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('grid')}>▦</button>
          <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('table')}>☰</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>
        </div>
      </div>

      <div className="kpi mb-4" style={{ borderLeftColor: 'var(--info)' }}>
        <div className="kpi-label">💰 Inversión Total en Inventario</div>
        <div className="kpi-value">{fmt(inversionTotal)} CUP</div>
        <p className="equivalent">≈ {fmt(toUSD(inversionTotal, tasa))} USD (a tasa actual)</p>
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
                <button className="btn btn-warn btn-sm flex-1" onClick={() => { setMermaModal(p); setMermaQty(0); setMermaNota(''); }}>⚠️</button>
                <button className="btn btn-ghost btn-sm flex-1" onClick={() => del(p)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card table-wrap"><table><thead><tr><th>Producto</th><th>Código</th><th>Cat.</th><th>Stock</th><th>PEP</th><th>Venta</th><th>Inv.</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(p => (<tr key={p.id}><td className="font-medium">{p.nombre}</td><td className="font-mono text-xs">{p.codigo}</td><td>{p.categoria}</td><td>{p.stock}</td><td>{fmt(p.pep)}</td><td>{fmt(p.ventaCUP)}</td><td>{fmt(p.stock * p.pep)}</td><td>{statusBadge(p)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button> <button className="btn btn-warn btn-sm" onClick={() => { setMermaModal(p); setMermaQty(0); setMermaNota(''); }}>⚠️</button> <button className="btn btn-ghost btn-sm" onClick={() => del(p)}>🗑️</button></td></tr>))}</tbody></table></div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Editar Producto' : 'Nuevo Producto'}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs font-medium">Nombre *</label><input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Código</label><input className="input" value={form.codigo || ''} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Categoría</label><select className="input" value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>{(cfg.cats || []).map((c: string) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs font-medium">Unidad</label><select className="input" value={form.unidad || ''} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>{(cfg.units || []).map((u: string) => <option key={u}>{u}</option>)}</select></div>
          <div><label className="text-xs font-medium">Stock</label><input type="number" className="input" value={form.stock || 0} onChange={e => setForm(f => ({ ...f, stock: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Stock Mín.</label><input type="number" className="input" value={form.min || 0} onChange={e => setForm(f => ({ ...f, min: +e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Compra CUP</label><input type="number" className="input" value={form.compraCUP || 0} onChange={e => handleCompraCUP(+e.target.value)} /></div>
          <div><label className="text-xs font-medium">Compra USD</label><input type="number" className="input" value={form.compraUSD || 0} onChange={e => handleCompraUSD(+e.target.value)} /></div>
          <div><label className="text-xs font-medium">Venta CUP</label><input type="number" className="input" value={form.ventaCUP || 0} onChange={e => handleVentaCUP(+e.target.value)} /></div>
          <div><label className="text-xs font-medium">Venta USD</label><input type="number" className="input" value={form.ventaUSD || 0} onChange={e => handleVentaUSD(+e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs font-medium">Foto</label><input type="file" accept="image/*" className="input" onChange={handleFoto} />{form.foto && <img src={form.foto} className="mt-2 w-20 h-20 object-cover rounded" />}</div>
        </div>
        <div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></div>
      </Modal>

      <Modal open={!!mermaModal} onClose={() => setMermaModal(null)} title="⚠️ Registrar Merma">
        {mermaModal && (<div className="space-y-3">
          <p className="text-sm">Producto: <strong>{mermaModal.nombre}</strong> (Stock: {mermaModal.stock} {mermaModal.unidad})</p>
          <div><label className="text-xs font-medium">Cantidad a dar de baja</label><input type="number" className="input" value={mermaQty} onChange={e => setMermaQty(+e.target.value)} /></div>
          <div><label className="text-xs font-medium">Motivo</label><select className="input" value={mermaNota} onChange={e => setMermaNota(e.target.value)}><option value="">Seleccionar...</option><option>Producto defectuoso</option><option>Deterioro</option><option>Robo/Pérdida</option><option>Vencimiento</option><option>Otro</option></select></div>
          <p className="text-xs" style={{ color: 'var(--err)' }}>⚠️ Esto reducirá el stock y la inversión en inventario</p>
        </div>)}
        <div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setMermaModal(null)}>Cancelar</button><button className="btn btn-warn" onClick={registrarMerma}>Registrar Merma</button></div>
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
  const tasa = cfg.tasa || 350;

  const load = useCallback(async () => { setCompras(await dbGetAll<Compra>('compras')); setProductos(await dbGetAll<Producto>('productos')); }, []);
  useEffect(() => { load(); }, [load]);

  const producto = productos.find(p => p.id === form.productoId);
  const handlePrecioCUP = (val: number) => setForm(f => ({ ...f, precioUnitCUP: val, precioUnitUSD: toUSD(val, tasa) }));
  const handlePrecioUSD = (val: number) => setForm(f => ({ ...f, precioUnitUSD: val, precioUnitCUP: toCUP(val, tasa) }));

  const save = async () => {
    if (!form.productoId || !producto) { showToast('Seleccione producto', 'err'); return; }
    if (form.cantidad <= 0) { showToast('Cantidad > 0', 'err'); return; }
    if (form.precioUnitCUP <= 0 && form.precioUnitUSD <= 0) { showToast('Precio > 0', 'err'); return; }
    const newPep = (producto.stock * producto.pep + form.cantidad * form.precioUnitCUP) / (producto.stock + form.cantidad);
    const newPepUSD = (producto.stock * producto.pepUSD + form.cantidad * form.precioUnitUSD) / (producto.stock + form.cantidad);
    await dbAdd('compras', { productoId: producto.id!, productoNombre: producto.nombre, productoCodigo: producto.codigo, cantidad: form.cantidad, unidad: producto.unidad, precioUnitCUP: form.precioUnitCUP, precioUnitUSD: form.precioUnitUSD, totalCUP: form.cantidad * form.precioUnitCUP, totalUSD: form.cantidad * form.precioUnitUSD, nota: form.nota, fecha: Date.now(), creado: Date.now() } as Compra);
    await dbPut('productos', { ...producto, stock: producto.stock + form.cantidad, pep: isNaN(newPep) ? form.precioUnitCUP : newPep, pepUSD: isNaN(newPepUSD) ? form.precioUnitUSD : newPepUSD, compraCUP: Math.max(producto.compraCUP, form.precioUnitCUP), compraUSD: Math.max(producto.compraUSD, form.precioUnitUSD) });
    showToast(`Compra registrada. PEP: ${fmt(isNaN(newPep) ? form.precioUnitCUP : newPep)} CUP`, 'ok');
    setModal(false); setForm({ productoId: 0, cantidad: 0, precioUnitCUP: 0, precioUnitUSD: 0, nota: '' }); load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><p className="text-sm" style={{ color: 'var(--text2)' }}>{compras.length} registros</p><HelpBtn text={HELP.purchases} /></div>
      <div className="flex justify-end mb-4"><button className="btn btn-primary" onClick={() => setModal(true)}>+ Nueva Compra</button></div>
      <div className="card table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>P.Unit CUP</th><th>P.Unit USD</th><th>Total CUP</th><th>Total USD</th></tr></thead><tbody>{[...compras].sort((a, b) => b.fecha - a.fecha).map(c => (<tr key={c.id}><td className="text-xs">{fmtDate(c.fecha)}</td><td>{c.productoNombre}</td><td>{c.cantidad}</td><td>{fmt(c.precioUnitCUP)}</td><td>{fmt(c.precioUnitUSD)}</td><td className="font-semibold">{fmt(c.totalCUP)}</td><td>{fmt(c.totalUSD)}</td></tr>))}</tbody></table></div>
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Compra">
        <div className="space-y-3">
          <div><label className="text-xs font-medium">Producto</label><select className="input" value={form.productoId} onChange={e => setForm(f => ({ ...f, productoId: +e.target.value }))}><option value={0}>Seleccionar...</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock})</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">Cantidad</label><input type="number" className="input" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: +e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Nota</label><input className="input" value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Precio Unit. CUP</label><input type="number" className="input" value={form.precioUnitCUP} onChange={e => handlePrecioCUP(+e.target.value)} /></div>
            <div><label className="text-xs font-medium">Precio Unit. USD</label><input type="number" className="input" value={form.precioUnitUSD} onChange={e => handlePrecioUSD(+e.target.value)} /></div>
          </div>
          {producto && <p className="text-sm p-2 rounded" style={{ background: 'var(--bg3)' }}>Total: <strong>{fmt(form.cantidad * form.precioUnitCUP)} CUP</strong> / <strong>{fmt(form.cantidad * form.precioUnitUSD)} USD</strong></p>}
          <p className="text-xs" style={{ color: 'var(--warn)' }}>⚠️ Tasa actual: {tasa} CUP/USD. Los precios se convierten automáticamente.</p>
        </div>
        <div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Registrar</button></div>
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
  const [pagoActivo, setPagoActivo] = useState('');
  const [pagoMonto, setPagoMonto] = useState(0);
  const tasa = cfg.tasa || 350;

  const load = useCallback(async () => { setProductos(await dbGetAll<Producto>('productos')); setClientes(await dbGetAll<Cliente>('clientes')); }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'F4') { e.preventDefault(); if (cart.length > 0) setCobrarModal(true); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [cart]);

  const fuse = new Fuse(productos.filter(p => p.ventaCUP > 0 || p.ventaUSD > 0), { keys: ['nombre', 'codigo', 'categoria'], threshold: 0.4 });
  const results = search ? fuse.search(search).slice(0, 100).map(r => r.item) : productos.filter(p => p.ventaCUP > 0 || p.ventaUSD > 0).slice(0, 100);

  const addToCart = (p: Producto) => {
    const ex = cart.find(c => c.productoId === p.id);
    if (ex) { if (ex.cantidad + 1 > p.stock) { showToast('Stock insuficiente', 'err'); return; } setCart(cart.map(c => c.productoId === p.id ? { ...c, cantidad: c.cantidad + 1, subtotalCUP: (c.cantidad + 1) * c.precioCUP, subtotalUSD: (c.cantidad + 1) * c.precioUSD } : c)); }
    else { if (p.stock <= 0) { showToast('Sin stock', 'err'); return; } setCart([...cart, { productoId: p.id!, nombre: p.nombre, codigo: p.codigo, cantidad: 1, unidad: p.unidad, precioCUP: p.ventaCUP, precioUSD: p.ventaUSD, subtotalCUP: p.ventaCUP, subtotalUSD: p.ventaUSD, pep: p.pep, pepUSD: p.pepUSD }]); }
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
  const sumaCUP = pagos.efCUP + pagos.tfCUP + pagos.crCUP;
  const sumaUSD = pagos.efUSD + pagos.tfUSD + pagos.crUSD;

  const addPago = (tipo: string) => {
    if (pagoMonto <= 0) return;
    const n = { ...pagos };
    if (tipo === 'efCUP') n.efCUP += pagoMonto;
    else if (tipo === 'tfCUP') n.tfCUP += pagoMonto;
    else if (tipo === 'crCUP') n.crCUP += pagoMonto;
    else if (tipo === 'efUSD') n.efUSD += pagoMonto;
    else if (tipo === 'tfUSD') n.tfUSD += pagoMonto;
    else if (tipo === 'crUSD') n.crUSD += pagoMonto;
    setPagos(n); setPagoMonto(0); setPagoActivo('');
  };

  const confirmarVenta = async () => {
    if (cart.length === 0) { showToast('Carrito vacío', 'err'); return; }
    // Auto-asignar si no hay pagos
    let p = { ...pagos };
    if (sumaCUP === 0 && sumaUSD === 0) {
      if (totalCUP > 0) p.efCUP = totalCUP;
      else if (totalUSD > 0) p.efUSD = totalUSD;
    }
    if (Math.abs((p.efCUP + p.tfCUP + p.crCUP) - totalCUP) > 0.5 && totalCUP > 0) { showToast('Pagos CUP no coinciden', 'err'); return; }
    if (Math.abs((p.efUSD + p.tfUSD + p.crUSD) - totalUSD) > 0.01 && totalUSD > 0) { showToast('Pagos USD no coinciden', 'err'); return; }
    if ((p.crCUP > 0 || p.crUSD > 0) && !clienteId) { showToast('Cliente requerido para crédito', 'err'); return; }
    for (const item of cart) { const pr = productos.find(x => x.id === item.productoId); if (!pr || pr.stock < item.cantidad) { showToast(`Stock insuficiente: ${item.nombre}`, 'err'); return; } }

    const venta: Venta = { num: genVentaNum(), fecha: Date.now(), items: cart, descuento, totalCUP, totalUSD, pagos: p, clienteId, clienteNombre: clientes.find(c => c.id === clienteId)?.nombre || '', estado: 'pagada', creditoCUP: p.crCUP, creditoUSD: p.crUSD };
    await dbAdd('ventas', venta);
    for (const item of cart) { const pr = productos.find(x => x.id === item.productoId)!; await dbPut('productos', { ...pr, stock: pr.stock - item.cantidad }); }
    if ((p.crCUP > 0 || p.crUSD > 0) && clienteId) { const cl = clientes.find(c => c.id === clienteId)!; await dbPut('clientes', { ...cl, saldoCUP: Math.max(0, cl.saldoCUP + p.crCUP), saldoUSD: Math.max(0, cl.saldoUSD + p.crUSD), compras: cl.compras + 1, ultimaCompra: Date.now() }); }
    else if (clienteId) { const cl = clientes.find(c => c.id === clienteId)!; await dbPut('clientes', { ...cl, compras: cl.compras + 1, ultimaCompra: Date.now() }); }

    setTicketVenta(venta); showToast(`Venta ${venta.num}`, 'ok');
    setCart([]); setDescuento(0); setPagos({ efCUP: 0, tfCUP: 0, crCUP: 0, efUSD: 0, tfUSD: 0, crUSD: 0 }); setClienteId(null); setCobrarModal(false); load();
  };

  return (
    <div className="pos-grid">
      <div className="flex flex-col gap-3 overflow-hidden">
        <div className="flex gap-2 items-center">
          <input className="input flex-1" placeholder="🔍 Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <HelpBtn text={HELP.pos} />
        </div>
        <div className="overflow-auto flex-1 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {results.map(p => (<div key={p.id} className="product-card p-2" onClick={() => addToCart(p)}>{p.foto ? <img src={p.foto} alt={p.nombre} style={{ height: 60 }} /> : <div style={{ height: 60, background: 'var(--bg3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📦</div>}<h4 className="font-semibold text-xs mt-1 truncate">{p.nombre}</h4><div className="flex justify-between items-center mt-1"><span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{fmt(p.ventaCUP)}</span><span className="text-xs" style={{ color: p.stock <= p.min ? 'var(--err)' : 'var(--text2)' }}>{p.stock}</span></div></div>))}
        </div>
      </div>
      <div className="card p-4 flex flex-col overflow-hidden">
        <h3 className="font-bold mb-2">🛒 Carrito ({cart.length})</h3>
        <div className="flex-1 overflow-auto space-y-2 mb-3">
          {cart.map(c => (<div key={c.productoId} className="p-2 rounded flex items-center gap-2" style={{ background: 'var(--bg3)' }}><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.nombre}</p><p className="text-xs" style={{ color: 'var(--text2)' }}>{fmt(c.precioCUP)} × {c.cantidad}</p></div><div className="flex items-center gap-1"><button className="btn btn-ghost btn-sm" onClick={() => updateQty(c.productoId, c.cantidad - 1)}>-</button><input type="number" className="input w-12 text-center text-xs" value={c.cantidad} onChange={e => updateQty(c.productoId, +e.target.value)} /><button className="btn btn-ghost btn-sm" onClick={() => updateQty(c.productoId, c.cantidad + 1)}>+</button></div><span className="text-sm font-bold w-16 text-right">{fmt(c.subtotalCUP)}</span><button className="text-red-500" onClick={() => setCart(cart.filter(x => x.productoId !== c.productoId))}>✕</button></div>))}
        </div>
        <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center"><label className="text-sm">Descuento %</label><input type="number" className="input w-20 text-right" value={descuento} onChange={e => setDescuento(Math.min(100, Math.max(0, +e.target.value)))} /></div>
          <div className="flex justify-between"><span>Total CUP:</span><span className="font-bold text-lg">{fmt(totalCUP)}</span></div>
          <div className="flex justify-between"><span>Total USD:</span><span className="font-bold">{fmt(totalUSD)}</span></div>
          <div className="flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => { setCart([]); setDescuento(0); }}>Vaciar</button><button className="btn btn-ok flex-1" onClick={() => cart.length > 0 && setCobrarModal(true)}>💰 COBRAR</button></div>
        </div>
      </div>

      <Modal open={cobrarModal} onClose={() => setCobrarModal(false)} title="💰 Cobrar" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded text-center" style={{ background: 'var(--bg3)' }}><p className="text-xs" style={{ color: 'var(--text2)' }}>TOTAL CUP</p><p className="text-3xl font-bold">{fmt(totalCUP)}</p><p className="equivalent">≈ {fmt(toUSD(totalCUP, tasa))} USD</p></div>
            <div className="p-4 rounded text-center" style={{ background: 'var(--bg3)' }}><p className="text-xs" style={{ color: 'var(--text2)' }}>TOTAL USD</p><p className="text-3xl font-bold">{fmt(totalUSD)}</p><p className="equivalent">≈ {fmt(toCUP(totalUSD, tasa))} CUP</p></div>
          </div>
          <div><label className="text-xs font-medium">Cliente (requerido para crédito)</label><select className="input" value={clienteId || ''} onChange={e => setClienteId(e.target.value ? +e.target.value : null)}><option value="">Sin cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm font-semibold mb-2">CUP</p><div className="space-y-2"><button className={`btn w-full ${pagoActivo === 'efCUP' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPagoActivo('efCUP')}>💵 Efectivo</button><button className={`btn w-full ${pagoActivo === 'tfCUP' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPagoActivo('tfCUP')}>💳 Tarjeta/Transf.</button><button className={`btn w-full ${pagoActivo === 'crCUP' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPagoActivo('crCUP')}>📝 Crédito (CxC)</button></div></div>
            <div><p className="text-sm font-semibold mb-2">USD</p><div className="space-y-2"><button className={`btn w-full ${pagoActivo === 'efUSD' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPagoActivo('efUSD')}>💵 Efectivo</button><button className={`btn w-full ${pagoActivo === 'tfUSD' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPagoActivo('tfUSD')}>💳 Tarjeta/Transf.</button><button className={`btn w-full ${pagoActivo === 'crUSD' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPagoActivo('crUSD')}>📝 Crédito (CxC)</button></div></div>
          </div>
          {pagoActivo && (<div className="p-3 rounded" style={{ background: 'var(--bg3)' }}><p className="text-sm font-medium mb-2">Monto:</p><div className="flex gap-2"><input type="number" className="input flex-1" value={pagoMonto} onChange={e => setPagoMonto(+e.target.value)} autoFocus /><button className="btn btn-primary" onClick={() => addPago(pagoActivo)}>Agregar</button></div></div>)}
          <div className="p-3 rounded space-y-1" style={{ background: 'var(--bg3)' }}>
            <p className="text-xs font-semibold">Resumen:</p>
            {pagos.efCUP > 0 && <p className="text-xs">💵 Efectivo CUP: {fmt(pagos.efCUP)}</p>}
            {pagos.tfCUP > 0 && <p className="text-xs">💳 Tarjeta CUP: {fmt(pagos.tfCUP)}</p>}
            {pagos.crCUP > 0 && <p className="text-xs">📝 Crédito CUP: {fmt(pagos.crCUP)}</p>}
            {pagos.efUSD > 0 && <p className="text-xs">💵 Efectivo USD: {fmt(pagos.efUSD)}</p>}
            {pagos.tfUSD > 0 && <p className="text-xs">💳 Tarjeta USD: {fmt(pagos.tfUSD)}</p>}
            {pagos.crUSD > 0 && <p className="text-xs">📝 Crédito USD: {fmt(pagos.crUSD)}</p>}
            <hr className="my-2" />
            <p className="text-sm font-bold">CUP: {fmt(sumaCUP)} / {fmt(totalCUP)} {Math.abs(sumaCUP - totalCUP) < 0.5 || totalCUP === 0 ? '✓' : '✗'}</p>
            <p className="text-sm font-bold">USD: {fmt(sumaUSD)} / {fmt(totalUSD)} {Math.abs(sumaUSD - totalUSD) < 0.01 || totalUSD === 0 ? '✓' : '✗'}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setCobrarModal(false)}>Cancelar</button><button className="btn btn-ok" onClick={confirmarVenta}>✓ Confirmar</button></div>
      </Modal>

      <Modal open={!!ticketVenta} onClose={() => setTicketVenta(null)} title="Ticket">
        {ticketVenta && (<div className="print-area ticket"><div className="text-center mb-2"><p className="font-bold">{cfg.biz}</p><p>No: {ticketVenta.num}</p><p>{fmtDateTime(ticketVenta.fecha)}</p></div><hr className="my-2" />{ticketVenta.items.map((it, i) => (<div key={i} className="ticket-line"><span>{it.cantidad}× {it.nombre}</span><span>{fmt(it.subtotalCUP)}</span></div>))}<hr className="my-2" /><div className="ticket-line font-bold"><span>TOTAL CUP</span><span>{fmt(ticketVenta.totalCUP)}</span></div><div className="ticket-line"><span>TOTAL USD</span><span>{fmt(ticketVenta.totalUSD)}</span></div></div>)}
        <div className="flex gap-2 mt-4 justify-end"><button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button><button className="btn btn-ghost" onClick={() => setTicketVenta(null)}>Cerrar</button></div>
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
  const tasa = cfg.tasa || 350;

  const load = useCallback(async () => { setVentas(await dbGetAll<Venta>('ventas')); }, []);
  useEffect(() => { load(); }, [load]);

  let filtered = [...ventas].sort((a, b) => b.fecha - a.fecha);
  if (search) filtered = filtered.filter(v => v.num.toLowerCase().includes(search.toLowerCase()) || v.clienteNombre.toLowerCase().includes(search.toLowerCase()));
  if (dateFrom) filtered = filtered.filter(v => v.fecha >= new Date(dateFrom).getTime());
  if (dateTo) filtered = filtered.filter(v => v.fecha <= new Date(dateTo).getTime() + 86400000);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ventasHoy = ventas.filter(v => v.fecha >= today.getTime() && v.estado === 'pagada');
  
  // Caja real del día
  const cajaCUPHoy = ventasHoy.reduce((s, v) => s + v.pagos.efCUP + v.pagos.tfCUP, 0);
  const cajaUSDHoy = ventasHoy.reduce((s, v) => s + v.pagos.efUSD + v.pagos.tfUSD, 0);
  const gananciaHoy = ventasHoy.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad * (1 - v.descuento / 100), 0), 0);

  const anular = async () => {
    if (!anularModal || !motivo || !detalle.trim()) { showToast('Complete los campos', 'err'); return; }
    const productos = await dbGetAll<Producto>('productos');
    for (const item of anularModal.items) { const p = productos.find(pr => pr.id === item.productoId); if (p) await dbPut('productos', { ...p, stock: p.stock + item.cantidad }); }
    if (anularModal.creditoCUP > 0 || anularModal.creditoUSD > 0) { const clientes = await dbGetAll<Cliente>('clientes'); const cl = clientes.find(c => c.id === anularModal.clienteId); if (cl) await dbPut('clientes', { ...cl, saldoCUP: Math.max(0, cl.saldoCUP - anularModal.creditoCUP), saldoUSD: Math.max(0, cl.saldoUSD - anularModal.creditoUSD) }); }
    await dbPut('ventas', { ...anularModal, estado: 'anulada' as const });
    await dbAdd('anulaciones', { ventaId: anularModal.id!, num: anularModal.num, fechaAnulacion: Date.now(), fechaOriginal: anularModal.fecha, totalCUP: anularModal.totalCUP, totalUSD: anularModal.totalUSD, motivo, detalle, estado: 'pendiente', items: anularModal.items, auditado: null } as Anulacion);
    showToast('Venta anulada', 'ok'); setAnularModal(null); setMotivo(''); setDetalle(''); load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3"><div></div><HelpBtn text={HELP.sales} /></div>
      
      {/* CAJA DEL DÍA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card p-4" style={{ borderLeft: '4px solid var(--ok)' }}>
          <p className="kpi-label">💵 Caja CUP Hoy</p>
          <p className="text-xl font-bold">{fmt(cajaCUPHoy)} CUP</p>
          <p className="equivalent">≈ {fmt(toUSD(cajaCUPHoy, tasa))} USD</p>
        </div>
        <div className="card p-4" style={{ borderLeft: '4px solid var(--info)' }}>
          <p className="kpi-label">💵 Caja USD Hoy</p>
          <p className="text-xl font-bold">{fmt(cajaUSDHoy)} USD</p>
          <p className="equivalent">≈ {fmt(toCUP(cajaUSDHoy, tasa))} CUP</p>
        </div>
      </div>

      <div className="grid-3 mb-4">
        <div className="kpi"><div className="kpi-label">Ventas Hoy</div><div className="kpi-value">{ventasHoy.length}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Ganancia Hoy</div><div className="kpi-value">{fmt(gananciaHoy)}</div><p className="equivalent">≈ {fmt(toUSD(gananciaHoy, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--info)' }}><div className="kpi-label">Total Ventas</div><div className="kpi-value">{ventas.filter(v => v.estado === 'pagada').length}</div></div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="input max-w-xs" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" className="input max-w-[150px]" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" className="input max-w-[150px]" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>
      <div className="card table-wrap"><table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>CUP</th><th>USD</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(v => (<tr key={v.id} style={{ opacity: v.estado === 'anulada' ? 0.5 : 1 }}><td className="font-mono text-xs">{v.num}</td><td className="text-xs">{fmtDateTime(v.fecha)}</td><td>{v.clienteNombre || '-'}</td><td>{fmt(v.totalCUP)}</td><td>{fmt(v.totalUSD)}</td><td>{v.estado === 'pagada' ? <span className="badge badge-ok">Pagada</span> : <span className="badge badge-err">Anulada</span>}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setViewTicket(v)}>👁️</button>{v.estado === 'pagada' && <button className="btn btn-ghost btn-sm" onClick={() => setAnularModal(v)}>🚫</button>}</td></tr>))}</tbody></table></div>

      <Modal open={!!anularModal} onClose={() => setAnularModal(null)} title="Anular Venta">
        {anularModal && (<div className="space-y-3"><p>Venta: <strong>{anularModal.num}</strong></p><div><label className="text-xs font-medium">Motivo *</label><select className="input" value={motivo} onChange={e => setMotivo(e.target.value)}><option value="">Seleccionar...</option><option>Error de digitación</option><option>Cliente se arrepintió</option><option>Producto defectuoso</option><option>Otro</option></select></div><div><label className="text-xs font-medium">Detalle *</label><textarea className="input" rows={3} value={detalle} onChange={e => setDetalle(e.target.value)} /></div></div>)}
        <div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setAnularModal(null)}>Cancelar</button><button className="btn btn-err" onClick={anular}>Anular</button></div>
      </Modal>

      <Modal open={!!viewTicket} onClose={() => setViewTicket(null)} title="Detalle">
        {viewTicket && (<div className="ticket"><p className="font-bold">{viewTicket.num}</p><p>{fmtDateTime(viewTicket.fecha)}</p><hr className="my-2" />{viewTicket.items.map((it, i) => (<div key={i} className="ticket-line"><span>{it.cantidad}× {it.nombre}</span><span>{fmt(it.subtotalCUP)}</span></div>))}<hr className="my-2" /><div className="ticket-line font-bold"><span>TOTAL</span><span>{fmt(viewTicket.totalCUP)} CUP</span></div><div className="ticket-line"><span>USD</span><span>{fmt(viewTicket.totalUSD)}</span></div></div>)}
      </Modal>
    </div>
  );
}

// ============ WEEKLY CLOSE ============
function WeeklyClose({ cfg }: { cfg: Record<string, any> }) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const tasa = cfg.tasa || 350;
  const pctDependienta = cfg.pctDependienta || 0;

  const load = useCallback(async () => {
    setVentas(await dbGetAll<Venta>('ventas'));
    setProductos(await dbGetAll<Producto>('productos'));
    setGastos(await dbGetAll<Gasto>('gastos'));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Calcular inicio de semana (lunes)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=dom, 1=lun...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);

  const ventasSemana = ventas.filter(v => v.fecha >= weekStart.getTime() && v.fecha <= weekEnd.getTime() && v.estado === 'pagada');
  const gastosSemana = gastos.filter(g => g.fecha >= weekStart.getTime() && g.fecha <= weekEnd.getTime());

  const totalCUP = ventasSemana.reduce((s, v) => s + v.totalCUP, 0);
  const totalUSD = ventasSemana.reduce((s, v) => s + v.totalUSD, 0);
  const ganancia = ventasSemana.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad * (1 - v.descuento / 100), 0), 0);
  const gastosTotal = gastosSemana.reduce((s, g) => s + g.montoCUP, 0);
  const utilidad = ganancia - gastosTotal;
  const inversion = productos.reduce((s, p) => s + (p.stock * p.pep), 0);

  // Distribución inversionistas
  const inv1 = utilidad * 0.5;
  const inv2 = utilidad * 0.5;
  const dependienta = inv1 * (pctDependienta / 100);
  const inv1Neto = inv1 - dependienta;

  // Caja semanal
  const cajaCUP = ventasSemana.reduce((s, v) => s + v.pagos.efCUP + v.pagos.tfCUP, 0);
  const cajaUSD = ventasSemana.reduce((s, v) => s + v.pagos.efUSD + v.pagos.tfUSD, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-3"><div></div><HelpBtn text={HELP.weekly} /></div>
      <div className="card p-4 mb-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <p className="text-sm font-semibold">📅 Semana: {fmtDate(weekStart.getTime())} - {fmtDate(weekEnd.getTime())}</p>
        <p className="text-xs" style={{ color: 'var(--text2)' }}>{ventasSemana.length} ventas realizadas</p>
      </div>

      <div className="grid-4 mb-6">
        <div className="kpi"><div className="kpi-label">Venta Total CUP</div><div className="kpi-value">{fmt(totalCUP)}</div><p className="equivalent">≈ {fmt(toUSD(totalCUP, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--info)' }}><div className="kpi-label">Venta Total USD</div><div className="kpi-value">{fmt(totalUSD)}</div><p className="equivalent">≈ {fmt(toCUP(totalUSD, tasa))} CUP</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Ganancia Bruta</div><div className="kpi-value">{fmt(ganancia)}</div><p className="equivalent">≈ {fmt(toUSD(ganancia, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--err)' }}><div className="kpi-label">Gastos Semana</div><div className="kpi-value">{fmt(gastosTotal)}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4" style={{ borderLeft: '4px solid var(--ok)' }}>
          <h3 className="font-bold mb-2">💰 Caja Semanal CUP</h3>
          <p className="text-2xl font-bold">{fmt(cajaCUP)} CUP</p>
          <p className="equivalent">≈ {fmt(toUSD(cajaCUP, tasa))} USD</p>
        </div>
        <div className="card p-4" style={{ borderLeft: '4px solid var(--info)' }}>
          <h3 className="font-bold mb-2">💰 Caja Semanal USD</h3>
          <p className="text-2xl font-bold">{fmt(cajaUSD)} USD</p>
          <p className="equivalent">≈ {fmt(toCUP(cajaUSD, tasa))} CUP</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="kpi" style={{ borderLeftColor: utilidad >= 0 ? 'var(--ok)' : 'var(--err)' }}>
          <div className="kpi-label">Utilidad Neta (Ganancia - Gastos)</div>
          <div className="kpi-value">{fmt(utilidad)} CUP</div>
          <p className="equivalent">≈ {fmt(toUSD(utilidad, tasa))} USD</p>
        </div>
        <div className="kpi" style={{ borderLeftColor: 'var(--info)' }}>
          <div className="kpi-label">💰 Inversión en Inventario</div>
          <div className="kpi-value">{fmt(inversion)} CUP</div>
          <p className="equivalent">≈ {fmt(toUSD(inversion, tasa))} USD</p>
        </div>
      </div>

      {/* DISTRIBUCIÓN */}
      <div className="card p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">📊 Distribución de Ganancias</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded" style={{ background: 'var(--bg3)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>👤 Inversionista 1 (50%)</p>
            <p className="text-xl font-bold">{fmt(inv1)} CUP</p>
            <p className="equivalent">≈ {fmt(toUSD(inv1, tasa))} USD</p>
            {pctDependienta > 0 && (<><p className="text-xs mt-2" style={{ color: 'var(--err)' }}>- Dependienta ({pctDependienta}%): {fmt(dependienta)}</p><p className="text-sm font-bold mt-1">Neto: {fmt(inv1Neto)} CUP</p></>)}
          </div>
          <div className="p-4 rounded" style={{ background: 'var(--bg3)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>👤 Inversionista 2 (50%)</p>
            <p className="text-xl font-bold">{fmt(inv2)} CUP</p>
            <p className="equivalent">≈ {fmt(toUSD(inv2, tasa))} USD</p>
          </div>
          {pctDependienta > 0 && (
            <div className="p-4 rounded" style={{ background: 'var(--bg3)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--warn)' }}>💁 Dependienta ({pctDependienta}% del Inv1)</p>
              <p className="text-xl font-bold">{fmt(dependienta)} CUP</p>
              <p className="equivalent">≈ {fmt(toUSD(dependienta, tasa))} USD</p>
            </div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3">Ventas de la Semana</h3>
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>CUP</th><th>USD</th></tr></thead><tbody>{ventasSemana.map(v => (<tr key={v.id}><td className="font-mono text-xs">{v.num}</td><td className="text-xs">{fmtDate(v.fecha)}</td><td>{v.clienteNombre || '-'}</td><td>{fmt(v.totalCUP)}</td><td>{fmt(v.totalUSD)}</td></tr>))}</tbody></table></div>
        {ventasSemana.length === 0 && <p className="text-center py-4" style={{ color: 'var(--text2)' }}>Sin ventas esta semana</p>}
      </div>
    </div>
  );
}

// ============ CANCELLATIONS ============
function Cancellations({ cfg }: { cfg: Record<string, any> }) {
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [viewDetail, setViewDetail] = useState<Anulacion | null>(null);
  const load = useCallback(async () => { setAnulaciones(await dbGetAll<Anulacion>('anulaciones')); }, []);
  useEffect(() => { load(); }, [load]);
  const auditar = async (a: Anulacion) => { await dbPut('anulaciones', { ...a, estado: 'revertida' as const, auditado: Date.now() }); showToast('Auditada', 'ok'); load(); };
  return (
    <div>
      <div className="flex justify-end mb-3"><HelpBtn text={HELP.cancellations} /></div>
      <div className="grid-3 mb-4"><div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Pendientes</div><div className="kpi-value">{anulaciones.filter(a => a.estado === 'pendiente').length}</div></div><div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Auditadas</div><div className="kpi-value">{anulaciones.filter(a => a.estado === 'revertida').length}</div></div><div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{anulaciones.length}</div></div></div>
      <div className="card table-wrap"><table><thead><tr><th>Venta</th><th>Fecha</th><th>CUP</th><th>USD</th><th>Motivo</th><th>Estado</th><th></th></tr></thead><tbody>{[...anulaciones].sort((a, b) => b.fechaAnulacion - a.fechaAnulacion).map(a => (<tr key={a.id}><td className="font-mono text-xs">{a.num}</td><td className="text-xs">{fmtDateTime(a.fechaAnulacion)}</td><td>{fmt(a.totalCUP)}</td><td>{fmt(a.totalUSD)}</td><td className="text-xs">{a.motivo}</td><td>{a.estado === 'pendiente' ? <span className="badge badge-warn">Pendiente</span> : <span className="badge badge-ok">Revertida</span>}</td><td><button className="btn btn-ghost btn-sm" onClick={() => setViewDetail(a)}>👁️</button>{a.estado === 'pendiente' && <button className="btn btn-ok btn-sm" onClick={() => auditar(a)}>✓</button>}</td></tr>))}</tbody></table></div>
      <Modal open={!!viewDetail} onClose={() => setViewDetail(null)} title="Detalle">{viewDetail && (<div className="space-y-2"><p><strong>Venta:</strong> {viewDetail.num}</p><p><strong>Motivo:</strong> {viewDetail.motivo}</p><p><strong>Detalle:</strong> {viewDetail.detalle}</p><hr />{viewDetail.items.map((it, i) => (<div key={i} className="flex justify-between text-sm"><span>{it.cantidad}× {it.nombre}</span><span>{fmt(it.subtotalCUP)}</span></div>))}</div>)}</Modal>
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
  const tasa = cfg.tasa || 350;

  const load = useCallback(async () => { setClientes(await dbGetAll<Cliente>('clientes')); }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm({ nombre: '', telefono: '', email: '', direccion: '', notas: '', saldoCUP: 0, saldoUSD: 0, compras: 0, ultimaCompra: 0 }); setModal(true); };
  const openEdit = (c: Cliente) => { setEditItem(c); setForm({ ...c }); setModal(true); };

  const save = async () => {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', 'err'); return; }
    if (editItem) { await dbPut('clientes', { ...editItem, ...form }); showToast('Actualizado', 'ok'); }
    else { await dbAdd('clientes', { ...form, creado: Date.now() } as Cliente); showToast('Creado', 'ok'); }
    setModal(false); load();
  };

  const del = async (c: Cliente) => { if (!confirm(`¿Eliminar "${c.nombre}"?`)) return; await dbDelete('clientes', c.id!); load(); };

  const registrarAbono = async () => {
    if (!abonoModal || (abonoCUP <= 0 && abonoUSD <= 0)) { showToast('Monto inválido', 'err'); return; }
    await dbPut('clientes', { ...abonoModal, saldoCUP: Math.max(0, abonoModal.saldoCUP - abonoCUP), saldoUSD: Math.max(0, abonoModal.saldoUSD - abonoUSD) });
    showToast('Abono registrado', 'ok'); setAbonoModal(null); setAbonoCUP(0); setAbonoUSD(0); load();
  };

  const conSaldo = clientes.filter(c => c.saldoCUP > 0 || c.saldoUSD > 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-3"><div></div><HelpBtn text={HELP.clients} /></div>
      <div className="flex justify-between items-center mb-4"><p className="text-sm" style={{ color: 'var(--text2)' }}>{clientes.length} clientes | {conSaldo.length} con saldo</p><button className="btn btn-primary" onClick={openNew}>+ Nuevo</button></div>
      {conSaldo.length > 0 && (<div className="card p-4 mb-4"><h3 className="font-semibold mb-3">💳 Cuentas por Cobrar</h3><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Saldo CUP</th><th>Saldo USD</th><th></th></tr></thead><tbody>{conSaldo.map(c => (<tr key={c.id}><td className="font-medium">{c.nombre}</td><td className="font-semibold">{fmt(c.saldoCUP)}<p className="equivalent">≈ {fmt(toUSD(c.saldoCUP, tasa))} USD</p></td><td>{fmt(c.saldoUSD)}<p className="equivalent">≈ {fmt(toCUP(c.saldoUSD, tasa))} CUP</p></td><td><button className="btn btn-ok btn-sm" onClick={() => setAbonoModal(c)}>💵 Abono</button> <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button></td></tr>))}</tbody></table></div></div>)}
      <div className="card table-wrap"><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Saldo CUP</th><th>Saldo USD</th><th></th></tr></thead><tbody>{clientes.map(c => (<tr key={c.id}><td>{c.nombre}</td><td>{c.telefono}</td><td>{fmt(c.saldoCUP)}</td><td>{fmt(c.saldoUSD)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button> <button className="btn btn-ghost btn-sm" onClick={() => del(c)}>🗑️</button></td></tr>))}</tbody></table></div>
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Editar' : 'Nuevo Cliente'}><div className="space-y-3"><div><label className="text-xs font-medium">Nombre *</label><input className="input" value={form.nombre || ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium">Teléfono</label><input className="input" value={form.telefono || ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div><div><label className="text-xs font-medium">Email</label><input className="input" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div></div><div><label className="text-xs font-medium">Dirección</label><input className="input" value={form.direccion || ''} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} /></div><div><label className="text-xs font-medium">Notas</label><textarea className="input" rows={2} value={form.notas || ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div></div><div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></div></Modal>
      <Modal open={!!abonoModal} onClose={() => setAbonoModal(null)} title="💵 Abono">{abonoModal && (<div className="space-y-3"><p>Cliente: <strong>{abonoModal.nombre}</strong></p><p>Saldo: {fmt(abonoModal.saldoCUP)} CUP / {fmt(abonoModal.saldoUSD)} USD</p><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium">Abono CUP</label><input type="number" className="input" value={abonoCUP} onChange={e => setAbonoCUP(+e.target.value)} /></div><div><label className="text-xs font-medium">Abono USD</label><input type="number" className="input" value={abonoUSD} onChange={e => setAbonoUSD(+e.target.value)} /></div></div></div>)}<div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setAbonoModal(null)}>Cancelar</button><button className="btn btn-ok" onClick={registrarAbono}>Registrar</button></div></Modal>
    </div>
  );
}

// ============ METRICS (WEEKLY) ============
function Metrics({ cfg }: { cfg: Record<string, any> }) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const tasa = cfg.tasa || 350;
  const pctDependienta = cfg.pctDependienta || 0;

  const load = useCallback(async () => { setVentas(await dbGetAll<Venta>('ventas')); setProductos(await dbGetAll<Producto>('productos')); setGastos(await dbGetAll<Gasto>('gastos')); }, []);
  useEffect(() => { load(); }, [load]);

  // Solo semana actual
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 5); weekEnd.setHours(23, 59, 59, 999); // Sábado

  const ventasSemana = ventas.filter(v => v.fecha >= weekStart.getTime() && v.fecha <= weekEnd.getTime() && v.estado === 'pagada');
  const gastosSemana = gastos.filter(g => g.fecha >= weekStart.getTime() && g.fecha <= weekEnd.getTime());

  const totalCUP = ventasSemana.reduce((s, v) => s + v.totalCUP, 0);
  const totalUSD = ventasSemana.reduce((s, v) => s + v.totalUSD, 0);
  const ganancia = ventasSemana.reduce((s, v) => s + v.items.reduce((si, it) => si + (it.precioCUP - it.pep) * it.cantidad * (1 - v.descuento / 100), 0), 0);
  const gastosTotal = gastosSemana.reduce((s, g) => s + g.montoCUP, 0);
  const utilidad = ganancia - gastosTotal;
  const inversion = productos.reduce((s, p) => s + (p.stock * p.pep), 0);

  const inv1 = utilidad * 0.5;
  const inv2 = utilidad * 0.5;
  const dependienta = inv1 * (pctDependienta / 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-3"><div></div><HelpBtn text={HELP.metrics} /></div>
      <div className="card p-4 mb-4" style={{ borderLeft: '4px solid var(--primary)' }}><p className="text-sm font-semibold">📅 Semana: {fmtDate(weekStart.getTime())} - {fmtDate(weekEnd.getTime())}</p></div>
      <div className="grid-4 mb-6">
        <div className="kpi"><div className="kpi-label">Venta CUP</div><div className="kpi-value">{fmt(totalCUP)}</div><p className="equivalent">≈ {fmt(toUSD(totalCUP, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--info)' }}><div className="kpi-label">Venta USD</div><div className="kpi-value">{fmt(totalUSD)}</div><p className="equivalent">≈ {fmt(toCUP(totalUSD, tasa))} CUP</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Ganancia</div><div className="kpi-value">{fmt(ganancia)}</div><p className="equivalent">≈ {fmt(toUSD(ganancia, tasa))} USD</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--err)' }}><div className="kpi-label">Inversión Inv.</div><div className="kpi-value">{fmt(inversion)}</div><p className="equivalent">≈ {fmt(toUSD(inversion, tasa))} USD</p></div>
      </div>
      <div className="grid-3 mb-6">
        <div className="kpi" style={{ borderLeftColor: utilidad >= 0 ? 'var(--ok)' : 'var(--err)' }}><div className="kpi-label">Utilidad Neta</div><div className="kpi-value">{fmt(utilidad)}</div><p className="equivalent">Ganancia - Gastos ({fmt(gastosTotal)})</p></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--primary)' }}><div className="kpi-label">Inv. 1 (50%)</div><div className="kpi-value">{fmt(inv1)}</div>{pctDependienta > 0 && <p className="text-xs">Dep: -{fmt(dependienta)} | Neto: {fmt(inv1 - dependienta)}</p>}</div>
        <div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Inv. 2 (50%)</div><div className="kpi-value">{fmt(inv2)}</div></div>
      </div>
      {pctDependienta > 0 && (<div className="kpi mb-6" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">💁 Dependienta ({pctDependienta}% del Inv1)</div><div className="kpi-value">{fmt(dependienta)} CUP</div><p className="equivalent">≈ {fmt(toUSD(dependienta, tasa))} USD</p></div>)}
    </div>
  );
}

// ============ EXPENSES ============
function Expenses({ cfg }: { cfg: Record<string, any> }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<Gasto | null>(null);
  const [form, setForm] = useState<Partial<Gasto>>({});
  const tasa = cfg.tasa || 350;
  const cats = ['Salarios', 'Alquiler', 'Electricidad', 'Internet', 'Combustible', 'Mantenimiento', 'Otros'];

  const load = useCallback(async () => { setGastos(await dbGetAll<Gasto>('gastos')); }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditItem(null); setForm({ concepto: '', categoria: cats[0], fecha: Date.now(), nota: '', montoCUP: 0, montoUSD: 0 }); setModal(true); };
  const openEdit = (g: Gasto) => { setEditItem(g); setForm({ ...g }); setModal(true); };
  const handleMontoCUP = (val: number) => setForm(f => ({ ...f, montoCUP: val, montoUSD: toUSD(val, tasa) }));
  const handleMontoUSD = (val: number) => setForm(f => ({ ...f, montoUSD: val, montoCUP: toCUP(val, tasa) }));

  const save = async () => {
    if (!form.concepto?.trim()) { showToast('Concepto requerido', 'err'); return; }
    if ((form.montoCUP || 0) <= 0 && (form.montoUSD || 0) <= 0) { showToast('Monto > 0', 'err'); return; }
    if (editItem) { await dbPut('gastos', { ...editItem, ...form }); } else { await dbAdd('gastos', { ...form, creado: Date.now() } as Gasto); }
    showToast('Guardado', 'ok'); setModal(false); load();
  };

  const del = async (g: Gasto) => { if (!confirm(`¿Eliminar?`)) return; await dbDelete('gastos', g.id!); load(); };

  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const gastosMes = gastos.filter(g => g.fecha >= monthStart);

  return (
    <div>
      <div className="flex justify-between items-center mb-3"><div></div><HelpBtn text={HELP.expenses} /></div>
      <div className="grid-3 mb-4"><div className="kpi"><div className="kpi-label">Mes CUP</div><div className="kpi-value">{fmt(gastosMes.reduce((s, g) => s + g.montoCUP, 0))}</div></div><div className="kpi" style={{ borderLeftColor: 'var(--ok)' }}><div className="kpi-label">Mes USD</div><div className="kpi-value">{fmt(gastosMes.reduce((s, g) => s + g.montoUSD, 0))}</div></div><div className="kpi" style={{ borderLeftColor: 'var(--warn)' }}><div className="kpi-label">Total</div><div className="kpi-value">{fmt(gastos.reduce((s, g) => s + g.montoCUP, 0))}</div></div></div>
      <div className="flex justify-end mb-4"><button className="btn btn-primary" onClick={openNew}>+ Nuevo Gasto</button></div>
      <div className="card table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Cat.</th><th>CUP</th><th>USD</th><th></th></tr></thead><tbody>{[...gastos].sort((a, b) => b.fecha - a.fecha).map(g => (<tr key={g.id}><td className="text-xs">{fmtDate(g.fecha)}</td><td>{g.concepto}</td><td>{g.categoria}</td><td>{fmt(g.montoCUP)}</td><td>{fmt(g.montoUSD)}</td><td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>✏️</button> <button className="btn btn-ghost btn-sm" onClick={() => del(g)}>🗑️</button></td></tr>))}</tbody></table></div>
      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Editar' : 'Nuevo Gasto'}><div className="space-y-3"><div><label className="text-xs font-medium">Concepto *</label><input className="input" value={form.concepto || ''} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium">Categoría</label><select className="input" value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>{cats.map(c => <option key={c}>{c}</option>)}</select></div><div><label className="text-xs font-medium">Fecha</label><input type="date" className="input" value={form.fecha ? new Date(form.fecha).toISOString().split('T')[0] : ''} onChange={e => setForm(f => ({ ...f, fecha: new Date(e.target.value).getTime() }))} /></div><div><label className="text-xs font-medium">Monto CUP</label><input type="number" className="input" value={form.montoCUP || 0} onChange={e => handleMontoCUP(+e.target.value)} /></div><div><label className="text-xs font-medium">Monto USD</label><input type="number" className="input" value={form.montoUSD || 0} onChange={e => handleMontoUSD(+e.target.value)} /></div></div></div><div className="flex gap-2 mt-4 justify-end"><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></div></Modal>
    </div>
  );
}

// ============ BACKUP ============
function Backup({ cfg }: { cfg: Record<string, any> }) {
  const [importing, setImporting] = useState(false);

  const exportJSON = async () => {
    const data = { productos: await dbGetAll('productos'), compras: await dbGetAll('compras'), ventas: await dbGetAll('ventas'), clientes: await dbGetAll('clientes'), gastos: await dbGetAll('gastos'), anulaciones: await dbGetAll('anulaciones'), config: await dbGetAll('config'), tasas: await dbGetAll('tasas'), exportDate: Date.now() };
    const encrypted = await encryptData(JSON.stringify(data));
    const blob = new Blob([encrypted], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ferreteria_${new Date().toISOString().split('T')[0]}.json`; a.click();
    showToast('Respaldo exportado', 'ok');
  };

  const exportExcel = async () => {
    const wb = XLSX.utils.book_new();
    const productos = await dbGetAll<any>('productos');
    if (productos.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos.map(p => ({ ID: p.id, Código: p.codigo, Nombre: p.nombre, Categoría: p.categoria, 'Compra CUP': p.compraCUP, 'Compra USD': p.compraUSD, 'Venta CUP': p.ventaCUP, 'Venta USD': p.ventaUSD, 'PEP CUP': p.pep, 'PEP USD': p.pepUSD, Stock: p.stock, Mín: p.min, Inversión: p.stock * p.pep }))), 'Productos'); }
    const ventas = await dbGetAll<any>('ventas');
    if (ventas.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas.map(v => ({ Número: v.num, Fecha: fmtDateTime(v.fecha), Cliente: v.clienteNombre, Estado: v.estado, 'Total CUP': v.totalCUP, 'Total USD': v.totalUSD, 'Efectivo CUP': v.pagos.efCUP, 'Tarjeta CUP': v.pagos.tfCUP, 'Crédito CUP': v.pagos.crCUP, 'Efectivo USD': v.pagos.efUSD, 'Tarjeta USD': v.pagos.tfUSD, 'Crédito USD': v.pagos.crUSD }))), 'Ventas'); }
    const compras = await dbGetAll<any>('compras');
    if (compras.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras.map(c => ({ Fecha: fmtDate(c.fecha), Producto: c.productoNombre, Cantidad: c.cantidad, 'P.Unit CUP': c.precioUnitCUP, 'P.Unit USD': c.precioUnitUSD, 'Total CUP': c.totalCUP, 'Total USD': c.totalUSD }))), 'Compras'); }
    const clientes = await dbGetAll<any>('clientes');
    if (clientes.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes.map(c => ({ Nombre: c.nombre, Teléfono: c.telefono, 'Saldo CUP': c.saldoCUP, 'Saldo USD': c.saldoUSD, Compras: c.compras }))), 'Clientes'); }
    const gastos = await dbGetAll<any>('gastos');
    if (gastos.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastos.map(g => ({ Fecha: fmtDate(g.fecha), Concepto: g.concepto, Categoría: g.categoria, 'Monto CUP': g.montoCUP, 'Monto USD': g.montoUSD }))), 'Gastos'); }
    XLSX.writeFile(wb, `ferreteria_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Excel exportado', 'ok');
  };

  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!confirm('¿Restaurar? Se reemplazarán TODOS los datos.')) return;
    setImporting(true);
    try { const text = await file.text(); let json: string; try { json = await decryptData(text); } catch { json = text; } const data = JSON.parse(json); for (const store of ['productos', 'compras', 'ventas', 'clientes', 'gastos', 'anulaciones', 'config', 'tasas']) { if (data[store]) { await dbClear(store); for (const item of data[store]) await dbPut(store, item); } } showToast('Restaurado', 'ok'); } catch (err) { showToast('Error: ' + (err as Error).message, 'err'); }
    setImporting(false); e.target.value = '';
  };

  const clearAll = async () => { if (!confirm('⚠️ ¿Borrar TODO?')) return; if (!confirm('¿Seguro?')) return; for (const s of ['productos', 'compras', 'ventas', 'clientes', 'gastos', 'anulaciones', 'tasas']) await dbClear(s); showToast('Eliminado', 'warn'); };

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><HelpBtn text={HELP.backup} /></div>
      <div className="card p-6"><h3 className="font-bold text-lg mb-4">📤 Exportar</h3><div className="flex flex-wrap gap-3"><button className="btn btn-primary" onClick={exportJSON}>📦 JSON Cifrado</button><button className="btn btn-ok" onClick={exportExcel}>📊 Excel Completo</button></div></div>
      <div className="card p-6"><h3 className="font-bold text-lg mb-4">📥 Importar</h3><label className="btn btn-info cursor-pointer">📦 Restaurar JSON {importing && '...'}<input type="file" accept=".json" className="hidden" onChange={importJSON} disabled={importing} /></label></div>
      <div className="card p-6" style={{ borderColor: 'var(--err)' }}><h3 className="font-bold text-lg mb-4" style={{ color: 'var(--err)' }}>⚠️ Zona Peligrosa</h3><button className="btn btn-err" onClick={clearAll}>🗑️ Borrar Todo</button></div>
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
  const [pctDep, setPctDep] = useState(cfg.pctDependienta || 0);
  const [showTasas, setShowTasas] = useState(false);
  const [tasas, setTasas] = useState<Tasa[]>([]);

  useEffect(() => { (async () => { setTasas(await dbGetAll<Tasa>('tasas')); })(); }, []);

  const saveTasa = async () => { const ant = cfg.tasa || 350; await setConfig('tasa', tasa); await dbAdd('tasas', { fecha: Date.now(), anterior: ant, nueva: tasa }); setTasas(await dbGetAll<Tasa>('tasas')); await refreshCfg(); showToast(`Tasa: ${ant} → ${tasa}`, 'ok'); };
  const saveBiz = async () => { await setConfig('biz', biz); await setConfig('addr', addr); await setConfig('phone', phone); await setConfig('nit', nit); await refreshCfg(); showToast('Guardado', 'ok'); };
  const saveDep = async () => { await setConfig('pctDependienta', pctDep); await refreshCfg(); showToast('Guardado', 'ok'); };

  const lic = getLicense();

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><HelpBtn text={HELP.settings} /></div>

      <div className="card p-6"><h3 className="font-bold text-lg mb-4">💱 Tasa de Cambio</h3><div className="flex gap-3 items-end"><div className="flex-1"><label className="text-xs font-medium">1 USD = ? CUP</label><input type="number" className="input" value={tasa} onChange={e => setTasa(+e.target.value)} /></div><button className="btn btn-primary" onClick={saveTasa}>Guardar</button><button className="btn btn-ghost" onClick={() => setShowTasas(true)}>📋 Historial</button></div><p className="text-xs mt-2" style={{ color: 'var(--warn)' }}>⚠️ La tasa afecta todas las conversiones USD↔CUP. Actualice frecuentemente por la volatilidad.</p></div>

      <div className="card p-6"><h3 className="font-bold text-lg mb-4">👥 Inversionistas y Dependienta</h3><div className="space-y-3"><p className="text-sm" style={{ color: 'var(--text2)' }}>La ganancia se divide 50% cada inversionista. La dependienta recibe un % de la parte del Inversionista 1.</p><div className="flex gap-3 items-end"><div className="flex-1"><label className="text-xs font-medium">% Dependienta (del Inv1)</label><input type="number" className="input" value={pctDep} onChange={e => setPctDep(+e.target.value)} min={0} max={100} /></div><button className="btn btn-primary" onClick={saveDep}>Guardar</button></div><p className="text-xs" style={{ color: 'var(--text2)' }}>Ejemplo: Si ganancia = 1000, Inv1 = 500, Inv2 = 500. Si dependienta = 10%, recibe 50 del Inv1.</p></div></div>

      <div className="card p-6"><h3 className="font-bold text-lg mb-4">🏪 Negocio</h3><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium">Nombre</label><input className="input" value={biz} onChange={e => setBiz(e.target.value)} /></div><div><label className="text-xs font-medium">Dirección</label><input className="input" value={addr} onChange={e => setAddr(e.target.value)} /></div><div><label className="text-xs font-medium">Teléfono</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div><div><label className="text-xs font-medium">NIT</label><input className="input" value={nit} onChange={e => setNit(e.target.value)} /></div></div><button className="btn btn-primary mt-3" onClick={saveBiz}>Guardar</button></div>

      <div className="card p-6"><h3 className="font-bold text-lg mb-4">🎨 Apariencia</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-medium">Tema</label><select className="input" value={tema} onChange={e => { setTema(e.target.value); setConfig('tema', e.target.value); refreshCfg(); }}><option value="light">Claro</option><option value="dark">Oscuro</option><option value="auto">Auto</option></select></div><div><label className="text-xs font-medium">Tamaño</label><select className="input" value={size} onChange={e => { setSize(e.target.value); setConfig('size', e.target.value); refreshCfg(); }}><option value="sm">Compacto</option><option value="md">Normal</option><option value="lg">Grande</option></select></div></div></div>

      <div className="card p-6"><h3 className="font-bold text-lg mb-4">🔑 Licencia</h3>{lic ? (<div className="space-y-2"><p>Plan: {lic.plan}</p><p>Estado: {isLicenseValid() ? <span className="badge badge-ok">Activa</span> : <span className="badge badge-err">Expirada</span>}</p>{lic.days > 0 && <p>Expira: {fmtDate(lic.expires)}</p>}<button className="btn btn-err btn-sm mt-2" onClick={() => { clearLicense(); window.location.reload(); }}>Cerrar Licencia</button></div>) : <p>Sin licencia</p>}</div>

      <Modal open={showTasas} onClose={() => setShowTasas(false)} title="Historial de Tasas"><table><thead><tr><th>Fecha</th><th>Anterior</th><th>Nueva</th></tr></thead><tbody>{[...tasas].sort((a, b) => b.fecha - a.fecha).map(t => (<tr key={t.id}><td>{fmtDateTime(t.fecha)}</td><td>{fmt(t.anterior)}</td><td>{fmt(t.nueva)}</td></tr>))}</tbody></table></Modal>
    </div>
  );
}
