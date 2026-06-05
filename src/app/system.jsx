import React from 'react';

import { Icon } from './icons.jsx';
import { Btn, Chip, MonoLabel, PageHead } from './ui.jsx';

/* ============================================================
   SISTEMA DE DISEÑO — panel de tokens
   ============================================================ */

const Swatch = ({ name, varName, value, text }) => (
  <div className="card hoverable" style={{ padding: 0, overflow: "hidden", minHeight: 0 }}>
    <div style={{ height: 84, background: value, borderBottom: "1px solid var(--line)" }}></div>
    <div style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--tx-3)", marginTop: 5 }}>{varName}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--tx-2)", marginTop: 2 }}>{text}</div>
    </div>
  </div>
);

const Block = ({ title, n, children }) => (
  <section style={{ marginBottom: 56 }}>
    <div className="row" style={{ gap: 14, marginBottom: 22 }}>
      <span className="mono mono-accent">{n}</span>
      <h2 className="h2">{title}</h2>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }}></div>
    </div>
    {children}
  </section>
);

const TypeRow = ({ cls, label, spec, sample }) => (
  <div className="row between" style={{ padding: "20px 0", borderBottom: "1px solid var(--line)", gap: 24 }}>
    <div style={{ width: 150, flex: "0 0 150px" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div className="mono" style={{ fontSize: 10.5, marginTop: 5 }}>{spec}</div>
    </div>
    <div className={cls} style={{ flex: 1, color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sample}</div>
  </div>
);

const SistemaPanel = ({ theme, setTheme }) => (
  <div className="page fade-in">
    <PageHead title="Sistema de diseño" meta="Tokens · tipografía · spacing · componentes" />

    {/* live switchers */}
    <div className="card tcorners" style={{ marginBottom: 50, background: "#121217" }}>
      <TerminalCorners />
      <MonoLabel accent>● Probá el sistema en vivo</MonoLabel>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px,1fr))", marginTop: 20 }}>
        <Field label="Tipografía"><Seg opts={FONT_OPTS.map(o => ({ id: o.id, label: o.label }))} value={theme.font} onChange={v => setTheme("font", v)} /></Field>
        <Field label="Acento"><Seg opts={ACCENT_OPTS} value={theme.accent} onChange={v => setTheme("accent", v)} /></Field>
        <Field label="Dashboard"><Seg opts={VARIANT_OPTS} value={theme.variant} onChange={v => setTheme("variant", v)} /></Field>
      </div>
    </div>

    <Block n="01" title="Paleta de color">
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 22 }}>
        <Swatch name="Background" varName="--bg" value="#0d0d12" text="#0d0d12" />
        <Swatch name="Surface 1 · cards" varName="--surface-1" value="#141419" text="#141419" />
        <Swatch name="Surface 2 · inputs" varName="--surface-2" value="#1b1b22" text="#1b1b22" />
        <Swatch name="Surface 3 · activo" varName="--surface-3" value="#22222b" text="#22222b" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Swatch name="Acento violeta" varName="--violet" value="#8b6dff" text="#8b6dff" />
        <Swatch name="Violeta claro · hover" varName="--violet-hi" value="#a48cff" text="#a48cff" />
        <Swatch name="Gradiente acento" varName="--grad" value="linear-gradient(135deg,#8b6dff,#c264e8)" text="8b6dff → c264e8" />
        <Swatch name="Borde" varName="--line" value="rgba(255,255,255,.06)" text="white / 6%" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 22 }}>
        <Swatch name="Texto principal" varName="--tx-1" value="#f3f3f7" text="#f3f3f7" />
        <Swatch name="Texto secundario" varName="--tx-2" value="#9a9aa6" text="#9a9aa6" />
        <Swatch name="Texto terciario" varName="--tx-3" value="#5d5d68" text="#5d5d68" />
      </div>
    </Block>

    <Block n="02" title="Tipografía">
      <div className="card">
        <TypeRow cls="display" label="Display" spec="700 · clamp 52–84px" sample="9.900" />
        <TypeRow cls="h1" label="H1 · título" spec="700 · 34px · -2%" sample="Facultad" />
        <TypeRow cls="h2" label="H2" spec="600 · 22px" sample="Próximos eventos" />
        <TypeRow cls="h3" label="H3" spec="600 · 17px" sample="Tus materias" />
        <TypeRow cls="body" label="Body" spec="400 · 15px" sample="Texto de soporte y descripciones." />
        <TypeRow cls="mono" label="Mono · label" spec="500 · 11.5px · +16% track" sample="FOCO · ESTA SEMANA" />
      </div>
      <div className="small" style={{ marginTop: 14 }}>Jerarquía extrema: los números/títulos son 3–4× el texto de soporte. Familias: <b className="tx-1">Outfit</b> · <b className="tx-1">Space Grotesk</b> · <b className="tx-1">JetBrains Mono</b> (Google Fonts).</div>
    </Block>

    <Block n="03" title="Spacing & radios">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <MonoLabel>Escala de spacing</MonoLabel>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            {[["s4 · 16","16px"],["s6 · 24 · gap grid","24px"],["card-pad · 28","28px"],["s9 · 48 · entre secciones","48px"]].map(([l, w]) => (
              <div key={l} className="row" style={{ gap: 14 }}>
                <div style={{ width: w, height: 14, background: "var(--fill)", borderRadius: 4, flex: "0 0 auto" }}></div>
                <span className="mono" style={{ fontSize: 11 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <MonoLabel>Radios</MonoLabel>
          <div className="row" style={{ gap: 18, marginTop: 18, flexWrap: "wrap" }}>
            {[["r-sm","8"],["r","12"],["r-lg · cards","16"],["r-xl","22"]].map(([l, r]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: r + "px" }}></div>
                <div className="mono" style={{ fontSize: 10, marginTop: 8 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Block>

    <Block n="04" title="Componentes">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--grid-gap)" }}>
        <div className="card">
          <MonoLabel>Botones</MonoLabel>
          <div className="wrap-gap" style={{ marginTop: 18, alignItems: "center" }}>
            <Btn variant="primary" icon="plus">Primario</Btn>
            <Btn variant="secondary">Secundario</Btn>
            <Btn variant="ghost" icon="settings">Ghost</Btn>
          </div>
        </div>
        <div className="card">
          <MonoLabel>Chips / badges</MonoLabel>
          <div className="wrap-gap" style={{ marginTop: 18 }}>
            <Chip accent dot>+45.000 XP</Chip>
            <Chip>4 tareas</Chip>
            <Chip dot>parcial</Chip>
          </div>
        </div>
        <div className="card">
          <MonoLabel>Input</MonoLabel>
          <input className="input" placeholder="Buscar sección…" style={{ marginTop: 18 }} />
        </div>
        <div className="card">
          <MonoLabel>Progreso & ring</MonoLabel>
          <div className="row" style={{ gap: 24, marginTop: 18, alignItems: "center" }}>
            <ProgressRing value={70} size={72} />
            <div style={{ flex: 1 }}><div className="bar"><i style={{ width: "62%" }}></i></div></div>
          </div>
        </div>
        <div className="card" style={{ gridColumn: "span 2" }}>
          <MonoLabel>Card · hero (único momento de relleno) vs. quiet</MonoLabel>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 18 }}>
            <div className="card card-hero tcorners" style={{ minHeight: 130 }}>
              <TerminalCorners />
              <MonoLabel>Hero</MonoLabel>
              <div className="display" style={{ fontSize: 48, color: "#fff", marginTop: 10 }}>6h 45m</div>
            </div>
            <div className="card" style={{ minHeight: 130 }}>
              <MonoLabel>Quiet</MonoLabel>
              <div className="stat" style={{ marginTop: 10 }}>9.900</div>
            </div>
          </div>
        </div>
      </div>
    </Block>
  </div>
);

export { SistemaPanel };