"use client";

/**
 * PdbDropzone — a `.pdb`-only file selector with drag-and-drop.
 *
 * Responsibilities are deliberately narrow: pick exactly one valid `.pdb` file
 * and hand it up to the parent via `onSelect`. It validates the extension and
 * rejects empty files, but it does NOT upload or run anything — that belongs to
 * the simulation console. Keeping it dumb makes it trivial to reuse and test.
 */
import { useCallback, useId, useRef, useState } from "react";

type Props = {
  /** Called with a validated file, or null when the selection is cleared. */
  onSelect: (file: File | null) => void;
  /** The currently selected file (controlled by the parent), if any. */
  selected: File | null;
  /** Disable interaction while a simulation is in flight. */
  disabled?: boolean;
};

/** A PDB is plain text; anything else can't describe a molecular structure. */
function validatePdb(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdb")) {
    return "Only .pdb files are supported.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

export function PdbDropzone({ onSelect, selected, disabled = false }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const problem = validatePdb(file);
      if (problem) {
        setError(problem);
        onSelect(null);
        return;
      }
      setError(null);
      onSelect(file);
    },
    [onSelect],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      accept(e.dataTransfer.files?.[0]);
    },
    [accept, disabled],
  );

  const clear = useCallback(() => {
    setError(null);
    onSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onSelect]);

  return (
    <div className="flex flex-col gap-3">
      {/* The dropzone doubles as a label for the hidden native input, so a
          click anywhere opens the file picker and keyboard focus still works. */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-cold bg-cold/5" : "border-line bg-panel-2",
          disabled ? "pointer-events-none opacity-50" : "hover:border-cold",
        ].join(" ")}
      >
        <span className="spectral-ramp h-6 w-6 rounded-sm" aria-hidden />
        <span className="text-sm text-ink">
          {dragging ? "Release to load" : "Drop a .pdb here, or click to browse"}
        </span>
        <span className="mono-label">{"// structure · .pdb"}</span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".pdb"
          disabled={disabled}
          className="sr-only"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-hot">
          {error}
        </p>
      )}

      {selected && !error && (
        <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3 py-2">
          <span className="truncate font-mono text-xs text-ink" title={selected.name}>
            {selected.name}
            <span className="ml-2 text-muted">
              {(selected.size / 1024).toFixed(1)} KB
            </span>
          </span>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="ml-3 shrink-0 font-mono text-xs text-muted hover:text-hot disabled:opacity-50"
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}
