import { Cell } from "../../../../utils/types";
import { ARRAY_2D_GET_NEXT_INDEX, ARRAY_2D_GET_PREVIOUS_INDEX } from "./gridUtils";
import { pushJSXToLog } from "../../../../features/problemInfo/problemSlice";
import { changeGridCellStatus } from "../../../../features/grids/gridsSlice";
import { GridInterpreter } from "../../../../__generated__/resolvers-types";
import { copyGrids } from "../../../../features/grids/gridsSlice";
import { GridCreationLog } from "./logUtils";
import { CellHighlighter } from "../CellHighlighter";


export const convertArrayToGrid = (
  grid: number[][], 
  interpretAs: "NUMBER" | "BOOLEAN" | "NORMALIZED"
): Cell[][] => {
  let newData: Cell[][] = [];
  for (let i = 0; i < grid.length; i++) {
    let arr: Cell[] = [];
    for (let j = 0; j < grid[0].length; j++) {
      const cellValue = interpretAs === "BOOLEAN" ?
        (grid[i][j] > 0 ? true : false) : grid[i][j];
      arr.push({
        data: cellValue,
        status: "UNEXPLORED"
      }); 
    }
    newData.push(arr);
  }
  return newData;
}

export const convertArrayToFalse = (
  grid: any[][],
): Cell[][] => {
  let newData: Cell[][] = [];
  for (let i = 0; i < grid.length; i++) {
    let arr: Cell[] = [];
    for (let j = 0; j < grid[0].length; j++) {
      arr.push({
        data: false,
        status: "UNEXPLORED"
      }); 
    }
    newData.push(arr);
  }
  return newData;
}

/**
* Convert a 2D number grid to a 2D character grid.
* @param {number[][]} grid
* The number grid to operate on.
* @param {boolean} capitalize
*  Return uppercase or lowercase letters
*/
export const convertNumberArrayToAlphabetGrid = (
  grid: number[][],
  capitalize: boolean,
): Cell[][] => {
  let newArray: Cell[][] = [];
  for (let i = 0; i < grid.length; i++) {
    let innerArr: Cell[] = [];
    for (let j = 0; j < grid[0].length; j++) {
      const ascii = grid[i][j] + (capitalize ? 65 : 97)
      innerArr.push({
        data: String.fromCharCode(ascii),
        status: "UNEXPLORED"
      });
    }
    newArray.push(innerArr)
  }
  return newArray
}


const generateNextCellLog = (
  dispatch: any, 
  currentCell: [number, number],
  nextCell: [number, number]
) => {
  let element: JSX.Element = (
    <p>
      {`Added values above and to the left of cell`}
      <CellHighlighter dispatch={dispatch} cell={currentCell}/>
    </p>
  );
  dispatch(pushJSXToLog({element: element}));
  element = (
    <p>
      {`Iterated to cell`}
      <CellHighlighter dispatch={dispatch} cell={nextCell} />
    </p>
  )
  dispatch(pushJSXToLog({element: element}));
}

export const iterateToNextCell = (
  dispatch: any, 
  grid: Cell[][],
  currentCell: [number, number],
  withLog: boolean = false
): [number, number] => {
  dispatch(changeGridCellStatus({
    gridIndex: 0, 
    row: currentCell[0],
    col: currentCell[1],
    status: "UNEXPLORED"
  }))
  const nextCell = ARRAY_2D_GET_NEXT_INDEX(grid, currentCell[0], currentCell[1]);
  dispatch(changeGridCellStatus({
    gridIndex: 0,
    row: nextCell[0],
    col: nextCell[1],
    status: "CURRENT"
  }));
  if (withLog) {
    generateNextCellLog(dispatch, currentCell, nextCell);
  }
  return nextCell;
}

export const iterateToPreviousCell = (
  dispatch: any,
  grid: Cell[][],
  currentCell: [number, number]
) => {
  dispatch(changeGridCellStatus({
    gridIndex: 0, 
    row: currentCell[0],
    col: currentCell[1],
    status: "UNEXPLORED"
  }))
  const previousCell = ARRAY_2D_GET_PREVIOUS_INDEX(grid, currentCell[0], currentCell[1]);
  dispatch(changeGridCellStatus({
    gridIndex: 0,
    row: previousCell[0],
    col: previousCell[1],
    status: "CURRENT"
  }));
  return previousCell;

}

export const parseCurrentCellFromString = (cellString: string): [number, number] => {
  return [
    parseInt(cellString[1]),
    parseInt(cellString[4])
  ]
}

export const createStringFromCurrentCell = (cell: [number, number]): string => {
  return `[${cell[0]}, ${cell[1]}]`;
}


export const handleServerGrid = (
  dispatch: any, 
  gridData: number[][],
  label?: string,
  interpretAs?: GridInterpreter,
) => {
  const convertedGrid = convertArrayToGrid(gridData as number[][], interpretAs ? (interpretAs as "NUMBER" | "BOOLEAN" | "NORMALIZED") : "NUMBER");
  console.log(convertedGrid);
  console.log("converted grid")
  dispatch(copyGrids([convertedGrid]));
  const element: JSX.Element = (
    <GridCreationLog 
      dispatch={dispatch}
      numStructs={1}
      labels={["Grid #1"]}
    />
  );
  dispatch(pushJSXToLog({element: element}));
}