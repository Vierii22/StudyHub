import React from 'react';

import { Icon } from './icons.jsx';
import { uid, toast } from './store.jsx';
import { Btn } from './ui.jsx';

/* ============================================================
   TABLE BLOCK — bloque /tabla para el editor de Mi Espacio.
   Estilo Notion/Airtable:
   - celdas editables in-place (click)
   - navegación con Tab / Enter / Esc
   - columnas tipadas: texto, número, fecha, selección, casilla
   - menú de cabecera: renombrar, cambiar tipo, ordenar, opciones, borrar
   - fila de totales (suma + promedio) en columnas numéricas
   - import / export CSV
   ============================================================ */

const COL_TYPES = [
  { t: "text",   label: "Texto",      icon: "type" },
  { t: "number", label: "Número",     icon: "dollar" },
  { t: "date",   label: "Fecha",      icon: "calendar" },
  { t: "select", label: "Selección",  icon: "layers" },
  { t: "check",  label: "Casilla",    icon: "check" },
];
const SEL_COLORS = ["#8b6dff","#3ecf9a","#e8639b","#4ec5e8","#e8b04e","#f0764e","#a48cff","#6d8bff"];

function newTableData() {
  return {
    cols: [
      { id: uid(), name: "Nombre",  type: "text" },
      { id: uid(), name: "Estado",  type: "select", options: [
        { label: "Pendiente", color: "#e8b04e" },
        { label: "En curso",  color: "#4ec5e8" },
        { label: "Hecho",     color: "#3ecf9a" },
      ] },
      { id: uid(), name: "Valor",   type: "number" },
    ],
    rows: [
      { id: uid(), cells: {} },
      { id: uid(), cells: {} },
      { id: uid(), cells: {} },
    ],
  };
}

/* —— CSV —— */
function csvParse(text) {
  const out = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        out.push(row); row = [];
      } else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.length > 1 || (r.length === 1 && r[0].length));
}
function csvBuild(cols, rows) {
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = cols.map(c => esc(c.name)).join(",");
  const body = rows.map(r => cols.map(c => esc(r.cells[c.id] == null ? "" : r.cells[c.id])).join(",")).join("\n");
  return head + "\n" + body;
}

/* —— editor de una celda según tipo de columna —— */
function CellEditor({ col, value, onChange, onNav }) {
  const ref = React.useRef(null);
  React.useEffect(() => { ref.current && ref.current.focus(); if (ref.current && ref.current.select) ref.current.select(); }, []);
  const handle = (e) => {
    if (e.key === "Enter") { e.preventDefault(); onNav("next-row"); }
    else if (e.key === "Tab") { e.preventDefault(); onNav(e.shiftKey ? "prev-col" : "next-col"); }
    else if (e.key === "Escape") { e.preventDefault(); onNav("blur"); }
  };
  if (col.type === "select") {
    return (
      <select ref={ref} className="tbl-edit-sel" value={value || ""}
        onChange={(e) => onChange(e.target.value)} onBlur={() => onNav("blur")} onKeyDown={handle}>
        <option value="">—</option>
        {(col.options || []).map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
      </select>
    );
  }
  if (col.type === "number") {
    return <input ref={ref} type="number" className="tbl-edit-in mono-num" value={value ?? ""}
      onChange={(e) => onChange(e.target.value)} onBlur={() => onNav("blur")} onKeyDown={handle} />;
  }
  if (col.type === "date") {
    return <input ref={ref} type="text" placeholder="dd/mm" className="tbl-edit-in mono-num" value={value ?? ""}
      onChange={(e) => onChange(e.target.value)} onBlur={() => onNav("blur")} onKeyDown={handle} />;
  }
  return <input ref={ref} className="tbl-edit-in" value={value ?? ""}
    onChange={(e) => onChange(e.target.value)} onBlur={() => onNav("blur")} onKeyDown={handle} />;
}

/* —— vista renderizada de una celda (modo lectura) —— */
function CellView({ col, value, onToggleCheck }) {
  if (col.type === "check") {
    return <div className={`cbox${value ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}>{value && <Icon name="check" size={13} color="#fff" />}</div>;
  }
  if (col.type === "select") {
    const opt = (col.options || []).find(o => o.label === value);
    if (!opt) return <span className="tbl-empty">—</span>;
    return <span className="chip" style={{ color: opt.color, borderColor: opt.color + "55", background: opt.color + "18", fontSize: 10, padding: "3px 8px" }}>{opt.label}</span>;
  }
  if (col.type === "number") {
    return (value !== "" && value != null) ? <span className="mono-num tnum">{value}</span> : <span className="tbl-empty">—</span>;
  }
  if (col.type === "date") {
    return value ? <span className="mono-num tnum">{value}</span> : <span className="tbl-empty">—</span>;
  }
  return value ? <span>{value}</span> : <span className="tbl-empty">—</span>;
}

/* —— menú de cabecera de columna —— */
function ColMenu({ col, cols, onPatchCols, onSort, onDelete, onClose }) {
  const setCol = (patch) => onPatchCols(cols.map(c => c.id === col.id ? { ...c, ...patch } : c));
  const setOpts = (ops) => setCol({ options: ops });
  const opts = col.options || [];
  return (
    <div className="tbl-menu" onClick={(e) => e.stopPropagation()}>
      <div className="tbl-menu-label">Tipo de columna</div>
      {COL_TYPES.map(tp => (
        <button key={tp.t} className={col.type === tp.t ? "on" : ""}
          onClick={() => setCol({ type: tp.t, ...(tp.t === "select" && !col.options ? { options: [] } : {}) })}>
          <Icon name={tp.icon} size={14} /> {tp.label}
        </button>
      ))}
      <div className="tbl-menu-sep"></div>
      <button onClick={() => { onSort("asc"); onClose(); }}><Icon name="sortAsc" size={14} /> Orden ascendente</button>
      <button onClick={() => { onSort("desc"); onClose(); }}><Icon name="sortDesc" size={14} /> Orden descendente</button>
      {col.type === "select" && (
        <>
          <div className="tbl-menu-sep"></div>
          <div className="tbl-menu-label">Opciones</div>
          {opts.map((o, oi) => (
            <div className="tbl-menu-opt" key={oi}>
              <span className="tbl-opt-dot" style={{ background: o.color }}
                onClick={() => { const ops = [...opts]; const ci = SEL_COLORS.indexOf(o.color); ops[oi] = { ...o, color: SEL_COLORS[(ci + 1) % SEL_COLORS.length] }; setOpts(ops); }} title="Cambiar color"></span>
              <input value={o.label} onChange={(e) => { const ops = [...opts]; ops[oi] = { ...o, label: e.target.value }; setOpts(ops); }} />
              <button onClick={() => { const ops = [...opts]; ops.splice(oi, 1); setOpts(ops); }}><Icon name="x" size={11} /></button>
            </div>
          ))}
          <button className="tbl-menu-addopt" onClick={() => setOpts([...opts, { label: "Nueva", color: SEL_COLORS[opts.length % SEL_COLORS.length] }])}>
            <Icon name="plus" size={12} /> Agregar opción
          </button>
        </>
      )}
      <div className="tbl-menu-sep"></div>
      <button className="danger" disabled={cols.length <= 1} onClick={() => { onDelete(); onClose(); }}>
        <Icon name="trash" size={14} /> Eliminar columna
      </button>
    </div>
  );
}

/* —— bloque tabla —— */
function TableBlock({ b, onPatch }) {
  const cols = b.cols || [];
  const rows = b.rows || [];
  const [edit, setEdit] = React.useState(null); // { r, c }  índices
  const [colMenu, setColMenu] = React.useState(null);
  const fileRef = React.useRef(null);

  const setCols = (next) => onPatch({ cols: next });
  const setRows = (next) => onPatch({ rows: next });
  const setCell = (rid, cid, v) => setRows(rows.map(r => r.id === rid ? { ...r, cells: { ...r.cells, [cid]: v } } : r));
  const addRow = () => setRows([...rows, { id: uid(), cells: {} }]);
  const addCol = () => setCols([...cols, { id: uid(), name: "Col " + (cols.length + 1), type: "text" }]);
  const delCol = (cid) => setCols(cols.filter(c => c.id !== cid));
  const delRow = (rid) => setRows(rows.filter(r => r.id !== rid));
  const renameCol = (cid, name) => setCols(cols.map(c => c.id === cid ? { ...c, name } : c));
  const sortBy = (cid, dir) => {
    const col = cols.find(c => c.id === cid);
    const isNum = col && (col.type === "number");
    const sorted = [...rows].sort((a, bb) => {
      const va = a.cells[cid], vb = bb.cells[cid];
      let r;
      if (isNum) r = (+va || 0) - (+vb || 0);
      else r = String(va == null ? "" : va).localeCompare(String(vb == null ? "" : vb));
      return dir === "desc" ? -r : r;
    });
    setRows(sorted);
  };

  // cerrar menú al click fuera
  React.useEffect(() => {
    if (!colMenu) return;
    const close = () => setColMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [colMenu]);

  // navegación
  const nav = (action, ri, ci) => {
    if (action === "blur") return setEdit(null);
    if (action === "next-row") {
      if (ri === rows.length - 1) { addRow(); setTimeout(() => setEdit({ r: ri + 1, c: ci }), 30); }
      else setEdit({ r: ri + 1, c: ci });
    } else if (action === "next-col") {
      if (ci < cols.length - 1) setEdit({ r: ri, c: ci + 1 });
      else if (ri < rows.length - 1) setEdit({ r: ri + 1, c: 0 });
      else { addRow(); setTimeout(() => setEdit({ r: ri + 1, c: 0 }), 30); }
    } else if (action === "prev-col") {
      if (ci > 0) setEdit({ r: ri, c: ci - 1 });
      else if (ri > 0) setEdit({ r: ri - 1, c: cols.length - 1 });
    }
  };

  // teclado global cuando hay selección (sin estar editando)
  // → mantenemos simple: navegación con flechas SOLO mientras se edita usa el input. Para no editar todavía no agregamos foco-de-celda separado, pero Tab/Enter dentro de una celda ya cubre el caso.

  // totales por columna numérica
  const totals = cols.map(c => {
    if (c.type !== "number") return null;
    const nums = rows.map(r => +r.cells[c.id]).filter(n => !isNaN(n));
    return nums.length ? {
      sum: nums.reduce((a, b) => a + b, 0),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
      count: nums.length,
    } : null;
  });
  const hasNumberCol = cols.some(c => c.type === "number");

  // CSV
  const exportCSV = () => {
    const blob = new Blob([csvBuild(cols, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tabla.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 200);
    toast("CSV exportado");
  };
  const importCSV = (text) => {
    const parsed = csvParse(text);
    if (!parsed.length) return toast("CSV vacío");
    const [header, ...body] = parsed;
    const newCols = header.map(name => ({ id: uid(), name: (name || "Col").trim() || "Col", type: "text" }));
    const newRows = body.map(r => {
      const cells = {};
      newCols.forEach((c, i) => { cells[c.id] = (r[i] == null ? "" : r[i]); });
      return { id: uid(), cells };
    });
    onPatch({ cols: newCols, rows: newRows.length ? newRows : [{ id: uid(), cells: {} }] });
    toast("CSV importado (" + newRows.length + " filas)");
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => importCSV(String(fr.result || ""));
    fr.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="tbl-wrap">
      <div className="tbl-bar">
        <span className="mono">Tabla · {rows.length} {rows.length === 1 ? "fila" : "filas"} · {cols.length} {cols.length === 1 ? "col" : "cols"}</span>
        <span style={{ flex: 1 }}></span>
        <button className="tbl-bar-btn" onClick={() => fileRef.current && fileRef.current.click()} title="Importar CSV">
          <Icon name="upload" size={12} /> Importar CSV
        </button>
        <button className="tbl-bar-btn" onClick={exportCSV} title="Exportar CSV">
          <Icon name="download" size={12} /> Exportar
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
      </div>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id}>
                  <div className="tbl-th">
                    <input className="tbl-th-name" value={c.name}
                      onChange={(e) => renameCol(c.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()} placeholder="Sin nombre" />
                    <span className="tbl-th-type">{(COL_TYPES.find(t => t.t === c.type) || {}).label || c.type}</span>
                    <button className="tbl-th-menu" onClick={(e) => { e.stopPropagation(); setColMenu(colMenu === c.id ? null : c.id); }}>
                      <Icon name="dots" size={14} />
                    </button>
                  </div>
                  {colMenu === c.id && (
                    <ColMenu col={c} cols={cols} onPatchCols={setCols}
                      onSort={(dir) => sortBy(c.id, dir)}
                      onDelete={() => delCol(c.id)}
                      onClose={() => setColMenu(null)} />
                  )}
                </th>
              ))}
              <th className="tbl-add-col">
                <button onClick={addCol} title="Agregar columna"><Icon name="plus" size={14} /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.id}>
                {cols.map((c, ci) => {
                  const isEdit = edit && edit.r === ri && edit.c === ci;
                  const v = r.cells[c.id];
                  return (
                    <td key={c.id} className={isEdit ? "edit" : ""}
                        onClick={() => { if (c.type !== "check") setEdit({ r: ri, c: ci }); }}>
                      {isEdit
                        ? <CellEditor col={c} value={v}
                            onChange={(val) => setCell(r.id, c.id, val)}
                            onNav={(action) => nav(action, ri, ci)} />
                        : <CellView col={c} value={v}
                            onToggleCheck={() => setCell(r.id, c.id, !v)} />}
                    </td>
                  );
                })}
                <td className="tbl-row-actions">
                  <button onClick={() => delRow(r.id)} title="Eliminar fila"><Icon name="x" size={12} /></button>
                </td>
              </tr>
            ))}
            <tr className="tbl-add-row">
              <td colSpan={cols.length + 1}>
                <button onClick={addRow}><Icon name="plus" size={13} /> Nueva fila</button>
              </td>
            </tr>
          </tbody>
          {hasNumberCol && (
            <tfoot>
              <tr>
                {cols.map((c, ci) => (
                  <td key={c.id} className="tbl-total">
                    {c.type === "number" && totals[ci] ? (
                      <div className="tbl-total-inner">
                        <span className="mono">Σ</span>
                        <span className="tnum" style={{ color: "var(--violet-hi)", fontWeight: 600 }}>{Number.isInteger(totals[ci].sum) ? totals[ci].sum : totals[ci].sum.toFixed(2)}</span>
                        <span className="mono" style={{ marginLeft: 10 }}>μ</span>
                        <span className="tnum" style={{ color: "var(--tx-2)" }}>{totals[ci].avg.toFixed(1)}</span>
                      </div>
                    ) : null}
                  </td>
                ))}
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export { TableBlock, newTableData, csvParse, csvBuild };