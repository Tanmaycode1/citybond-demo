"use client";
import { useEffect, useRef } from "react";
export function RichEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);
  function format(command: string, argument?: string) {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    if (ref.current) onChange(ref.current.innerHTML);
  }
  return <div className="rich-editor">
    <div className="rich-toolbar" role="toolbar" aria-label="Article formatting">
      {[['Bold','bold'],['Italic','italic'],['Bullets','insertUnorderedList'],['Numbered list','insertOrderedList']].map(([name,command]) => <button type="button" key={command} onMouseDown={e => e.preventDefault()} onClick={() => format(command)}>{name}</button>)}
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('formatBlock','h2')}>Heading</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('formatBlock','p')}>Paragraph</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { const href = prompt('Link address (https:// or /page)'); if (href && /^(https:\/\/|\/(?!\/))/.test(href)) format('createLink', href); }}>Link</button>
    </div>
    <div ref={ref} className="rich-editable" role="textbox" aria-label="Article content" aria-multiline="true" contentEditable suppressContentEditableWarning onBlur={e => onChange(e.currentTarget.innerHTML)} />
    <small>Format text above. Changes are saved with your draft.</small>
  </div>;
}
