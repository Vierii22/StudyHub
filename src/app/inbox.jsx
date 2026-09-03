import React from 'react';

import { Icon } from './icons.jsx';
import { Store, useStore, uid, toast, isSubjectDone } from './store.jsx';
import { DatePicker, Seg } from './ui.jsx';
import { syncTaskToCalendar } from './syncEngine.js';
import { uploadToStorage, signedUrlFor, removeFromStorage } from './storageFiles.js';

/* ============================================================
   BANDEJA — "lo que se me ocurre"
   Dos momentos distintos, a propósito:
   1) DURANTE EL DÍA escribís suelto, sin fecha ni materia ni nada.
      La fricción cero es el punto: si te pide datos, no lo anotás.
   2) A LA NOCHE la ordenás: cada cosa se convierte en tarea (con
      fecha), en evento del calendario, o se descarta.
   Lo que no ordenaste queda esperando — no se pierde ni molesta.
   ============================================================ */

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mananaISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ---------- grabador de notas de voz ---------- */
const REC_MAX_S = 120; /* 2 min — de sobra para "se me ocurrió" y no dispara el costo de Storage */

const mimeSoportado = () => {
  const tipos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of tipos) if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  return "";
};

const RecordButton = () => {
  const [grabando, setGrabando] = React.useState(false);
  const [subiendo, setSubiendo] = React.useState(false);
  const [seg, setSeg] = React.useState(0);
  const recRef = React.useRef(null);
  const chunksRef = React.useRef([]);
  const streamRef = React.useRef(null);
  const timerRef = React.useRef(null);

  const limpiar = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setGrabando(false);
    setSeg(0);
  };

  const empezar = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast("Este navegador no puede grabar audio");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = mimeSoportado();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => subir(new Blob(chunksRef.current, { type: mime || "audio/webm" }), seg);
      rec.start();
      recRef.current = rec;
      setGrabando(true);
      timerRef.current = setInterval(() => {
        setSeg(s => {
          if (s + 1 >= REC_MAX_S) { rec.stop(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast("No se pudo acceder al micrófono");
    }
  };

  const parar = () => recRef.current?.stop();

  const subir = async (blob, duracionSeg) => {
    limpiar();
    if (blob.size < 500) return; /* grabación vacía / cancelada al toque */
    setSubiendo(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const file = new File([blob], `nota-${Date.now()}.${ext}`, { type: blob.type });
      const { path } = await uploadToStorage(file, "audio");
      const mm = Math.floor(duracionSeg / 60), ss = duracionSeg % 60;
      Store.set(s => {
        s.inbox = [{
          id: uid(), type: "audio", path,
          t: `Nota de voz (${mm}:${String(ss).padStart(2, "0")})`,
          created: new Date().toISOString(),
        }, ...(s.inbox || [])];
      });
      toast("Nota de voz guardada");
    } catch {
      toast("No se pudo guardar el audio");
    }
    setSubiendo(false);
  };

  if (subiendo) {
    return <button className="inbox-mic-btn subiendo" disabled title="Guardando…"><Icon name="clock" size={17} /></button>;
  }
  if (grabando) {
    const mm = Math.floor(seg / 60), ss = seg % 60;
    return (
      <button className="inbox-mic-btn grabando" onClick={parar} title="Detener">
        <span className="inbox-mic-dot" />
        <span className="inbox-mic-time">{mm}:{String(ss).padStart(2, "0")}</span>
      </button>
    );
  }
  return (
    <button className="inbox-mic-btn" onClick={empezar} title="Grabar nota de voz">
      <Icon name="mic" size={17} />
    </button>
  );
};

/* ---------- caja de escritura rápida ---------- */
export const InboxQuickAdd = ({ autoFocus = false, placeholder = "Se me ocurrió…" }) => {
  const [txt, setTxt] = React.useState("");
  const ref = React.useRef();

  React.useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const add = () => {
    const t = txt.trim();
    if (!t) return;
    Store.set(s => { s.inbox = [{ id: uid(), t, created: new Date().toISOString() }, ...(s.inbox || [])]; });
    setTxt("");
    toast("Anotado");
    ref.current?.focus();
  };

  return (
    <div className="inbox-add">
      <input
        ref={ref}
        className="inbox-add-input"
        value={txt}
        placeholder={placeholder}
        onChange={e => setTxt(e.target.value)}
        onKeyDown={e => e.key === "Enter" && add()}
      />
      <RecordButton />
      <button className="inbox-add-btn" onClick={add} disabled={!txt.trim()} title="Anotar">
        <Icon name="plus" size={17} />
      </button>
    </div>
  );
};

/* ---------- convertir un ítem en tarea / evento ---------- */
const Ordenar = ({ item, onListo, onCancelar }) => {
  const [data, set] = useStore();
  const [modo, setModo]   = React.useState("tarea"); /* tarea | evento */
  const [titulo, setTit]  = React.useState(item.t);
  const [fecha, setFecha] = React.useState(mananaISO());
  const [prio, setPrio]   = React.useState("media");
  const [subj, setSubj]   = React.useState("");

  const materias = (data.subjects || []).filter(s => !isSubjectDone(s));

  const guardar = () => {
    const t = titulo.trim();
    if (!t) return toast("Poné un título");

    if (modo === "tarea") {
      /* Las tareas guardan DOS campos de fecha: "due" es lo que se muestra
         ("4/9") y "dueDate" la fecha ISO real. Si se manda solo uno, la
         tarea aparece sin fecha o no sincroniza con el calendario. */
      const [, mm, dd] = (fecha || "").split("-");
      const tarea = {
        id: uid(), t, done: false, prio,
        due: fecha ? `${parseInt(dd)}/${parseInt(mm)}` : "—",
        dueDate: fecha || "",
        subject: subj || null,
      };
      Store.set(s => { s.tasks = [tarea, ...(s.tasks || [])]; });
      if (fecha) syncTaskToCalendar(tarea, data, set);
      toast("Pasó a tus tareas");
    } else {
      Store.set(s => {
        s.events = [...(s.events || []), {
          id: uid(), title: t, date: fecha, kind: "evento",
          subjectId: subj || null, color: "#D9551F",
        }];
      });
      toast("Va al calendario");
    }
    onListo();
  };

  return (
    <div className="inbox-ordenar">
      <input className="inbox-ord-tit" value={titulo} onChange={e => setTit(e.target.value)} placeholder="Título" />

      <Seg
        opts={[{ id: "tarea", label: "Tarea" }, { id: "evento", label: "Evento" }]}
        value={modo}
        onChange={setModo}
      />

      <div className="inbox-ord-fila">
        <DatePicker value={fecha} onChange={setFecha} />
        {modo === "tarea" && (
          <Seg
            opts={[{ id: "alta", label: "Alta" }, { id: "media", label: "Media" }, { id: "baja", label: "Baja" }]}
            value={prio}
            onChange={setPrio}
          />
        )}
      </div>

      {materias.length > 0 && (
        <select className="inbox-ord-sel" value={subj} onChange={e => setSubj(e.target.value)}>
          <option value="">Sin materia</option>
          {materias.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      <div className="inbox-ord-acc">
        <button className="btn-soft" onClick={onCancelar}>Cancelar</button>
        <button className="btnC-crear" onClick={guardar}>
          <span className="btnC-chip"><Icon name="check" size={13} /></span>
          Guardar
        </button>
      </div>
    </div>
  );
};

/* botón de escuchar una nota de voz — pide el link firmado recién al tocar */
const PlayAudio = ({ path }) => {
  const [estado, setEstado] = React.useState("quieto"); /* quieto | cargando | sonando */
  const audioRef = React.useRef(null);

  const tocar = async () => {
    if (estado === "sonando") { audioRef.current?.pause(); setEstado("quieto"); return; }
    setEstado("cargando");
    try {
      const url = await signedUrlFor(path);
      const audio = new Audio(url);
      audio.onended = () => setEstado("quieto");
      audioRef.current = audio;
      await audio.play();
      setEstado("sonando");
    } catch {
      toast("No se pudo reproducir el audio");
      setEstado("quieto");
    }
  };

  React.useEffect(() => () => audioRef.current?.pause(), []);

  return (
    <button className="inbox-row-ic play" onClick={tocar} title={estado === "sonando" ? "Pausar" : "Escuchar"}>
      <Icon name={estado === "cargando" ? "clock" : estado === "sonando" ? "pause" : "playFilled"} size={15} />
    </button>
  );
};

/* ---------- una fila de la bandeja ---------- */
const Fila = ({ item, abierto, onAbrir, onCerrar }) => {
  const esAudio = item.type === "audio";

  const descartar = () => {
    Store.set(s => { s.inbox = (s.inbox || []).filter(x => x.id !== item.id); });
    if (esAudio && item.path) removeFromStorage(item.path);
    toast("Descartado");
  };
  const sacar = () => Store.set(s => { s.inbox = (s.inbox || []).filter(x => x.id !== item.id); });

  const cuando = (() => {
    if (!item.created) return "";
    const d = new Date(item.created);
    const dias = Math.floor((Date.now() - d.getTime()) / 864e5);
    if (dias === 0) return "hoy";
    if (dias === 1) return "ayer";
    return `hace ${dias} días`;
  })();

  return (
    <div className={`inbox-row${abierto ? " abierta" : ""}`}>
      <div className="inbox-row-head">
        {esAudio && <PlayAudio path={item.path} />}
        <span className="inbox-row-txt" onClick={abierto ? onCerrar : onAbrir}>{item.t}</span>
        <span className="inbox-row-when">{cuando}</span>
        {!abierto && (
          <>
            <button className="inbox-row-ic" onClick={onAbrir} title="Ordenar">
              <Icon name="arrowR" size={14} />
            </button>
            <button className="inbox-row-ic" onClick={descartar} title="Descartar">
              <Icon name="trash" size={14} />
            </button>
          </>
        )}
      </div>
      {abierto && (
        <Ordenar
          item={item}
          onListo={() => { sacar(); onCerrar(); }}
          onCancelar={onCerrar}
        />
      )}
    </div>
  );
};

/* ---------- tarjeta completa (para el dashboard) ---------- */
export const InboxCard = () => {
  const [data] = useStore();
  const inbox = data.inbox || [];
  const [abierta, setAbierta] = React.useState(null);

  return (
    <div className="inbox-card">
      <div className="inbox-head">
        <div className="inbox-titulo">
          <Icon name="edit" size={15} /> Se me ocurre…
        </div>
        {inbox.length > 0 && <span className="inbox-count">{inbox.length}</span>}
      </div>
      <div className="inbox-sub">
        Tirá acá cualquier cosa que se te cruce. Después la ordenás.
      </div>

      <InboxQuickAdd />

      {inbox.length === 0 ? (
        <div className="inbox-vacio">Nada anotado. Escribí arriba lo primero que se te ocurra.</div>
      ) : (
        <div className="inbox-lista">
          {inbox.map(it => (
            <Fila
              key={it.id}
              item={it}
              abierto={abierta === it.id}
              onAbrir={() => setAbierta(it.id)}
              onCerrar={() => setAbierta(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { hoyISO, mananaISO };
