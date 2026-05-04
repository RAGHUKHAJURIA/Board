'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MousePointer2, Hand, Square, Circle, Triangle, Minus, ArrowRight, 
  Hexagon, Pen, Eraser, Baseline
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvas-store';
import { ShapeType } from '@/types';
import { ToolButton } from './ToolButton';
import { StyleBar } from './StyleBar';

export function Toolbar() {
  const tool = useCanvasStore(state => state.tool);
  const setTool = useCanvasStore(state => state.setTool);

  const showStyleBar = ![ 'select', 'hand', 'eraser', 'laser' ].includes(tool as string);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-1.5 rounded-2xl shadow-xl flex items-center gap-1"
      >
        <ToolButton 
          icon={MousePointer2} label="Select" shortcut="V" 
          isActive={tool === 'select'} onClick={() => setTool('select')} 
        />
        <div className="w-[1px] h-8 bg-zinc-800 mx-1" />
        
        <ToolButton 
          icon={Square} label="Rectangle" shortcut="R" 
          isActive={tool === ShapeType.RECTANGLE} onClick={() => setTool(ShapeType.RECTANGLE)} 
        />
        <ToolButton 
          icon={Circle} label="Ellipse" shortcut="O" 
          isActive={tool === ShapeType.ELLIPSE} onClick={() => setTool(ShapeType.ELLIPSE)} 
        />
        <ToolButton 
          icon={Triangle} label="Triangle" 
          isActive={tool === ShapeType.TRIANGLE} onClick={() => setTool(ShapeType.TRIANGLE)} 
        />
        <ToolButton 
          icon={Hexagon} label="Polygon" 
          isActive={tool === ShapeType.HEXAGON} onClick={() => setTool(ShapeType.HEXAGON)} 
        />
        
        <div className="w-[1px] h-8 bg-zinc-800 mx-1" />
        
        <ToolButton 
          icon={Minus} label="Line" shortcut="L" 
          isActive={tool === ShapeType.LINE} onClick={() => setTool(ShapeType.LINE)} 
        />
        <ToolButton 
          icon={ArrowRight} label="Arrow" shortcut="A" 
          isActive={tool === ShapeType.CONNECTOR} onClick={() => setTool(ShapeType.CONNECTOR)} 
        />
        
        <div className="w-[1px] h-8 bg-zinc-800 mx-1" />
        
        <ToolButton 
          icon={Pen} label="Freehand" shortcut="P" 
          isActive={tool === ShapeType.FREEHAND} onClick={() => setTool(ShapeType.FREEHAND)} 
        />
        <ToolButton 
          icon={Baseline} label="Text" shortcut="T" 
          isActive={tool === 'text'} onClick={() => setTool('text')} 
        />
        <ToolButton 
          icon={Eraser} label="Eraser" shortcut="E" 
          isActive={tool === 'eraser'} onClick={() => setTool('eraser')} 
        />
        
        <div className="w-[1px] h-8 bg-zinc-800 mx-1" />
        
        <ToolButton 
          icon={Hand} label="Pan View" shortcut="H" 
          isActive={tool === 'hand'} onClick={() => setTool('hand')} 
        />
        
      </motion.div>

      {showStyleBar && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
        >
          <StyleBar />
        </motion.div>
      )}
    </div>
  );
}
