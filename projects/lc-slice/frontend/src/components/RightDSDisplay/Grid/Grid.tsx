import React, { useLayoutEffect, useRef } from "react"
import { useAppSelector } from "../../../features/hooks"
import {Node} from "../Node"
import "./grid.css"
import gsap from "gsap"


type GridProps = {
    gridIndex: number

}

export const Grid = ({gridIndex}: GridProps) => {
    const gridRowLength = useAppSelector(state => state.grids[gridIndex].height);
    const gridColumnLength = useAppSelector(state => state.grids[gridIndex].width);
    const gridLabel = useAppSelector(state => state.grids[gridIndex].label);
    const cellWidth = useAppSelector(state => state.grids[gridIndex].cellStyleWidth);
    const cellHeight = useAppSelector(state => state.grids[gridIndex].cellStyleHeight);
    const isEditable = useAppSelector(state => state.grids[gridIndex].editable);

    const gridRef = useRef<HTMLDivElement>(null);
    const timeline = useRef<gsap.core.Timeline>();

    useLayoutEffect(() => {
      const ctx = gsap.context(() => {
        timeline.current = gsap.timeline().from(gridRef.current, {translateX: -180})
      }, [gridRef])

      return () => ctx.revert();
    }, []);

    return (
        <div className="grid">
            {gridLabel}
            {[...Array(gridRowLength)].map((row, rowIdx) => (
                <div key={`Grid_${gridIndex}_Row_${rowIdx}`} style={{"display": "flex", "position": "relative"}}>
                    {[...Array(gridColumnLength)].map((node, nodeIdx) => (
                        <Node 
                            gridIndex={gridIndex}
                            key={`Grid_${gridIndex}_Cell_${rowIdx}_${nodeIdx}`}
                            rowIdx={rowIdx}
                            colIdx={nodeIdx}
                            styleWidth={cellWidth}
                            styleHeight={cellHeight}
                            isEditable={isEditable}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}