"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";

interface Props {
  label: string;
  hint: string;
  file: File | null;
  onFile: (file: File | null) => void;
}

export default function FileDropzone({ label, hint, file, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(f: File | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    setError(null);
    onFile(f);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={`flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition ${
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : file
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-300 bg-white hover:border-indigo-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {file ? (
          <>
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="max-w-[16rem] truncate">{file.name}</span>
              <button
                type="button"
                aria-label="Remove file"
                onClick={(e) => {
                  e.stopPropagation();
                  onFile(null);
                }}
                className="rounded p-0.5 text-slate-500 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
          </>
        ) : (
          <>
            <UploadCloud className="mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Drag & drop CSV, or click to browse</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
