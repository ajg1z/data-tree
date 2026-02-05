import * as React from 'react';
import { MeasureWrapper } from './MeasureWrapper';

export const MeasureCellText = ({ text }: { text: string }) => {
  return <MeasureWrapper>{text}</MeasureWrapper>;
};

export const MeasureCellHeaderText = ({ text, depth, paddingLeft }: { text: string; depth: number; paddingLeft: number }) => {
  return (
    <MeasureWrapper>
      <span style={{ paddingLeft: depth * paddingLeft }}>{text}</span>
    </MeasureWrapper>
  );
};

export const MeasureColumnHeaderText = ({ text }: { text: string }) => {
  return <MeasureWrapper>{text}</MeasureWrapper>;
};
