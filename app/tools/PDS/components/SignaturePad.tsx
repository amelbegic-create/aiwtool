/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useRef, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  value?: string | null;
  onChange: (base64: string | null) => void;
  disabled?: boolean;
  label: string;
}

export default function SignaturePad({ value, onChange, disabled, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      
      if (value) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          setIsEmpty(false);
        };
        img.src = value;
      }
    }
  }, [value]);

  const saveSignature = () => {
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
      setIsEmpty(false);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      onChange(null);
      setIsEmpty(true);
    }
  };

  return (
    <div className="border border-slate-200 rounded-3xl p-4 bg-white shadow-inner transition-all hover:border-[#1a3826]/20">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
        {!disabled && !isEmpty && (
          <button onClick={clear} className="text-red-500 p-1 hover:bg-red-50 rounded-lg transition-all">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <canvas 
        ref={canvasRef} 
        onMouseUp={saveSignature}
        onTouchEnd={saveSignature}
        className={`w-full h-24 border-2 border-dashed rounded-2xl transition-all ${disabled ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-200 cursor-crosshair'}`}
      />
    </div>
  );
}