'use client';

import { useEffect, useRef, useState } from 'react';

interface TextEditorProps {
  x: number;
  y: number;
  initialText: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  onComplete: (text: string) => void;
  onCancel: () => void;
}

export function TextEditor({
  x, y, initialText, fontSize, fontFamily, color,
  onComplete, onCancel
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initialText);
  
  useEffect(() => {
    // Focus and select all text
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
    
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        onComplete(text);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [text, onComplete, onCancel]);
  
  const handleBlur = () => {
    // Save on blur
    onComplete(text);
  };
  
  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        color: color,
        backgroundColor: 'transparent',
        border: '2px solid #4A90E2',
        borderRadius: '4px',
        padding: '4px 8px',
        outline: 'none',
        resize: 'none',
        minWidth: '200px',
        minHeight: '40px',
        zIndex: 1000,
      }}
      rows={1}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
