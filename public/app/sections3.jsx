/* ============================================================
   COCINA · FINANZAS · CASA · OCIO
   ============================================================ */

/* ---------- COCINA ---------- */
const ZONES = [["heladera","Heladera","🧊"],["almacen","Almacén","📦"],["freezer","Freezer","❄️"]];
const KitchenItemModal = ({ zone, onClose }) => {
  const [, set] = useStore();
  const [f, setF] = React.useState({ n: "", d: "", tag: "", warn: false });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Modal title="Agregar item" icon="box" onClose={onClose}
      footer={<><span className="link" style={{ color: "var(--tx-3)" }} onClick={onClose}>Cancelar</span><Btn variant="primary" onClick={() => { if (!f.n.trim()) return toast("Poné un nombre"); set(s => s.kitchen[zone].push(f)); toast("Item agregado"); onClose(); }}>Guardar</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Nombre *"><input className="input" value={f.n} onChange={e => up("n", e.target.value)} autoFocus /></Field>
        <Field label="Sección / descripción"><input className="input" value={f.d} onChange={e => up("d", e.target.value)} placeholder="Ej: lácteos" /></Field>
        <Field label="Tag"><input className="input" value={f.tag} onChange={e => up("tag", e.target.value)} placeholder="Ej: vence pronto" /></Field>
        <div className="row between"><span style={{ fontSize: 14 }}>Marcar advertencia (por vencer)</span><Toggle on={f.warn} onChange={v => up("warn", v)} /></div>
      </div>
    </Modal>
  );
};

/* ---------- RECETAS (recomendadas según tu cocina) ---------- */
const KB_BASICS = ["sal", "aceite", "agua", "azucar", "pimienta"];
const kbNorm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const RECIPES = [
  { id: "r1", emoji: "🍳", name: "Revuelto de huevos", time: "10 min", ing: ["Huevos", "Aceite", "Sal"], steps: ["Batí los huevos con una pizca de sal.", "Calentá un poco de aceite en la sartén.", "Volcá los huevos y cociná revolviendo hasta cuajar."] },
  { id: "r2", emoji: "🍚", name: "Arroz con huevo frito", time: "20 min", ing: ["Arroz", "Huevos", "Aceite", "Sal"], steps: ["Herví el arroz en agua con sal.", "Freí un huevo aparte.", "Serví el huevo sobre el arroz caliente."] },
  { id: "r3", emoji: "🧀", name: "Fideos con queso", time: "15 min", ing: ["Fideos", "Queso", "Manteca"], steps: ["Herví los fideos al dente.", "Colá y mezclá con manteca.", "Rallá queso por encima y serví."] },
  { id: "r4", emoji: "🥩", name: "Milanesa con arroz", time: "25 min", ing: ["Milanesas", "Arroz", "Aceite", "Sal"], steps: ["Freí o horneá las milanesas.", "Herví el arroz con sal.", "Serví todo junto."] },
  { id: "r5", emoji: "🥪", name: "Sándwich de milanesa", time: "15 min", ing: ["Milanesas", "Pan", "Queso"], steps: ["Cociná la milanesa.", "Tostá el pan.", "Armá el sándwich con queso."] },
  { id: "r6", emoji: "🍮", name: "Arroz con leche", time: "30 min", ing: ["Arroz", "Leche", "Azúcar", "Canela"], steps: ["Cociná el arroz en leche a fuego bajo.", "Sumá azúcar y revolvé.", "Espolvoreá canela al servir."] },
  { id: "r7", emoji: "🥞", name: "Panqueques", time: "20 min", ing: ["Huevos", "Leche", "Harina", "Aceite"], steps: ["Mezclá harina, huevos y leche.", "Cociná en sartén aceitada.", "Rellená a gusto."] },
  { id: "r8", emoji: "🍝", name: "Fideos con salsa", time: "20 min", ing: ["Fideos", "Tomate", "Aceite", "Sal"], steps: ["Herví los fideos.", "Preparí una salsa de tomate.", "Mezclá y serví."] },
  { id: "r9", emoji: "🍳", name: "Tortilla de queso", time: "15 min", ing: ["Huevos", "Queso", "Aceite", "Sal"], steps: ["Batí los huevos con sal.", "Sumá el queso en cubos.", "Cociná de ambos lados."] },
  { id: "r10", emoji: "🥛", name: "Licuado de banana", time: "5 min", ing: ["Leche", "Banana", "Azúcar"], steps: ["Licuá leche con banana y azúcar.", "Serví bien frío."] },
];
const haveNamesFrom = (kitchen) => [].concat(...ZONES.map(z => (kitchen && kitchen[z[0]]) || [])).map(it => kbNorm(it.n)).filter(Boolean);
const recipeStatus = (rec, haveNames) => {
  const have = [], missing = [];
  rec.ing.forEach(ing => {
    const n = kbNorm(ing);
    const ok = KB_BASICS.includes(n) || haveNames.some(h => h && (h.includes(n) || n.includes(h)));
    (ok ? have : missing).push(ing);
  });
  return { have, missing, can: missing.length === 0 };
};
const rankRecipes = (haveNames) => RECIPES.map(r => ({ r, st: recipeStatus(r, haveNames) })).sort((a, b) => a.st.missing.length - b.st.missing.length);
const addMissingToShopping = (set, missing) => set(s => { missing.forEach(m => { if (!s.shopping.some(x => kbNorm(x.t) === kbNorm(m))) s.shopping.push({ t: m, done: false }); }); });

const RecipeMini = ({ r, st, onOpen }) => (
  <div className="card card-2 hoverable" style={{ cursor: "pointer", padding: "14px 15px", display: "flex", flexDirection: "column", gap: 9 }} onClick={onOpen}>
    <div className="row between">
      <span style={{ fontSize: 25 }}>{r.emoji}</span>
      {st.can
        ? <span className="chip chip-accent chip-dot" style={{ fontSize: 9, padding: "3px 8px" }}>listo</span>
        : <span className="chip" style={{ fontSize: 9, padding: "3px 8px" }}>falta {st.missing.length}</span>}
    </div>
    <div style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.2 }}>{r.name}</div>
    <div className="mono" style={{ fontSize: 10 }}>{r.time} · {r.ing.length} ingred.</div>
  </div>
);

const RecipeStrip = ({ haveNames, onOpen, onAll }) => {
  const ranked = rankRecipes(haveNames);
  const can = ranked.filter(x => x.st.can);
  const show = (can.length >= 3 ? can : ranked).slice(0, 6);
  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div className="row between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 10 }}><span style={{ fontSize: 17 }}>✨</span><div className="h3">Podés cocinar</div><span className="mono" style={{ fontSize: 11 }}>· {can.length} {can.length === 1 ? "receta lista" : "recetas listas"} con lo que tenés</span></div>
        <span className="link" style={{ fontSize: 13 }} onClick={onAll}>Ver todas →</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px,1fr))" }}>
        {show.map(({ r, st }) => <RecipeMini key={r.id} r={r} st={st} onOpen={() => onOpen(r)} />)}
      </div>
    </div>
  );
};

let RECETA_TARGET = null;

const RecipeDetail = ({ r, haveNames, set }) => {
  const st = recipeStatus(r, haveNames);
  return (
    <div className="card" style={{ position: "sticky", top: 0 }}>
      <div className="row" style={{ gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface-2)", display: "grid", placeItems: "center", fontSize: 28, flex: "0 0 auto" }}>{r.emoji}</div>
        <div>
          <div className="h2">{r.name}</div>
          <div className="mono" style={{ marginTop: 6 }}>⏱ {r.time} · {r.ing.length} ingredientes</div>
        </div>
      </div>
      <MonoLabel>Ingredientes</MonoLabel>
      <div className="wrap-gap" style={{ marginTop: 11, marginBottom: 8 }}>
        {r.ing.map(ing => { const have = !st.missing.includes(ing); return <span key={ing} className={"chip" + (have ? " chip-accent" : "")} style={{ opacity: have ? 1 : .55 }}>{have ? "✓" : "+"} {ing}</span>; })}
      </div>
      {st.missing.length > 0
        ? <Btn variant="primary" icon="plus" style={{ width: "100%", marginTop: 8 }} onClick={() => { addMissingToShopping(set, st.missing); toast("Agregado a la compra"); }}>Agregar {st.missing.length} {st.missing.length === 1 ? "faltante" : "faltantes"} a la compra</Btn>
        : <div className="chip chip-accent chip-dot" style={{ marginTop: 8 }}>Tenés todos los ingredientes</div>}
      <div className="divider" style={{ margin: "22px 0 18px" }}></div>
      <MonoLabel>Preparación</MonoLabel>
      <ol style={{ margin: "13px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 13 }}>
        {r.steps.map((s, i) => <li key={i} className="row" style={{ gap: 13, alignItems: "flex-start" }}><span className="mono mono-accent" style={{ marginTop: 3 }}>{String(i + 1).padStart(2, "0")}</span><span style={{ fontSize: 14, lineHeight: 1.55 }}>{s}</span></li>)}
      </ol>
    </div>
  );
};

const Recetas = ({ onNav }) => {
  const [data, set] = useStore();
  const haveNames = haveNamesFrom(data.kitchen);
  const ranked = rankRecipes(haveNames);
  const canCount = ranked.filter(x => x.st.can).length;
  const [tab, setTab] = React.useState("can");
  const [selId, setSelId] = React.useState(() => { const t = RECETA_TARGET; RECETA_TARGET = null; return t || (ranked.find(x => x.st.can) || ranked[0]).r.id; });
  const list = tab === "can" ? ranked.filter(x => x.st.can) : ranked;
  const current = RECIPES.find(r => r.id === selId) || ranked[0].r;
  return (
    <div className="page page-cozy">
      <PageHead title="Recetas" meta="Según lo que tenés en tu cocina">
        <Btn variant="ghost" icon="chevL" onClick={() => onNav("cocina")}>Volver a cocina</Btn>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: "1.25fr 1fr", alignItems: "start" }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <button className={"tab" + (tab === "can" ? " on" : "")} onClick={() => setTab("can")}>Puedo hacer · {canCount}</button>
            <button className={"tab" + (tab === "all" ? " on" : "")} onClick={() => setTab("all")}>Todas · {RECIPES.length}</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {list.length === 0 && <Empty icon="book" title="Todavía no podés cocinar nada" sub="Agregá items a la heladera o el almacén y vas a ver recetas acá." />}
            {list.map(({ r, st }) => (
              <div key={r.id} className={"card" + (r.id === selId ? "" : " card-2 hoverable")} onClick={() => setSelId(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 15px", cursor: "pointer", borderColor: r.id === selId ? "var(--violet-line)" : undefined, background: r.id === selId ? "var(--violet-soft)" : undefined }}>
                <span style={{ fontSize: 26, flex: "0 0 auto" }}>{r.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.name}</div>
                  <div className="mono" style={{ fontSize: 10, marginTop: 3, color: st.can ? "var(--violet-hi)" : "var(--tx-3)" }}>{r.time} · {st.can ? "tenés todo" : "faltan: " + st.missing.join(", ")}</div>
                </div>
                {st.can ? <span className="chip chip-accent" style={{ flex: "0 0 auto" }}>✓</span> : <Btn variant="secondary" size="sm" icon="plus" style={{ flex: "0 0 auto" }} onClick={(e) => { e.stopPropagation(); addMissingToShopping(set, st.missing); toast("Agregado a la compra"); }}>Faltantes</Btn>}
              </div>
            ))}
          </div>
        </div>
        <RecipeDetail r={current} haveNames={haveNames} set={set} />
      </div>
    </div>
  );
};

const Cocina = ({ onNav }) => {
  const [data, set] = useStore();
  const [modal, setModal] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const haveNames = haveNamesFrom(data.kitchen);
  const addShop = () => { if (draft.trim()) { set(s => s.shopping.push({ t: draft.trim(), done: false })); setDraft(""); } };
  return (
    <div className="page page-wide">
      <PageHead title="Cocina" meta="Heladera · Almacén · Freezer · Compras">
        <Btn variant="secondary" icon="book" onClick={() => onNav("recetas")}>Recetas</Btn>
        <Btn variant="primary" icon="plus" onClick={() => setModal("heladera")}>Agregar item</Btn>
      </PageHead>
      <RecipeStrip haveNames={haveNames} onOpen={(r) => { RECETA_TARGET = r.id; onNav("recetas"); }} onAll={() => onNav("recetas")} />
      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        <div style={{ display: "grid", gap: 22 }}>
          {ZONES.map(([k, label, emoji]) => (
            <div key={k} className="card">
              <div className="row between" style={{ marginBottom: 16 }}>
                <div className="row" style={{ gap: 10 }}><span style={{ fontSize: 17 }}>{emoji}</span><MonoLabel>{label}</MonoLabel><span className="mono" style={{ fontSize: 11 }}>· {data.kitchen[k].length} items</span></div>
                <div className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setModal(k)}><Icon name="plus" size={15} /></div>
              </div>
              {data.kitchen[k].length === 0 ? <div className="small" style={{ color: "var(--tx-3)" }}>Vacío — agregá items.</div> :
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px,1fr))" }}>
                  {data.kitchen[k].map((it, i) => (
                    <div key={i} className="card card-2" style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div className="row between"><span style={{ fontSize: 14.5, fontWeight: 600 }}>{it.n}</span>{it.warn && <span style={{ color: "#e8b04e" }}>⚠️</span>}<span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => set(s => s.kitchen[k] = s.kitchen[k].filter((_, j) => j !== i))}><Icon name="x" size={13} /></span></div>
                      {it.d && <span className="small" style={{ fontSize: 12 }}>{it.d}</span>}
                      {it.tag && <span className="chip" style={{ fontSize: 9.5, alignSelf: "flex-start", marginTop: 4 }}>{it.tag}</span>}
                    </div>
                  ))}
                </div>}
            </div>
          ))}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="row between" style={{ marginBottom: 8 }}><div className="h3">🛒 Lista de compras</div>{data.shopping.some(s => s.done) && <span className="link" style={{ fontSize: 12.5, color: "#e8639b" }} onClick={() => set(s => s.shopping = s.shopping.filter(x => !x.done))}>Limpiar ✓</span>}</div>
          <div className="mono" style={{ marginBottom: 18, fontSize: 10.5 }}>Los tachados van al final</div>
          <div style={{ display: "grid", gap: 4, marginBottom: 16 }}>
            {[...data.shopping].sort((a, b) => a.done - b.done).map((it, i) => {
              const idx = data.shopping.indexOf(it);
              return (
                <div key={i} className="check-row">
                  <div className={`cbox${it.done ? " on" : ""}`} onClick={() => set(s => s.shopping[idx].done = !s.shopping[idx].done)}>{it.done && <Icon name="check" size={13} color="#fff" />}</div>
                  <span style={{ flex: 1, fontSize: 14, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? .5 : 1 }}>{it.t}</span>
                  <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => set(s => s.shopping = s.shopping.filter((_, j) => j !== idx))}><Icon name="x" size={14} /></span>
                </div>
              );
            })}
          </div>
          <form className="row" style={{ gap: 9 }} onSubmit={e => { e.preventDefault(); addShop(); }}>
            <input className="input" placeholder="Agregar item y enter…" value={draft} onChange={e => setDraft(e.target.value)} style={{ padding: "10px 13px", fontSize: 13.5 }} />
            <Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}></Btn>
          </form>
        </div>
      </div>
      {modal && <KitchenItemModal zone={modal} onClose={() => setModal(null)} />}
    </div>
  );
};

/* ---------- FINANZAS ---------- */
const CATS = { comida: "mug", transporte: "bus", estudio: "book", salud: "heart", entretenimiento: "gamepad", otros: "box" };
const CAT_LABELS = { comida: "Comida", transporte: "Transporte", estudio: "Estudio", salud: "Salud", entretenimiento: "Entretenimiento", otros: "Otros" };
const BudgetModal = ({ current, onSave, onClose }) => {
  const [val, setVal] = React.useState(String(current));
  const save = () => {
    const n = parseInt(val.replace(/\D/g, ""));
    if (!n || n <= 0) return toast("Ingresá un monto válido");
    onSave(n); onClose();
  };
  return (
    <Modal title="Editar presupuesto" icon="coins" onClose={onClose}
      footer={<><span className="link" style={{ color: "var(--tx-3)", cursor: "pointer" }} onClick={onClose}>Cancelar</span><Btn variant="primary" onClick={save}>Guardar</Btn></>}>
      <Field label="Presupuesto mensual (AR$)">
        <input className="input" type="number" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()} autoFocus
          style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }} />
      </Field>
      <div className="small" style={{ marginTop: 10, color: "var(--tx-3)" }}>
        Define el techo mensual que se muestra en el card y la barra de uso.
      </div>
    </Modal>
  );
};

const Finanzas = () => {
  const [data, set] = useStore();
  const [f, setF] = React.useState({ desc: "", amount: "", cat: "comida", type: "gasto" });
  const [showBudget, setShowBudget] = React.useState(false);
  const exp = data.finance.expenses;
  const gastos = exp.filter(e => e.type === "gasto").reduce((a, e) => a + e.amount, 0);
  const ingresos = exp.filter(e => e.type === "ingreso").reduce((a, e) => a + e.amount, 0);
  const balance = ingresos - gastos;
  const fmt = (n) => "AR$ " + n.toLocaleString("es");
  const add = () => { if (!f.desc.trim() || !f.amount) return toast("Completá descripción y monto"); set(s => s.finance.expenses.unshift({ id: uid(), desc: f.desc, amount: +f.amount, cat: f.cat, type: f.type, date: new Date().toLocaleDateString("es", { day: "numeric", month: "short" }) })); setF({ desc: "", amount: "", cat: "comida", type: "gasto" }); toast(f.type === "gasto" ? "Gasto agregado" : "Ingreso agregado"); };
  const budget = data.finance.budget, usedPct = Math.min(100, Math.round(gastos / budget * 100));
  return (
    <div className="page page-wide">
      <PageHead title="Finanzas" meta="Junio · presupuesto y movimientos">
        <Btn variant="primary" icon="settings" onClick={() => setShowBudget(true)}>Presupuesto</Btn>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
        <div className="card card-hero tcorners"><TerminalCorners /><MonoLabel>Presupuesto</MonoLabel><div className="display" style={{ fontSize: 44, color: "#fff", marginTop: 10 }}>{fmt(budget)}</div><div style={{ marginTop: 14 }}><div className="bar" style={{ background: "rgba(255,255,255,.2)" }}><i style={{ width: usedPct + "%", background: "#fff" }}></i></div><div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 8 }}>{usedPct}% usado</div></div></div>
        <div className="card"><MonoLabel>Gastos</MonoLabel><div className="stat" style={{ fontSize: 40, marginTop: 10, color: "#e8639b" }}>{fmt(gastos)}</div><div className="small" style={{ marginTop: 8 }}>Este mes</div></div>
        <div className="card"><MonoLabel>Balance</MonoLabel><div className="stat" style={{ fontSize: 40, marginTop: 10, color: balance >= 0 ? "#3ecf9a" : "#e8639b" }}>{fmt(balance)}</div><div className="small" style={{ marginTop: 8 }}>Ingresos − gastos</div></div>
      </div>
      <div className="card card-flush">
        <div className="row between" style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)" }}><div className="h3">Movimientos del mes ({exp.length})</div></div>
        <form className="row" style={{ gap: 10, padding: "16px 22px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }} onSubmit={e => { e.preventDefault(); add(); }}>
          <div className="seg"><button type="button" className={f.type === "gasto" ? "on" : ""} onClick={() => setF(x => ({ ...x, type: "gasto" }))}>Gasto</button><button type="button" className={f.type === "ingreso" ? "on" : ""} onClick={() => setF(x => ({ ...x, type: "ingreso" }))}>Ingreso</button></div>
          <input className="input" placeholder="Descripción…" value={f.desc} onChange={e => setF(x => ({ ...x, desc: e.target.value }))} style={{ flex: 2, minWidth: 160 }} />
          <input className="input" type="number" placeholder="$ Monto" value={f.amount} onChange={e => setF(x => ({ ...x, amount: e.target.value }))} style={{ flex: 1, minWidth: 110 }} />
          <select className="sel-input" value={f.cat} onChange={e => setF(x => ({ ...x, cat: e.target.value }))}>{Object.keys(CATS).map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}</select>
          <Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}>Agregar</Btn>
        </form>
        {exp.length === 0 ? <div className="empty" style={{ padding: 40 }}><span className="small">Sin movimientos registrados</span></div> :
          exp.map(e => (
            <div key={e.id} className="row" style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", gap: 16 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--violet-hi)", flex: "0 0 auto" }}><Icon name={CATS[e.cat]} size={17} /></span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 500 }}>{e.desc}</div><div className="mono" style={{ fontSize: 10, marginTop: 3 }}>{CAT_LABELS[e.cat] || e.cat} · {e.date}</div></div>
              <span className="chip" style={{ fontSize: 9.5, color: e.type === "ingreso" ? "#3ecf9a" : "#e8639b", borderColor: (e.type === "ingreso" ? "#3ecf9a" : "#e8639b") + "55" }}>{e.type}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14.5, color: e.type === "ingreso" ? "#3ecf9a" : "var(--tx-1)", width: 120, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{e.type === "ingreso" ? "+" : "−"}{fmt(e.amount).replace("AR$ ", "$")}</span>
              <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => { set(s => s.finance.expenses = s.finance.expenses.filter(x => x.id !== e.id)); toast("Movimiento eliminado"); }}><Icon name="trash" size={15} /></span>
            </div>
          ))}
      </div>
      {showBudget && <BudgetModal current={budget} onSave={n => set(s => { s.finance.budget = n; })} onClose={() => setShowBudget(false)} />}
    </div>
  );
};

/* ---------- CASA ---------- */
const Casa = () => {
  const [data, set] = useStore();
  const [draft, setDraft] = React.useState("");
  const done = data.home.filter(h => h.done).length, pct = data.home.length ? Math.round(done / data.home.length * 100) : 0;
  const cats = [...new Set(data.home.map(h => h.cat))];
  return (
    <div className="page page-wide">
      <PageHead title="Casa" meta="Checklist semanal de tareas del hogar">
        <Btn variant="secondary" icon="refresh" onClick={() => { set(s => s.home.forEach(h => h.done = false)); toast("Semana reiniciada"); }}>Reiniciar semana</Btn>
      </PageHead>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row between" style={{ marginBottom: 12 }}><MonoLabel>Progreso semanal</MonoLabel><span className="display" style={{ fontSize: 30, color: "var(--violet-hi)" }}>{pct}%</span></div>
        <div className="bar" style={{ height: 8 }}><i style={{ width: pct + "%" }}></i></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))" }}>
        {cats.map(cat => (
          <div key={cat} className="card card-flush">
            <div className="row between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}><MonoLabel>{cat}</MonoLabel></div>
            <div style={{ padding: "4px 20px" }}>
              {data.home.filter(h => h.cat === cat).map((h) => { const idx = data.home.indexOf(h); return (
                <div key={idx} className="check-row">
                  <div className={`cbox${h.done ? " on" : ""}`} onClick={() => set(s => s.home[idx].done = !s.home[idx].done)}>{h.done && <Icon name="check" size={13} color="#fff" />}</div>
                  <span style={{ flex: 1, fontSize: 14, textDecoration: h.done ? "line-through" : "none", opacity: h.done ? .55 : 1 }}>{h.t}</span>
                  <span className="mono" style={{ fontSize: 10 }}>{h.day}</span>
                  <span style={{ cursor: "pointer", color: "var(--tx-3)" }} onClick={() => set(s => s.home = s.home.filter((_, j) => j !== idx))}><Icon name="x" size={13} /></span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
      <form className="card card-flush" style={{ marginTop: 22 }} onSubmit={e => { e.preventDefault(); if (draft.trim()) { set(s => s.home.push({ t: draft.trim(), cat: "Limpieza", day: "Semanal", done: false })); setDraft(""); toast("Tarea agregada"); } }}>
        <div className="row" style={{ gap: 10, padding: "16px 22px" }}><input className="input" placeholder="Agregar tarea del hogar y enter…" value={draft} onChange={e => setDraft(e.target.value)} /><Btn variant="primary" icon="plus" style={{ flex: "0 0 auto" }}></Btn></div>
      </form>
    </div>
  );
};

/* ---------- OCIO ---------- */
const OCIO_TYPES = [["Todos","✨"],["Serie","📺"],["Película","🎬"],["Juego","🎮"],["Libro","📕"],["Anime","⛩️"]];
const OCIO_STATUS = { pendiente: ["Pendiente","#e8b04e"], progreso: ["En progreso","#4ec5e8"], completado: ["Completado","#3ecf9a"] };
const OcioModal = ({ item, onClose }) => {
  const [, set] = useStore();
  const [f, setF] = React.useState(item || { emoji: "🎮", title: "", type: "Juego", status: "pendiente", score: 0, note: "" });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <Modal title={item ? "Editar" : "Agregar a Ocio"} icon="sparkles" onClose={onClose}
      footer={<><span className="link" style={{ color: item ? "#e8639b" : "var(--tx-3)" }} onClick={() => { if (item) { set(s => s.ocio = s.ocio.filter(o => o.id !== item.id)); toast("Eliminado"); } onClose(); }}>{item ? "Eliminar" : "Cancelar"}</span><Btn variant="primary" onClick={() => { if (!f.title.trim()) return toast("Poné un título"); set(s => { if (item) Object.assign(s.ocio.find(o => o.id === item.id), f); else s.ocio.push({ id: uid(), ...f }); }); toast("Guardado"); onClose(); }}>Guardar</Btn></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <Field label="Emoji"><input className="input" value={f.emoji} maxLength={2} onChange={e => up("emoji", e.target.value)} style={{ width: 80, textAlign: "center", fontSize: 22 }} /></Field>
          <div style={{ flex: 1 }}><Field label="Título *"><input className="input" value={f.title} onChange={e => up("title", e.target.value)} autoFocus /></Field></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Tipo"><select className="sel-input" style={{ width: "100%" }} value={f.type} onChange={e => up("type", e.target.value)}>{OCIO_TYPES.slice(1).map(([t]) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Estado"><select className="sel-input" style={{ width: "100%" }} value={f.status} onChange={e => up("status", e.target.value)}>{Object.keys(OCIO_STATUS).map(k => <option key={k} value={k}>{OCIO_STATUS[k][0]}</option>)}</select></Field>
        </div>
        <Field label={`Score: ${f.score}/10`}><input type="range" min="0" max="10" value={f.score} onChange={e => up("score", +e.target.value)} style={{ width: "100%" }} /></Field>
        <Field label="Nota"><input className="input" value={f.note} onChange={e => up("note", e.target.value)} placeholder="Breve…" /></Field>
      </div>
    </Modal>
  );
};
const Ocio = () => {
  const [data] = useStore();
  const [filter, setFilter] = React.useState("Todos");
  const [modal, setModal] = React.useState(null);
  const items = data.ocio.filter(o => filter === "Todos" || o.type === filter);
  const count = (st) => data.ocio.filter(o => o.status === st).length;
  return (
    <div className="page page-wide">
      <PageHead title="Ocio" meta={`${count("pendiente")} pendientes · Series · Películas · Juegos · Libros`}>
        <Btn variant="primary" icon="plus" onClick={() => setModal("new")}>Agregar</Btn>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 22 }}>
        {Object.keys(OCIO_STATUS).map(st => <div key={st} className="card"><MonoLabel>{OCIO_STATUS[st][0]}</MonoLabel><div className="stat" style={{ fontSize: 44, marginTop: 10, color: OCIO_STATUS[st][1] }}>{count(st)}</div></div>)}
      </div>
      <div className="tabs" style={{ marginBottom: 22 }}>
        {OCIO_TYPES.map(([t, e]) => <button key={t} className={`tab${filter === t ? " on" : ""}`} onClick={() => setFilter(t)}>{e} {t}</button>)}
      </div>
      {items.length === 0 ? <Empty icon="sparkles" title="Sin entradas" sub="Agregá algo al catálogo." /> :
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))" }}>
          {items.map(o => (
            <div key={o.id} className="card hoverable" style={{ cursor: "pointer" }} onClick={() => setModal(o)}>
              <div className="row between" style={{ marginBottom: 14 }}><span style={{ fontSize: 30 }}>{o.emoji}</span><span className="chip" style={{ fontSize: 9.5, color: OCIO_STATUS[o.status][1], borderColor: OCIO_STATUS[o.status][1] + "55" }}>{OCIO_STATUS[o.status][0]}</span></div>
              <div className="h3">{o.title}</div>
              <div className="mono" style={{ marginTop: 6 }}>{o.type}</div>
              {o.note && <div className="small" style={{ marginTop: 10 }}>{o.note}</div>}
              {o.score > 0 && <div className="row" style={{ gap: 6, marginTop: 14, color: "#e8b04e" }}><Icon name="star" size={15} /><span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13 }}>{o.score}/10</span></div>}
            </div>
          ))}
        </div>}
      {modal && <OcioModal item={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
};

Object.assign(window, { Cocina, Finanzas, Casa, Ocio, Recetas });
