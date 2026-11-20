import { useEffect, useState } from "react";
import { api, shrinkImage } from "../lib/api";
import { CapturedDocument, deleteDocument, getDocuments, saveDocument } from "../lib/profile-vault";
import { useApp } from "../lib/state";

type Scan = Awaited<ReturnType<typeof api.scanDoc>> & { image: string };

export default function Docs() {
  const { t, label, updateProfile } = useApp();
  const [docs, setDocs] = useState<CapturedDocument[]>([]);
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const reload = () => getDocuments().then((d) => setDocs(d.sort((a, b) => b.capturedAt - a.capturedAt))).catch(() => undefined);
  useEffect(() => { reload(); }, []);

  const [consent, setConsent] = useState(false);
  async function onFile(file?: File) {
    if (!file) return;
    if (!consent) { setErr("Tick the consent box first. Nothing is sent to the AI service until you do."); return; }
    setBusy(true); setErr(""); setScan(null);
    try {
      const image = await shrinkImage(file);
      setScan({ ...(await api.scanDoc(image, "image/jpeg", consent)), image });
    } catch (e) { setErr(String(e)); }
    setBusy(false);
  }
  async function save() {
    if (!scan) return;
    const fields = Object.fromEntries(Object.entries(scan.fields ?? {}).map(([k, v]) => [k, String(v ?? "")]));
    await saveDocument({ id: crypto.randomUUID(), type: scan.doc_type, label: label("docType", scan.doc_type), imageData: scan.image, extractedFields: fields, capturedAt: Date.now(), qualityScore: Math.round(scan.confidence * 100) });
    await updateProfile(fields); setScan(null); reload();
  }
  return (
    <section>
      <div className="card">
        <b>{t("scanDoc")}</b><p className="muted">{t("scanHint")}</p>
        <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree that this photo is sent to Google Gemini (an AI service) to read its text. The photo is not stored on our server, and I can remove my saved details any time.</span></label>
        <input type="file" accept="image/*" capture="environment" disabled={!consent || busy} onChange={(e) => onFile(e.target.files?.[0])} />
        {busy && <p>{t("reading")}</p>}{err && <p className="warn">{err}</p>}
        {scan && (
          <div>
            <img className="thumb" src={scan.image} alt="" />
            <p><b>{label("docType", scan.doc_type)}</b> · {Math.round(scan.confidence * 100)}%</p>
            {scan.quality_notes && <p className="warn small">{scan.quality_notes}</p>}
            {scan.aadhaar_checksum_ok === false && <p className="warn small">Aadhaar number failed the checksum – please check each digit.</p>}
            <p className="small"><b>Review the values below.</b> Empty or unclear fields are marked. Correct anything that is wrong before you save.</p>
            <div className="grid">
              {Object.entries(scan.fields ?? {}).map(([k, v]) => (
                <label key={k} className={!String(v).trim() ? "unclear" : ""}>
                  {k}{!String(v).trim() ? " (not read – please fill)" : ""}
                  <input value={String(v)} onChange={(e) => setScan({ ...scan, fields: { ...scan.fields, [k]: e.target.value } })} />
                </label>
              ))}
            </div>
            <button onClick={save} disabled={Object.values(scan.fields ?? {}).every((v) => !String(v ?? "").trim())}>{t("applyUseDetails")} ✓</button>
            <button className="link" onClick={() => setScan(null)}>Discard</button>
          </div>
        )}
      </div>
      <p className="muted small">🔒 {t("vaultNote")}</p>
      {docs.map((d) => (
        <div className="card row" key={d.id}>
          <img className="thumb sm" src={d.imageData} alt="" />
          <div><b>{d.label}</b><p className="muted small">{new Date(d.capturedAt).toLocaleDateString()}</p></div>
          <button className="link" onClick={() => deleteDocument(d.id).then(reload)}>🗑</button>
        </div>
      ))}
    </section>
  );
}
