'use client';
import { useRef, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface Props {
  value?: string | null;
  onChange: (base64: string | null) => void;
  disabled?: boolean;
  label: string;
}

export default function SignaturePad({ value, onChange, disabled, label }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigCanvas = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // FIX: setTimeout rješava error
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady && value && sigCanvas.current && !disabled) {
        // Mali delay da se canvas inicijalizira
        const timer = setTimeout(() => {
            if (sigCanvas.current && sigCanvas.current.isEmpty()) {
                sigCanvas.current.fromDataURL(value);
            }
        }, 50);
        return () => clearTimeout(timer);
    }
  }, [isReady, value, disabled]);

  const handleEnd = () => {
    if (sigCanvas.current) {
        onChange(sigCanvas.current.toDataURL());
    }
  };

  const clear = () => {
    if (sigCanvas.current) {
        sigCanvas.current.clear();
        onChange(null); 
    }
  };

  if (!isReady) return <div className="h-24 bg-slate-50 rounded-2xl animate-pulse border border-slate-200"></div>;

  return (
    <div className={`border border-slate-200 rounded-3xl p-4 bg-white shadow-inner transition-all ${!disabled ? 'hover:border-[#1a3826]/20' : ''}`}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            {label}
        </span>
        {!disabled && (
          <button 
            type="button" 
            onClick={clear} 
            className="text-red-500 p-1 hover:bg-red-50 rounded-lg transition-all"
            title="Obriši potpis"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className={`w-full h-24 border-2 border-dashed rounded-2xl overflow-hidden relative ${disabled ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
        
        {disabled ? (
            value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="Potpis" className="w-full h-full object-contain" />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-300 text-xs italic">
                    Nije potpisano
                </div>
            )
        ) : (
            <>
                <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="blue"
                    canvasProps={{
                        className: 'signature-canvas w-full h-full cursor-crosshair'
                    }}
                    onEnd={handleEnd}
                />
                {!value && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-200 text-[10px] font-bold uppercase tracking-widest">
                        Ovdje se potpišite
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}