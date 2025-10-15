import React, { useRef, useEffect, useCallback } from 'react';
import BoldIcon from '../icons/BoldIcon';
import ItalicIcon from '../icons/ItalicIcon';
import ListOrderedIcon from '../icons/ListOrderedIcon';
import ListUnorderedIcon from '../icons/ListUnorderedIcon';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, disabled }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && value !== editor.innerHTML) {
      editor.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  }, [onChange]);

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
        editorRef.current.focus();
        onChange(editorRef.current.innerHTML); // Update state after formatting
    }
  };

  const ToolbarButton: React.FC<{ onClick: () => void; children: React.ReactNode; label: string }> = ({ onClick, children, label }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded hover:bg-gray-200 disabled:opacity-50"
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );

  return (
    <div className={`border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-brand-light ${disabled ? 'bg-neutral-light/70' : 'bg-white'}`}>
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-neutral-light/50 rounded-t-md">
        <ToolbarButton onClick={() => handleFormat('bold')} label="Bold"><BoldIcon /></ToolbarButton>
        <ToolbarButton onClick={() => handleFormat('italic')} label="Italic"><ItalicIcon /></ToolbarButton>
        <ToolbarButton onClick={() => handleFormat('insertUnorderedList')} label="Unordered List"><ListUnorderedIcon /></ToolbarButton>
        <ToolbarButton onClick={() => handleFormat('insertOrderedList')} label="Ordered List"><ListOrderedIcon /></ToolbarButton>
      </div>
      <div
        ref={editorRef}
        onInput={handleInput}
        contentEditable={!disabled}
        className="w-full p-4 focus:outline-none overflow-y-auto relative"
        style={{ minHeight: '24rem' }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
