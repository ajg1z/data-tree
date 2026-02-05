import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { cellDefaultWidth, headerDefaultWidth } from '../constants';
import { MeasureWrapper } from '../../../utils/MeasureWrapper';
import { MeasureCellHeaderText, MeasureCellText, MeasureColumnHeaderText } from '../../../utils/MeasureWrappers';
import { flushSync } from 'react-dom';

type CellMeasureArgs = {
  cellType: 'cell'
  text: string
}

type CellHeaderMeasureArgs = {
  cellType: 'cell-header'
  depth: number
  text: string
}

type ColumnHeaderMeasureArgs = {
  cellType: 'column-header'
  text: string
}

type MeasureArgs = CellMeasureArgs | CellHeaderMeasureArgs | ColumnHeaderMeasureArgs

export function useMeasureCellWidth({ paddingLeft }: { paddingLeft: number }) {
  const rootRef = React.useRef<Root | null>(null);
  const measureContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lastMeasuredRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }

      if (measureContainerRef.current) {
        document.body.removeChild(measureContainerRef.current);
        measureContainerRef.current = null;
      }
    };
  }, []);

  return React.useCallback(
    async (args: MeasureArgs): Promise<number> => {
      const key = `${args.cellType}:${args.text ?? ''}`;

      if (lastMeasuredRef.current.has(key)) {
        return lastMeasuredRef.current.get(key)!;
      }

      if (!measureContainerRef.current) {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.visibility = 'hidden';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.width = 'auto';
        container.style.display = 'inline-block';
        document.body.appendChild(container);
        measureContainerRef.current = container;
        rootRef.current = createRoot(container);
      }

      const element =
        args.cellType === 'column-header' ? (
          <MeasureColumnHeaderText text={args.text} />
        ) : args.cellType === 'cell-header' ? (
          <MeasureCellHeaderText text={args.text} depth={args.depth} paddingLeft={paddingLeft} />
        ) : (
          <MeasureCellText text={args.text} />
        );

      return new Promise<number>(resolve => {
        requestAnimationFrame(() => {
          const container = measureContainerRef.current!;

          flushSync(() => {
            rootRef.current!.render(<MeasureWrapper>{element}</MeasureWrapper>);
          })
          // debugger
          try {
            const width =
              container.getBoundingClientRect().width ||
              (args.cellType === 'column-header' ? headerDefaultWidth : cellDefaultWidth);
            lastMeasuredRef.current.set(key, width);
            resolve(width);

          } catch {
            const fallback = args.cellType === 'column-header' ? headerDefaultWidth : cellDefaultWidth;
            lastMeasuredRef.current.set(key, fallback);
            resolve(fallback);
          } finally {
            flushSync(() => {
              rootRef.current!.render(null);
            });
          }
        });
      });
    },
    [],
  );
}
