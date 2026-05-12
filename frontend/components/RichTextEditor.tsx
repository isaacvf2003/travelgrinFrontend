"use client";

import { useEffect, useRef } from "react";

const TOOL_BUTTONS = [
  { label: "B", command: "bold", className: "font-bold", title: "Negrita" },
  { label: "I", command: "italic", className: "italic", title: "Cursiva" },
  { label: "U", command: "underline", className: "underline", title: "Subrayado" },
  { label: "• Lista", command: "insertUnorderedList", title: "Lista con puntos" },
  { label: "1. Lista", command: "insertOrderedList", title: "Lista numerada" },
] as const;

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

export default function RichTextEditor({ value, onChange, placeholder = "", minHeightClassName = "min-h-[90px]" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  const isSelectionInsideEditor = () => {
    const el = editorRef.current;
    const selection = window.getSelection();
    if (!el || !selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    return el.contains(range.commonAncestorContainer);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !isSelectionInsideEditor()) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    const range = selectionRef.current;
    if (!el || !range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const sync = () => {
    saveSelection();
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const runCommand = (command: string, option?: string) => {
    editorRef.current?.focus();
    if (!isSelectionInsideEditor()) restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, option);
    sync();
  };

  const applyFontSize = (size: string) => {
    editorRef.current?.focus();
    if (!isSelectionInsideEditor()) restoreSelection();
    document.execCommand("fontSize", false, "7");
    const fonts = editorRef.current?.querySelectorAll("font[size='7']") ?? [];
    fonts.forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
    sync();
  };

  const applyTextColor = (color: string) => {
    if (!color) return;
    runCommand("foreColor", color);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-[#00A9C6]/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
        {TOOL_BUTTONS.map((button) => (
          <button
            key={button.command}
            type="button"
            title={button.title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(button.command)}
            className={`rounded-md border border-slate-200 bg-white px-2 py-1 hover:bg-slate-100 ${"className" in button ? button.className : ""}`}
          >
            {button.label}
          </button>
        ))}
        <label className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 hover:bg-slate-100">
          <span>Color</span>
          <input
            type="color"
            defaultValue="#0f172a"
            aria-label="Color de texto"
            onMouseDown={saveSelection}
            onChange={(event) => applyTextColor(event.target.value)}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(event) => {
            if (event.target.value) applyFontSize(event.target.value);
            event.target.value = "";
          }}
          className="h-7 rounded-md border border-slate-200 bg-white px-2"
          aria-label="Tamaño de letra"
        >
          <option value="">Tamaño</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
          <option value="28px">28</option>
          <option value="32px">32</option>
        </select>
        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(event) => {
            if (event.target.value) runCommand("formatBlock", event.target.value);
            event.target.value = "";
          }}
          className="h-7 rounded-md border border-slate-200 bg-white px-2"
          aria-label="Formato"
        >
          <option value="">Formato</option>
          <option value="p">Párrafo</option>
          <option value="h2">Título grande</option>
          <option value="h3">Título mediano</option>
          <option value="h4">Título chico</option>
        </select>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        data-placeholder={placeholder}
        className={`rich-text-editor-content ${minHeightClassName} w-full px-3 py-2 text-sm outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`}
      />
    </div>
  );
}
