import React, { useCallback, useState } from 'react';

interface Props {
  onUpload: (file: File) => void;
  hasImage: boolean;
}

export default function UploadArea({ onUpload, hasImage }: Props) {
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    (file: File | undefined) => {
      if (file && file.type.startsWith('image/')) onUpload(file);
    },
    [onUpload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handle(e.dataTransfer.files[0]);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handle(e.target.files?.[0]);
    // reset so same file can be re-uploaded
    e.target.value = '';
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
        px-6 py-8 transition-all cursor-pointer select-none
        ${dragging
          ? 'border-blue-400 bg-blue-950/40'
          : hasImage
            ? 'border-slate-600 bg-slate-800/30 hover:border-blue-500 hover:bg-blue-950/20'
            : 'border-slate-500 bg-slate-800/50 hover:border-blue-400 hover:bg-blue-950/30'
        }
      `}
      onClick={() => document.getElementById('omr-file-input')?.click()}
    >
      <input
        id="omr-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Icon */}
      <div className={`rounded-full p-3 ${dragging ? 'bg-blue-800/60' : 'bg-slate-700/60'}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-slate-200">
          {dragging
            ? 'Drop image here'
            : hasImage
              ? 'Replace score image'
              : 'Upload score image'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Click or drag &amp; drop · PNG, JPG, TIFF, etc.
        </p>
      </div>
    </div>
  );
}
