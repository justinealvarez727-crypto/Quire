import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }) {
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null); // { msg, label, resolve }
  const toastT = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 3800);
  }, []);
  const confirm = useCallback(
    (msg, label = 'Delete') => new Promise((resolve) => setModal({ msg, label, resolve })),
    []
  );

  function answer(v) {
    modal?.resolve(v);
    setModal(null);
  }

  return (
    <Ctx.Provider value={{ notify, confirm }}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
      {modal && (
        <div className="modalBg" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) answer(false); }}>
          <div className="modalSheet" role="dialog" aria-modal="true">
            <p>{modal.msg}</p>
            <div className="modalActions">
              <button className="btn" type="button" onClick={() => answer(false)}>Cancel</button>
              <button className="btn danger" type="button" onClick={() => answer(true)}>{modal.label}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
