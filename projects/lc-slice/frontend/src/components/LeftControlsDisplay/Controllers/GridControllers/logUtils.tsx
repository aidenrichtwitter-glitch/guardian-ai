import React from "react"
import { DataStructureType } from "../../../../utils/types";
import { CellHighlighter } from "../CellHighlighter";
import { changeGridCellSize } from "../../../../features/grids/gridsSlice";
import {motion} from "framer-motion"
import { GridHighlighter } from "../GridHighlighter";


type GridCreationLogProps = {
  dispatch: any,
  numStructs: number,
  labels: string[],
}

export const GridCreationLog = ({
  dispatch, 
  numStructs,
  labels
}: GridCreationLogProps): JSX.Element => {
  const element: JSX.Element = (
    <div style={{display: "flex", "flexDirection": "column", alignItems: "center"}}>
      <div>{`Created ${numStructs} ${numStructs !== 1 ? "grids" : "grid"}`}</div>
        {[...Array(numStructs)].map((ele, idx) => (
          <GridHighlighter key={`GRID_LOG_${idx}`}dispatch={dispatch} gridIndex={idx} label={labels[idx]}/>
        ))}
    </div>
  )
  return element;
}


type SearchFromToLogProps = {
    dispatch: any,
    direction: string,
    cell: [number, number],
    nextCell: [number, number],
    tileValue?: number,
    nextTileValue?: number
}

export const SearchFromToLog = ({
    dispatch,
    direction,
    cell,
    nextCell,
    tileValue,
    nextTileValue
}: SearchFromToLogProps): JSX.Element => {
    if (tileValue && nextTileValue) {
        return (
            <p>
                <b>{`Searched `}</b><i>{`${direction}`}</i><b>{` from cell`}</b>
                <CellHighlighter dispatch={dispatch} cell={cell} />
                <b>{` with value `}</b><i>{`${tileValue}`}</i><b>{` to cell`}</b>
                <CellHighlighter dispatch={dispatch} cell={nextCell}/>
                <b>{` with value `}</b><i>{`${nextTileValue}.`}</i>
            </p> 
        );
    } else {
        return (
            <p>
                <b>{`Searched `}</b><i>{`${direction}`}</i><b>{` from cell`}</b>
                <CellHighlighter dispatch={dispatch} cell={cell} />
                <b>{` to cell`}</b>
                <CellHighlighter dispatch={dispatch} cell={nextCell}/>
            </p> 
        );
    }
}

type GoBackFromToLogProps = {
  dispatch: any,
  fromCell: [number, number],
  toCell: [number, number]
}

export const GoBackFromToLog = ({
  dispatch,
  fromCell,
  toCell
}: GoBackFromToLogProps) => {
  return(
    <p>
        <b>{`Found no valid cells in search. Popping `}</b>
        <CellHighlighter dispatch={dispatch} cell={fromCell} />
        <b>{` from stack and recurring back to `}</b>
        <CellHighlighter dispatch={dispatch} cell={toCell}/>
    </p> 
  );
}

export const LengthEdgeCaseLog = (
  dispatch: any
): JSX.Element => {
  return (
    <div>
      Due to the grid's size, the only possible answer is a length of 1 or a direct path.
    </div>
  )
}