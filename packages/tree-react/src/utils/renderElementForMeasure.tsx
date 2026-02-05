import * as React from 'react';

import {MeasureWrapper} from '../hooks/MeasureWrapper';

export function renderElementForMeasure(element?: React.ReactNode) {
    return <MeasureWrapper>{element}</MeasureWrapper>;
}