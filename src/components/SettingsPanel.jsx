import { useEffect, useState } from 'react';
import { FONTS, THEMES, applySettings, loadLocalSettings, saveLocalSettings } from '../lib/settings.js';
import { useAuth } from '../lib/AuthContext.jsx';

export default function SettingsPanel() {
  const { isLocal, signOut } = useAuth();
  const [cfg, setCfg] = useState(loadLocalSettings());

  useEffect(() => { applySettings(cfg); saveLocalSettings(cfg); }, [cfg]);

  let group = '';
  return (
    <div>
      <div className="live" aria-label="Preview">
        <p>The river had risen past the third step. She counted it twice, because counting was easier than deciding.</p>
        <p>Her brother's handwriting hadn't changed.</p>
      </div>

      <div className="sec">
        <h3>Font</h3>
        <p className="small" style={{ margin: '0 0 4px' }}>Changes the font everywhere in the app.</p>
        {FONTS.map((f) => {
          const showGroup = f[0] !== group;
          group = f[0];
          const on = cfg.font === f[1];
          return (
            <div key={f[1]}>
              {showGroup && <span className="gh">{f[0]}</span>}
              <button className="fopt" type="button" aria-pressed={on} onClick={() => setCfg((c) => ({ ...c, font: f[1] }))}>
                <span>
                  <span className="nm" style={{ fontFamily: f[2] }}>{f[1]}</span>
                  <span className="sm2" style={{ fontFamily: f[2] }}>The river had risen past the third step.</span>
                </span>
                {on && <span aria-hidden="true">✓</span>}
              </button>
            </div>
          );
        })}
      </div>

      <div className="sec">
        <h3>Size</h3>
        <div className="row2">
          <input type="range" min="14" max="28" step="1" value={cfg.size} onChange={(e) => setCfg((c) => ({ ...c, size: +e.target.value }))} aria-label="Text size" />
          <span className="small">{cfg.size} px</span>
        </div>
      </div>

      <div className="sec">
        <h3>Line spacing</h3>
        <div className="seg" role="group" aria-label="Line spacing">
          {[['1.5', 'Tight'], ['1.7', 'Normal'], ['1.9', 'Roomy'], ['2.2', 'Double']].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={String(cfg.lh) === v} onClick={() => setCfg((c) => ({ ...c, lh: v }))}>{label}</button>
          ))}
        </div>
      </div>

      <div className="sec">
        <h3>Page width</h3>
        <div className="seg" role="group" aria-label="Page width">
          {[['28rem', 'Narrow'], ['34rem', 'Medium'], ['42rem', 'Wide']].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={cfg.width === v} onClick={() => setCfg((c) => ({ ...c, width: v }))}>{label}</button>
          ))}
        </div>
        <p className="pencil" style={{ margin: '6px 0 0' }}>only shows on wide screens</p>
      </div>

      <div className="sec">
        <h3>Theme</h3>
        <div className="seg" role="group" aria-label="Theme">
          {THEMES.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={cfg.theme === v} onClick={() => setCfg((c) => ({ ...c, theme: v }))}>{label}</button>
          ))}
        </div>
      </div>

      {!isLocal && (
        <div className="sec">
          <h3>Account</h3>
          <button className="btn" type="button" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}
